# Installation guide — homebridge-luftdaten

A step-by-step walkthrough, from nothing to a working air-quality sensor in the
Apple **Home** app. Assumes you already have a running Homebridge instance.

---

## 1. Collect what you need

Before you start, prepare three things:

| Data | What it is | How to get it |
|---|---|---|
| **name** | the name shown in HomeKit | anything, e.g. `Living Room Air` |
| **localUrl / IP** | the sensor's local address with the `/data.json` path | see below |
| **sensorId** | the sensor's ID on Sensor.Community (for the cloud fallback) | see below |

### Finding the local IP address (localUrl)

1. The airrohr device, once on your Wi-Fi, is reachable on your LAN. Find its
   address via:
   - your router's DHCP client list (the hostname starts with `airrohr-…` /
     `feinstaubsensor-…`), or
   - a network-scanning app (e.g. *Fing*).
2. Open `http://<SENSOR_IP>/` in a browser — you'll see the airrohr panel.
3. The raw data lives at **`http://<SENSOR_IP>/data.json`**. Open it and confirm
   you see `sensordatavalues` with `SDS_P1`, `SDS_P2`, etc.
   That is your **localUrl**, e.g. `http://192.168.1.50/data.json`.

> Tip: give the sensor a **DHCP reservation** (static IP) in your router so the
> `localUrl` doesn't change after a reboot.

### Finding the sensorId (cloud)

1. Go to <https://devices.sensor.community/> and sign in to the account the
   sensor is registered to (or find it on the map at
   <https://maps.sensor.community/>).
2. The **sensorId** is the numeric ID of the **SDS011** (particulate) sensor.
   Verify it by opening:
   `https://data.sensor.community/airrohr/v1/sensor/<sensorId>/`
   It should return a JSON array of recent measurements.

> `sensorId` is optional — it's only a backup for when the sensor is temporarily
> unreachable on the local network. If you omit it, the plugin uses `localUrl`
> only.

---

## 2. Install the plugin

### Option A — Homebridge UI (recommended)

1. Open **Homebridge Config UI X** in your browser.
2. **Plugins** tab → search for `homebridge-luftdaten`.
3. Click **Install** and wait for it to finish.

### Option B — manually via npm

On the Homebridge host:

```bash
sudo npm install -g homebridge-luftdaten
```

(on a containerised / `hb-service` install, drop `sudo` as appropriate for your
setup).

### Option C — from a local file (e.g. before publishing to npm)

Copy the packed tarball to the Homebridge host and install it. Using
`hb-service` (the standard Homebridge install on Debian / Proxmox / Raspberry Pi)
puts it in the correct plugin directory:

```bash
# 1) On your machine: build the tarball
npm pack                       # produces homebridge-luftdaten-<version>.tgz

# 2) Copy it to the Homebridge host
scp homebridge-luftdaten-*.tgz <USER>@<HOMEBRIDGE_IP>:/tmp/

# 3) On the Homebridge host: install
sudo hb-service add /tmp/homebridge-luftdaten-*.tgz
# fallback if your install doesn't use hb-service:
# sudo npm install -g /tmp/homebridge-luftdaten-*.tgz
```

You can also install straight from GitHub:

```bash
sudo hb-service add https://github.com/<YOUR_LOGIN>/homebridge-luftdaten
```

---

## 3. Configure config.json

### Via the UI

In the **Plugins** tab click **Settings** next to homebridge-luftdaten and fill
in the fields, or edit the raw JSON in the **Config** tab.

### Manually

Add an entry to the `accessories` array in `config.json`:

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

See [README.md](README.md) for the full option reference. The essentials:

- `localUrl` — the priority local source.
- `sensorId` — the cloud backup (optional).
- `hasTempSensor` — `true` if you have an SHT3X/BME280; `false` for an SDS011
  alone. (The legacy `hasBME280` flag still works.)

Save the config and **restart Homebridge**.

---

## 4. Pair the bridge with the Home app (only for a new bridge)

> If your Homebridge bridge is already added to HomeKit, skip this — the new
> accessory appears automatically.

1. In the Homebridge UI **Status** screen, find the bridge **QR code** (and the
   PIN, default `031-45-154`).
2. On your iPhone/iPad open the **Home** app → **+** → **Add Accessory**.
3. Scan the QR code from the Homebridge screen.
4. Confirm adding the bridge (if you see "Uncertified Accessory", choose **Add
   Anyway**).
5. Assign the accessory to a room and name the tiles.

After pairing you'll see the air-quality sensor plus (if `hasTempSensor`)
separate temperature and humidity tiles.

---

## 5. Verify in the logs

In the Homebridge UI open **Logs**. On startup and on each poll you'll see a
line like:

```
[Living Room Air] [local] PM2.5=4.63 PM10=6.95 temp=21.4°C hum=45.33% airQuality=1
```

- `[local]` — data read from the sensor on the local network.
- `[cloud]` — the Sensor.Community fallback kicked in.
- `airQuality=1..5` — 1 = excellent, 5 = poor.

If you only see warnings (`Local read failed`, `No sensor data available`), see
the section below.

---

## 6. Troubleshooting

### No data / "Local read failed"

- **VLANs / segmented networks**: Homebridge must be able to reach the sensor.
  If the sensor lives on a separate IoT VLAN/network, allow traffic from the
  Homebridge host to the sensor's IP (port 80). Test from the Homebridge host:
  ```bash
  curl -m 10 http://192.168.1.50/data.json
  ```
  If `curl` doesn't return JSON, the problem is network/firewall, not the plugin.
- **Firewall**: make sure your firewall (router, host, Docker) isn't blocking
  outbound HTTP to the sensor or HTTPS to `data.sensor.community`.
- **Wrong address**: confirm `localUrl` ends with `/data.json` and the IP is
  current (see the DHCP reservation tip in step 1).
- **Timeout**: if the sensor responds slowly, raise `requestTimeout` (e.g. `20`).

### Cloud fallback is used instead of local

You see `[cloud]` instead of `[local]` — the sensor is unreachable locally.
Start with the `curl` test above. Remember the cloud updates with a delay and may
return older readings than a direct local read.

### No PM values (PM2.5 / PM10 = n/a)

- The **SDS011** has a warm-up phase — wait ~1–2 min after startup.
- In power-saving (sleep) mode the SDS011 measures in cycles; between cycles
  `data.json` may not contain fresh `SDS_P1` / `SDS_P2`. Align `pollInterval`
  with the sensor's measurement cycle.
- Check `http://<SENSOR_IP>/data.json` to confirm the `SDS_P1`/`SDS_P2` keys are
  present at all.

### SHT3X vs BME280 — temperature/humidity is "n/a"

- The plugin recognises both automatically (`SHT3X_*`, `BME280_*`, plus
  `BMP280_*`, `DHT_*` and generic `temperature`/`humidity`).
- If data is still missing: check which exact `value_type` your firmware reports
  in `data.json`, and that `hasTempSensor` is `true`.
- **BMP280** measures only temperature and pressure (no humidity) — in that case
  humidity stays empty, which is expected.
- Pressure is not shown in HomeKit (no such characteristic exists) — you'll only
  see it in the logs.
