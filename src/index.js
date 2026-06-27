'use strict';

/**
 * homebridge-luftdaten
 *
 * Accessory plugin reading air-quality data from a Luftdaten / Sensor.Community
 * (airrohr firmware) sensor. Reads locally first (e.g. http://<ip>/data.json)
 * and falls back to the Sensor.Community cloud API.
 *
 * Zero external dependencies — uses the built-in global `fetch` (Node 18+)
 * together with AbortController for request timeouts.
 */

const PLUGIN_NAME = 'homebridge-luftdaten';
const ACCESSORY_NAME = 'Luftdaten';

// HomeKit AirQuality characteristic values (HAP enum).
const AIR_QUALITY = {
  UNKNOWN: 0,
  EXCELLENT: 1,
  GOOD: 2,
  FAIR: 3,
  INFERIOR: 4,
  POOR: 5,
};

// HomeKit PM density characteristics have a valid range of 0..1000 µg/m³.
const DENSITY_MIN = 0;
const DENSITY_MAX = 1000;

/**
 * Parse a single airrohr-style payload (an object with a `sensordatavalues`
 * array) into normalised numeric readings. Handles every firmware variant of
 * the temperature/humidity/pressure value_type names.
 *
 * @param {object} data raw payload (a single sensor record, not the cloud array)
 * @returns {{pm25:?number, pm10:?number, temperature:?number, humidity:?number, pressure:?number}}
 */
function parseSensorData(data) {
  const result = {
    pm25: null,
    pm10: null,
    temperature: null,
    humidity: null,
    pressure: null, // hPa — read & logged, but not exposed to HomeKit
  };

  const values =
    data && Array.isArray(data.sensordatavalues) ? data.sensordatavalues : [];

  for (const entry of values) {
    if (!entry || typeof entry.value_type !== 'string') continue;
    const num = parseFloat(entry.value);
    if (Number.isNaN(num)) continue;

    switch (entry.value_type) {
      // PM10 — local firmware uses SDS_P1, the Sensor.Community cloud API uses P1.
      case 'SDS_P1':
      case 'P1':
        result.pm10 = num;
        break;
      // PM2.5 — local firmware uses SDS_P2, the cloud API uses P2.
      case 'SDS_P2':
      case 'P2':
        result.pm25 = num;
        break;

      // Temperature — all known firmware variants.
      case 'SHT3X_temperature':
      case 'BME280_temperature':
      case 'BMP280_temperature':
      case 'DHT_temperature':
      case 'temperature':
        result.temperature = num;
        break;

      // Humidity — all known firmware variants.
      case 'SHT3X_humidity':
      case 'BME280_humidity':
      case 'DHT_humidity':
      case 'humidity':
        result.humidity = num;
        break;

      // Pressure reported in Pa — convert to hPa.
      case 'BME280_pressure':
      case 'BMP280_pressure':
        result.pressure = num / 100;
        break;

      default:
        // signal, samples, min_micro, etc. — ignored.
        break;
    }
  }

  return result;
}

/**
 * Map a PM2.5 reading (µg/m³) to a HomeKit AirQuality value using WHO/EU
 * thresholds.
 *   <=10 EXCELLENT, <=20 GOOD, <=25 FAIR, <=50 INFERIOR, >50 POOR, missing UNKNOWN
 *
 * @param {?number} pm25
 * @returns {number} HomeKit AirQuality value (0..5)
 */
function pm25ToAirQuality(pm25) {
  if (pm25 === null || pm25 === undefined || Number.isNaN(pm25)) {
    return AIR_QUALITY.UNKNOWN;
  }
  if (pm25 <= 10) return AIR_QUALITY.EXCELLENT;
  if (pm25 <= 20) return AIR_QUALITY.GOOD;
  if (pm25 <= 25) return AIR_QUALITY.FAIR;
  if (pm25 <= 50) return AIR_QUALITY.INFERIOR;
  return AIR_QUALITY.POOR;
}

/** Clamp a density value into the HomeKit-valid 0..1000 range. */
function clampDensity(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.min(DENSITY_MAX, Math.max(DENSITY_MIN, value));
}

class LuftdatenAccessory {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;

    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.name = this.config.name || ACCESSORY_NAME;
    this.localUrl = this.config.localUrl || null;
    this.sensorId =
      this.config.sensorId !== undefined && this.config.sensorId !== null
        ? String(this.config.sensorId)
        : null;

    this.pollInterval = Math.max(10, Number(this.config.pollInterval) || 120) * 1000;
    this.requestTimeout =
      Math.max(1, Number(this.config.requestTimeout) || 10) * 1000;

    // hasTempSensor decides whether temperature + humidity services are added.
    // Backward compatible with the old `hasBME280` flag.
    if (this.config.hasTempSensor !== undefined) {
      this.hasTempSensor = Boolean(this.config.hasTempSensor);
    } else if (this.config.hasBME280 !== undefined) {
      this.hasTempSensor = Boolean(this.config.hasBME280);
    } else {
      this.hasTempSensor = true;
    }

    // Last known readings (served by onGet handlers between polls).
    this.latest = {
      pm25: null,
      pm10: null,
      temperature: null,
      humidity: null,
      pressure: null,
    };

    if (!this.localUrl && !this.sensorId) {
      this.log.warn(
        'Neither "localUrl" nor "sensorId" configured — no data source available.'
      );
    }

    this._setupServices();
    this._startPolling();
  }

  _setupServices() {
    const { Service, Characteristic } = this;

    // Accessory information.
    this.informationService = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Manufacturer, 'Sensor.Community')
      .setCharacteristic(Characteristic.Model, 'SDS011 + SHT3X/BME280')
      .setCharacteristic(
        Characteristic.SerialNumber,
        this.sensorId || this.localUrl || 'luftdaten'
      );

    // Air quality.
    this.airQualityService = new Service.AirQualitySensor(this.name);
    this.airQualityService
      .getCharacteristic(Characteristic.AirQuality)
      .onGet(() => pm25ToAirQuality(this.latest.pm25));
    this.airQualityService
      .getCharacteristic(Characteristic.PM2_5Density)
      .onGet(() => clampDensity(this.latest.pm25));
    this.airQualityService
      .getCharacteristic(Characteristic.PM10Density)
      .onGet(() => clampDensity(this.latest.pm10));

    this.services = [this.informationService, this.airQualityService];

    if (this.hasTempSensor) {
      this.temperatureService = new Service.TemperatureSensor(
        `${this.name} Temp`,
        'temperature'
      );
      this.temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({ minValue: -50, maxValue: 100 })
        .onGet(() =>
          this.latest.temperature === null ? 0 : this.latest.temperature
        );

      this.humidityService = new Service.HumiditySensor(
        `${this.name} Humidity`,
        'humidity'
      );
      this.humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .onGet(() => (this.latest.humidity === null ? 0 : this.latest.humidity));

      this.services.push(this.temperatureService, this.humidityService);
    }
  }

  _startPolling() {
    // Kick off immediately, then on the configured interval.
    this.poll();
    this._timer = setInterval(() => this.poll(), this.pollInterval);
    if (this._timer.unref) this._timer.unref();
  }

  /** Fetch JSON from a URL with an AbortController-based timeout. */
  async _fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** Poll the sensor: local first, cloud as fallback. */
  async poll() {
    let raw = null;
    let source = null;

    // 1. Local read — priority.
    if (this.localUrl) {
      try {
        raw = await this._fetchJson(this.localUrl);
        source = 'local';
      } catch (err) {
        this.log.warn(
          `Local read failed (${this.localUrl}): ${err.message}` +
            (this.sensorId ? ' — trying cloud fallback.' : '')
        );
      }
    }

    // 2. Cloud fallback.
    if (!raw && this.sensorId) {
      const cloudUrl = `https://data.sensor.community/airrohr/v1/sensor/${this.sensorId}/`;
      try {
        const data = await this._fetchJson(cloudUrl);
        // Cloud returns an array of records; the newest is the last element.
        raw = Array.isArray(data) ? data[data.length - 1] : data;
        source = 'cloud';
      } catch (err) {
        this.log.warn(`Cloud read failed (sensor ${this.sensorId}): ${err.message}`);
      }
    }

    if (!raw) {
      this.log.warn('No sensor data available from any source this cycle.');
      return;
    }

    const parsed = parseSensorData(raw);
    this.latest = parsed;
    this._publish(parsed, source);
  }

  /** Push parsed readings into the HomeKit characteristics and log them. */
  _publish(parsed, source) {
    const { Characteristic } = this;

    const aq = pm25ToAirQuality(parsed.pm25);
    this.airQualityService.updateCharacteristic(Characteristic.AirQuality, aq);
    if (parsed.pm25 !== null) {
      this.airQualityService.updateCharacteristic(
        Characteristic.PM2_5Density,
        clampDensity(parsed.pm25)
      );
    }
    if (parsed.pm10 !== null) {
      this.airQualityService.updateCharacteristic(
        Characteristic.PM10Density,
        clampDensity(parsed.pm10)
      );
    }

    if (this.hasTempSensor) {
      if (parsed.temperature !== null && this.temperatureService) {
        this.temperatureService.updateCharacteristic(
          Characteristic.CurrentTemperature,
          parsed.temperature
        );
      }
      if (parsed.humidity !== null && this.humidityService) {
        this.humidityService.updateCharacteristic(
          Characteristic.CurrentRelativeHumidity,
          parsed.humidity
        );
      }
    }

    const parts = [];
    parts.push(`PM2.5=${fmt(parsed.pm25)}`);
    parts.push(`PM10=${fmt(parsed.pm10)}`);
    if (this.hasTempSensor) {
      parts.push(`temp=${fmt(parsed.temperature)}°C`);
      parts.push(`hum=${fmt(parsed.humidity)}%`);
    }
    if (parsed.pressure !== null) {
      parts.push(`pressure=${fmt(parsed.pressure)}hPa`);
    }
    parts.push(`airQuality=${aq}`);
    this.log.info(`[${source}] ${parts.join(' ')}`);
  }

  getServices() {
    return this.services;
  }
}

function fmt(value) {
  return value === null || value === undefined || Number.isNaN(value)
    ? 'n/a'
    : value;
}

module.exports = (api) => {
  api.registerAccessory(PLUGIN_NAME, ACCESSORY_NAME, LuftdatenAccessory);
};

// Exposed for unit tests (does not affect Homebridge registration).
module.exports.parseSensorData = parseSensorData;
module.exports.pm25ToAirQuality = pm25ToAirQuality;
module.exports.clampDensity = clampDensity;
module.exports.AIR_QUALITY = AIR_QUALITY;
module.exports.LuftdatenAccessory = LuftdatenAccessory;
