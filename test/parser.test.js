'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseSensorData,
  pm25ToAirQuality,
  AIR_QUALITY,
} = require('../src/index.js');

// Real response captured from the sensor (SDS011 + SHT3X).
const SAMPLE_SHT3X = {
  software_version: 'NRZ-2024-135',
  age: '25',
  sensordatavalues: [
    { value_type: 'SDS_P1', value: '6.95' },
    { value_type: 'SDS_P2', value: '4.63' },
    { value_type: 'SHT3X_temperature', value: '33.62' },
    { value_type: 'SHT3X_humidity', value: '45.33' },
    { value_type: 'signal', value: '-71' },
  ],
};

test('parses PM / temperature / humidity from an SHT3X payload', () => {
  const parsed = parseSensorData(SAMPLE_SHT3X);
  assert.equal(parsed.pm10, 6.95); // SDS_P1 -> PM10
  assert.equal(parsed.pm25, 4.63); // SDS_P2 -> PM2.5
  assert.equal(parsed.temperature, 33.62);
  assert.equal(parsed.humidity, 45.33);
  assert.equal(parsed.pressure, null);
});

test('parses BME280 variant including pressure (Pa -> hPa)', () => {
  const parsed = parseSensorData({
    sensordatavalues: [
      { value_type: 'SDS_P1', value: '12.0' },
      { value_type: 'SDS_P2', value: '8.0' },
      { value_type: 'BME280_temperature', value: '21.5' },
      { value_type: 'BME280_humidity', value: '55.0' },
      { value_type: 'BME280_pressure', value: '100530.00' },
    ],
  });
  assert.equal(parsed.temperature, 21.5);
  assert.equal(parsed.humidity, 55.0);
  assert.equal(parsed.pressure, 1005.3); // 100530 Pa / 100
});

test('parses the Sensor.Community cloud format (P1/P2 value_types)', () => {
  // Shape of a single record from
  // https://data.sensor.community/airrohr/v1/sensor/<id>/ (newest = last element).
  const cloudRecord = {
    sensordatavalues: [
      { value_type: 'P1', value: '7.53', id: 69529460829 },
      { value_type: 'P2', value: '4.88', id: 69529460830 },
    ],
    sensor: { id: 12345, sensor_type: { name: 'SDS011' } },
  };
  const parsed = parseSensorData(cloudRecord);
  assert.equal(parsed.pm10, 7.53); // P1 -> PM10
  assert.equal(parsed.pm25, 4.88); // P2 -> PM2.5
});

test('handles generic temperature/humidity and DHT/BMP280 variants', () => {
  const dht = parseSensorData({
    sensordatavalues: [
      { value_type: 'DHT_temperature', value: '18.2' },
      { value_type: 'DHT_humidity', value: '60.1' },
    ],
  });
  assert.equal(dht.temperature, 18.2);
  assert.equal(dht.humidity, 60.1);

  const generic = parseSensorData({
    sensordatavalues: [
      { value_type: 'temperature', value: '19.9' },
      { value_type: 'humidity', value: '50.0' },
      { value_type: 'BMP280_pressure', value: '99800' },
    ],
  });
  assert.equal(generic.temperature, 19.9);
  assert.equal(generic.humidity, 50.0);
  assert.equal(generic.pressure, 998);
});

test('returns nulls for empty / malformed payloads', () => {
  assert.deepEqual(parseSensorData({}), {
    pm25: null,
    pm10: null,
    temperature: null,
    humidity: null,
    pressure: null,
  });
  assert.equal(parseSensorData(null).pm25, null);
  // Non-numeric values are skipped.
  assert.equal(
    parseSensorData({
      sensordatavalues: [{ value_type: 'SDS_P2', value: 'NaN' }],
    }).pm25,
    null
  );
});

test('maps PM2.5 to AirQuality at the boundaries', () => {
  // Required boundary cases from the spec.
  assert.equal(pm25ToAirQuality(9.3), 1); // EXCELLENT
  assert.equal(pm25ToAirQuality(22), 3); // FAIR
  assert.equal(pm25ToAirQuality(70), 5); // POOR

  // Exact threshold edges (<= is inclusive).
  assert.equal(pm25ToAirQuality(10), AIR_QUALITY.EXCELLENT);
  assert.equal(pm25ToAirQuality(10.01), AIR_QUALITY.GOOD);
  assert.equal(pm25ToAirQuality(20), AIR_QUALITY.GOOD);
  assert.equal(pm25ToAirQuality(25), AIR_QUALITY.FAIR);
  assert.equal(pm25ToAirQuality(50), AIR_QUALITY.INFERIOR);
  assert.equal(pm25ToAirQuality(50.1), AIR_QUALITY.POOR);

  // Missing / invalid -> UNKNOWN.
  assert.equal(pm25ToAirQuality(null), AIR_QUALITY.UNKNOWN);
  assert.equal(pm25ToAirQuality(NaN), AIR_QUALITY.UNKNOWN);
});
