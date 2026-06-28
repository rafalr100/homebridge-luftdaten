# Contributing

Thanks for your interest in improving **homebridge-luftdaten**! Contributions of
all kinds are welcome — bug reports, fixes, docs, and features.

## Reporting bugs / requesting features

Open an issue using one of the templates. For bugs, please include the plugin
version, Homebridge and Node.js versions, your (secret-free) config, and the
relevant log lines.

## Development

Requirements: Node.js 18+ (no other dependencies).

```bash
git clone https://github.com/rafalr100/homebridge-luftdaten.git
cd homebridge-luftdaten
npm run check   # node --check src/index.js
npm test        # node --test
```

There are no runtime dependencies, so there is nothing to `npm install`. The
parser and AirQuality mapping are unit-tested in `test/` — please add a test when
you change parsing or threshold logic.

### Project layout

| Path | Purpose |
|---|---|
| `src/index.js` | the plugin (platform + per-sensor handler + parser) |
| `test/parser.test.js` | unit tests for the parser and AirQuality mapping |
| `config.schema.json` | the Homebridge UI settings form |
| `docs/` | icon, banner, and the Home app preview |

## Pull requests

1. Branch off `main`.
2. Keep the style consistent with the surrounding code.
3. Make sure `npm run check` and `npm test` pass.
4. Update the README and `CHANGELOG.md` if behaviour changes.
5. Never commit real IPs, sensor IDs, or other secrets — use placeholders.

## Releases

The maintainer bumps the version (`npm version <patch|minor|major>`), pushes the
tag, creates a GitHub Release, and publishes to npm.

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
