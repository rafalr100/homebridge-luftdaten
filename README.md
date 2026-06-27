<h1 align="center">homebridge-luftdaten</h1>

<p align="center">
  Bring your <a href="https://sensor.community/">Luftdaten / Sensor.Community</a>
  air-quality sensor into Apple HomeKit — local-first, with an automatic cloud fallback.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green.svg"></a>
  <img alt="Node >= 18" src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white">
  <img alt="Homebridge >= 1.6" src="https://img.shields.io/badge/homebridge-%3E%3D1.6-491F59?logo=homebridge&logoColor=white">
  <img alt="Dependencies: none" src="https://img.shields.io/badge/dependencies-none-blue">
</p>

<p align="center">
  <img src="docs/home-app-preview.svg" alt="How the sensor looks in the iOS Home app" width="720">
</p>

---

A Homebridge **accessory** plugin that exposes a Luftdaten / Sensor.Community
sensor (airrohr firmware — typically an **SDS011** particulate sensor plus an
**SHT3X** or **BME280** temperature/humidity sensor) to Apple HomeKit.

It reads **locally first** from the sensor's own `data.json` endpoint and
**falls back to the Sensor.Community cloud** when the local device is
unreachable. Zero external dependencies — it uses the built-in `fetch` (Node 18+)
and `AbortController` for timeouts.

## Features

- 🏠 Local-first reading (`http://<ip>/data.json`), cloud fallback via the
  Sensor.Community API.
- 🌫️ Air quality (1–5) derived from PM2.5 using WHO/EU thresholds, plus raw
  PM2.5 and PM10 density.
- 🌡️ Temperature and humidity (optional, on by default).
- 🔄 Configurable polling interval and request timeout.
- 📦 No runtime dependencies.

## Exposed HomeKit services & characteristics

| Service | Characteristic | Source | Notes |
|---|---|---|---|
| AirQualitySensor | `AirQuality` (1–5) | derived from PM2.5 | see thresholds below |
| AirQualitySensor | `PM2_5Density` | `SDS_P2` / `P2` | µg/m³ |
| AirQualitySensor | `PM10Density` | `SDS_P1` / `P1` | µg/m³ |
| TemperatureSensor | `CurrentTemperature` | `*_temperature` | name `"<name> Temp"`, range −50…100 °C |
| HumiditySensor | `CurrentRelativeHumidity` | `*_humidity` | name `"<name> Humidity"` |
| AccessoryInformation | `Manufacturer` | — | `Sensor.Community` |
| AccessoryInformation | `Model` | — | `SDS011 + SHT3X/BME280` |
| AccessoryInformation | `SerialNumber` | — | `sensorId` (or `localUrl`) |

Temperature and humidity services are only added when `hasTempSensor` is `true`
(the default).

Atmospheric **pressure** (`BME280_pressure` / `BMP280_pressure`, converted Pa → hPa)
is parsed and written to the Homebridge log, but **not** exposed to HomeKit —
there is no native HomeKit characteristic for barometric pressure.

### value_type variants understood by the parser

- PM: `SDS_P1` → PM10, `SDS_P2` → PM2.5 (local); `P1` → PM10, `P2` → PM2.5 (cloud API)
- Temperature: `SHT3X_temperature`, `BME280_temperature`, `BMP280_temperature`,
  `DHT_temperature`, generic `temperature`
- Humidity: `SHT3X_humidity`, `BME280_humidity`, `DHT_humidity`, generic `humidity`
- Pressure: `BME280_pressure`, `BMP280_pressure` (÷100 → hPa)

## PM2.5 → AirQuality mapping (µg/m³)

| PM2.5 | AirQuality |
|---|---|
| ≤ 10 | 1 — EXCELLENT |
| ≤ 20 | 2 — GOOD |
| ≤ 25 | 3 — FAIR |
| ≤ 50 | 4 — INFERIOR |
| > 50 | 5 — POOR |
| missing / NaN | 0 — UNKNOWN |

## Installation

Via the Homebridge UI: search for **homebridge-luftdaten** on the Plugins tab
and install it. Or from the command line:

```bash
npm install -g homebridge-luftdaten
```

A full, step-by-step walkthrough is in **[INSTALL.md](INSTALL.md)**.

## Configuration

Add an entry to the `accessories` array of your Homebridge `config.json`:

```json
{
  "accessories": [
    {
      "accessory": "Luftdaten",
      "name": "Living Room Air",
      "localUrl": "http://192.168.1.50/data.json",
      "sensorId": "12345",
      "pollInterval": 120,
      "requestTimeout": 10,
      "hasTempSensor": true
    }
  ]
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `accessory` | string | — | Must be `"Luftdaten"`. |
| `name` | string | `"Luftdaten"` | Name shown in the Home app. |
| `localUrl` | string | — | Local sensor endpoint, e.g. `http://192.168.1.50/data.json`. Tried first. |
| `sensorId` | string/number | — | Sensor.Community sensor ID, used for the cloud fallback. |
| `pollInterval` | number | `120` | Seconds between reads (min 10). |
| `requestTimeout` | number | `10` | Per-request timeout in seconds (min 1). |
| `hasTempSensor` | boolean | `true` | Add temperature + humidity services. |
| `hasBME280` | boolean | — | **Deprecated** alias for `hasTempSensor`, kept for backward compatibility. |

At least one of `localUrl` or `sensorId` must be set. If both are present, the
local URL is used and the cloud is only contacted when the local read fails.

## How it works

```
        ┌──────────────────────────┐
poll →  │  GET localUrl (priority)  │ ── ok ──►  parse  ─┐
        └──────────────────────────┘                    │
                     │ fail/timeout                      ▼
                     ▼                          update HomeKit
        ┌──────────────────────────┐           characteristics
        │ GET cloud API (fallback) │ ── ok ──►  parse  ─┘
        │  …/v1/sensor/<id>/       │
        └──────────────────────────┘
```

## Development

```bash
npm run check   # node --check src/index.js
npm test        # node --test
```

## License

[MIT](LICENSE) © Rafał Rudecki
