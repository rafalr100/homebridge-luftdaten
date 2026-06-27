# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-06-27

### Added
- Broader npm keywords for discoverability (`air-pollution`, `pm25`, `pm10`,
  `feinstaub`, `smog`, `dust-sensor`, `temperature`, `humidity`, `nova-fitness`,
  and the common misspelling `loftdaten`).

## [1.0.0] - 2026-06-27

### Added
- Initial release — Homebridge **accessory** plugin for Luftdaten /
  Sensor.Community (airrohr) air-quality sensors.
- Local-first reading from the sensor's `data.json`, with an automatic fallback
  to the Sensor.Community cloud API (newest record).
- `AirQuality` (1–5) derived from PM2.5 using WHO/EU thresholds, plus
  `PM2_5Density` and `PM10Density`.
- Optional `TemperatureSensor` and `HumiditySensor`, recognising all firmware
  `value_type` variants (`SHT3X_*`, `BME280_*`, `BMP280_*`, `DHT_*`, generic).
  Local payloads use `SDS_P1`/`SDS_P2`; the cloud API uses `P1`/`P2` — both are
  handled.
- Atmospheric pressure parsed and logged (not exposed to HomeKit — no native
  characteristic).
- Backward-compatible `hasBME280` alias for `hasTempSensor`.
- `config.schema.json` for the Homebridge UI settings form.
- Configurable `pollInterval` and `requestTimeout`; request timeouts via
  `AbortController`.
- Zero runtime dependencies (built-in `fetch`, Node 18+).
- Unit tests, README with an iOS Home app preview, and an install guide.

[1.0.1]: https://github.com/rafalr100/homebridge-luftdaten/releases/tag/v1.0.1
[1.0.0]: https://github.com/rafalr100/homebridge-luftdaten/releases/tag/v1.0.0
