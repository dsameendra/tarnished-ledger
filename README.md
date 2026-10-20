# Tarnished's Ledger

A step-by-step checklist for 100% completion of Elden Ring: all 42 trophies and achievements, every legendary item and all three ending trophies. Shadow of the Erdtree can be switched on in Settings as a DLC route with goals and blessing counters (the DLC has no trophies). It works as an installable app on iPhone and desktop.

**Live site:** https://dsameendra.github.io/tarnished-ledger/

## Features

- 25 ordered phases plus 12 optional DLC phases with tick-off steps, a route map and an "Up next" card
- Trophy list with medals, plus Legendary armaments, ashes, spells and talismans
- Endings guide covering the save-backup route and the NG / NG+ / NG++ route
- Progress saves automatically on your device and works offline
- Settings for theme, accent colour, text size, compact mode and keeping the screen on
- Optional sync through a private GitHub gist, plus file and code backups

## Install on iPhone

1. Open the live site in Safari.
2. Tap Share, then Add to Home Screen.

Keeping the screen on in the installed app needs iOS 18.4 or later.

## Run locally

It is a static site with no build step.

```
python3 -m http.server 8080
```

Then open http://localhost:8080. The service worker only registers over HTTPS or localhost.

## Project layout

| Path | Purpose |
|---|---|
| `index.html`, `css/styles.css` | App shell and styles |
| `js/app.js` | Boot and event wiring |
| `js/lib/` | Store, sync, derived model, icons, helpers |
| `js/ui/` | One module per tab |
| `js/data/` | Route, trophies, map, guide and DLC data |
| `sw.js`, `manifest.webmanifest` | Offline cache and install metadata |
| `scripts/check.mjs`, `test/` | Data checks and unit tests (`npm run check`, `npm test`) |
| `docs/` | Architecture, data format, sync options, deploy notes |

## Editing the route

See [docs/DATA.md](docs/DATA.md). Bump the cache name in `sw.js` after a change so installed copies refresh.

## Credits and notice

The route is based on the community [Elden Ring 100% Achievement Guide by ponkberry](https://steamcommunity.com/sharedfiles/filedetails/?id=2785187510) on Steam. Icons, medals and the map are original drawings.

This is an unofficial fan project. It is not affiliated with or endorsed by FromSoftware, Bandai Namco or Sony. Elden Ring and related names are trademarks of their owners.
