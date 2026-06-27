# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-06-27

### Changed (breaking)
- **Converted from an accessory plugin to a dynamic platform plugin.** This is
  required for Homebridge verification and enables managing multiple sensors and
  running as a child bridge.
- **Config format changed.** Move your old `accessories` entry into a `platforms`
  block: change `"accessory": "Luftdaten"` to `"platform": "Luftdaten"` and place
  your sensor settings inside a `sensors` array. See the README for an example.

### Added
- Support for **multiple sensors** under a single platform block.
- Accessories are now cached/restored across restarts and removed automatically
  when taken out of the config.
- CI now also tests on Node 24.

## [1.1.0] - 2026-06-27

### Added
- HomeKit now shows **"No Response"** when the sensor is unreachable: after a few
  consecutive failed polls the readings report a communication error and
  `StatusActive` is set to `false`. State clears automatically once the sensor
  responds again.
- GitHub Actions CI running `node --check` and the test suite on Node 18, 20, 22.
- Plugin logo, shown in the README and on the plugin's Settings page in the
  Homebridge UI.

### Changed
- Quieter logging — routine reads now log at `debug` level; an `info` line is
  emitted only when the AirQuality level changes.

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

[2.0.0]: https://github.com/rafalr100/homebridge-luftdaten/releases/tag/v2.0.0
[1.1.0]: https://github.com/rafalr100/homebridge-luftdaten/releases/tag/v1.1.0
[1.0.1]: https://github.com/rafalr100/homebridge-luftdaten/releases/tag/v1.0.1
[1.0.0]: https://github.com/rafalr100/homebridge-luftdaten/releases/tag/v1.0.0
