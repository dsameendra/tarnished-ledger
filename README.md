<div align="center">

<img src="assets/icons/icon-180.png" width="96" height="96" alt="Tarnished's Ledger icon">

# Tarnished's Ledger

**A step-by-step 100% completion checklist for Elden Ring, with Shadow of the Erdtree tracking.**
Installable, offline-ready, no account, no build step.

[![Live site](https://img.shields.io/badge/live-dsameendra.github.io%2Ftarnished--ledger-c39a3f?style=flat-square)](https://dsameendra.github.io/tarnished-ledger/)
[![CI](https://img.shields.io/github/actions/workflow/status/dsameendra/tarnished-ledger/ci.yml?branch=main&style=flat-square&label=checks)](https://github.com/dsameendra/tarnished-ledger/actions/workflows/ci.yml)
![Static site](https://img.shields.io/badge/stack-vanilla%20JS%20%C2%B7%20ES%20modules-555?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-offline-555?style=flat-square)

</div>

<p align="center">
  <img src="docs/screenshots/route-desktop-dark.webp" width="760" alt="The route tab on desktop in the dark theme">
</p>

## What it is

One ordered route through the Lands Between that gets you all 42 trophies and achievements: every boss, every legendary item and all three ending trophies. You tick steps as you play and the app does the bookkeeping: which trophy a step completes, what to do next, and how far along you are.

Shadow of the Erdtree can be switched on in Settings. The DLC has no trophies, so it is tracked as a route of 12 phases with goals and blessing counters instead.

## Features

- **26 route phases** of tick-off steps with an "Up next" card, search, collapsible phases and "hide done".
- **Trophy list** with PlayStation medals (or Xbox/PC achievement wording) that tick themselves from the route.
- **Legendary items** tracker: armaments, ashen remains, spells and talismans.
- **Shadow of the Erdtree** (optional): 12 DLC phases, 15 completion goals, and Scadutree Fragment and Revered Spirit Ash counters with blessing levels. A "DLC only" mode hides the base game.
- **Guide tab**: easy-to-miss content, Stonesword Key uses, upgrade costs, the endings and how to back up your save on each platform.
- **Interactive map** of the Lands Between, underground regions, the Roundtable Hold (marker positions only) and the Realm of Shadow: pan, pinch and zoom, layers, marker filters, search, place names, an overview map and a maximized view. Ticking a boss or item in the route ticks it on the map too, and a progress section lists what is done and what is left. Pick a route phase on the map to read and tick its checklist without leaving the map.
- **Sync between devices** through a private GitHub gist (optional), plus file and code backups.
- **Works offline** and installs as an app on iPhone, Android and desktop. Can keep the screen awake while you play.
- **Themes**: system, light and dark, five accents, three text sizes, compact rows.

## Screenshots

### Route and trophies

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/route-phone-dark.webp" alt="Route on a phone with the Up next card, dark theme"></td>
    <td width="50%"><img src="docs/screenshots/goals-phone-light.webp" alt="Shadow of the Erdtree goals and blessing counters on a phone, light theme"></td>
  </tr>
  <tr>
    <td align="center"><sub>Route: pick up where you left off</sub></td>
    <td align="center"><sub>Shadow of the Erdtree goals and counters</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/trophies-desktop-light.webp" width="760" alt="The trophy list with PlayStation medals on desktop, light theme"><br>
  <sub>Trophy list. Each trophy ticks itself when its route step is done.</sub>
</p>

<p align="center">
  <img src="docs/screenshots/legendary-desktop-dark.webp" width="760" alt="Legendary armaments, ashen remains, spells and talismans checklist, dark theme"><br>
  <sub>Legendary items, with a link from each one to its route step.</sub>
</p>

### Map

<p align="center">
  <img src="docs/screenshots/map-desktop-dark.webp" width="760" alt="Maximized map of the Lands Between with the numbered route drawn on it, dark theme"><br>
  <sub>The Lands Between with the route drawn through each phase, marker filters and the overview map.</sub>
</p>

<table>
  <tr>
    <td width="62%"><img src="docs/screenshots/map-dlc-desktop-light.webp" alt="Realm of Shadow map, light theme"></td>
    <td width="38%"><img src="docs/screenshots/map-phone-dark.webp" alt="Maximized map on a phone, dark theme"></td>
  </tr>
  <tr>
    <td align="center"><sub>Realm of Shadow (Shadow of the Erdtree)</sub></td>
    <td align="center"><sub>The same map on a phone</sub></td>
  </tr>
</table>

### Guide and settings

<table>
  <tr>
    <td width="30%"><img src="docs/screenshots/guide-phone-light.webp" alt="The Guide tab on a phone, light theme"></td>
    <td width="70%"><img src="docs/screenshots/settings-desktop-dark-green.webp" alt="Settings with the Mistwood green accent, dark theme"></td>
  </tr>
  <tr>
    <td align="center"><sub>Guide tab</sub></td>
    <td align="center"><sub>Settings: themes, accents (shown in Mistwood green), sync and backups</sub></td>
  </tr>
</table>

<sub>Screenshots show a sample save part-way through the game.</sub>

## Use it

Open **https://dsameendra.github.io/tarnished-ledger/**.

**iPhone:** open the site in Safari, tap Share, then Add to Home Screen. An installed home-screen app has its own storage, separate from Safari, so use sync or a backup to move progress across. Keeping the screen on needs iOS 18.4 or later.

**Android / desktop Chrome:** use the browser menu, then Install app.

Progress is stored in your browser. To use it on several devices, connect the optional gist sync in Settings. See [docs/SYNC.md](docs/SYNC.md) for how it works and the alternatives.

## Run it locally

There is no build step.

```bash
git clone https://github.com/dsameendra/tarnished-ledger.git
cd tarnished-ledger
npm run serve          # python3 -m http.server 8080
```

Open http://localhost:8080. The service worker only registers over HTTPS or localhost.

```bash
npm run check          # validates the route data
npm test               # unit tests for the store and sync logic (Node 20+, no dependencies)
```

## How it is built

Plain ES modules, `localStorage` and a service worker. No framework, no bundler, no runtime dependencies.

| Path | Purpose |
|---|---|
| `index.html`, `css/styles.css` | App shell and styles |
| `js/app.js` | Boot and event wiring |
| `js/lib/` | Store, sync, derived model, icons and helpers |
| `js/ui/` | One module per tab |
| `js/data/` | Route, trophies, map, guide and DLC data |
| `sw.js`, `manifest.webmanifest` | Offline cache and install metadata |
| `scripts/`, `test/` | Data checks, map calibration and data build scripts, unit tests |
| `vendor/leaflet/` | Leaflet 1.9.4 (BSD-2), loaded when the Map tab opens |
| `assets/map/` | Map art and marker data (see Credits) |
| `docs/` | Architecture, map viewer and data, sync options, deployment |

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design, [docs/DATA.md](docs/DATA.md) for the route format and how to add a phase, and [docs/DEPLOY.md](docs/DEPLOY.md) for releasing.

## Contributing

Corrections to the route are very welcome. Open an issue with the step, what is wrong and a link to a source, or send a pull request. Please only add game facts you can verify, run `npm run check` and `npm test`, and keep the code in the existing style. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

The base-game route follows the community [Elden Ring 100% Achievement Guide by ponkberry](https://steamcommunity.com/sharedfiles/filedetails/?id=2785187510) on Steam. Shadow of the Erdtree facts were checked against the Elden Ring wiki. Icons, trophy medals and the map marker glyphs are original drawings. The Map tab uses map images made from in-game map screenshots and marker data from MapGenie's public data (see `docs/MAP-DATA.md`); that artwork belongs to its owners and is used here in an unofficial fan project. The map images are the shared maps by Eziolambo on Reddit ([Lands Between and underground](https://www.reddit.com/r/Eldenring/comments/tyn3f8/elden_ring_map_1623_mb_and_underground_920_kb/), [Shadow of the Erdtree](https://www.reddit.com/r/Eldenring/comments/1dthvpe/high_quality_elden_ring_sote_dlc_map_all_grace/)).

## Disclaimer

Unofficial fan project. It is not affiliated with or endorsed by FromSoftware, Bandai Namco or Sony. Elden Ring and related names, characters and artwork, including the in-game map art shown in the Map tab, are trademarks and copyrights of their owners.

## License

The code is [MIT licensed](LICENSE). The license does not cover third-party material: Elden Ring and Shadow of the Erdtree are the property of FromSoftware and Bandai Namco, the map images are by Eziolambo (see above), and the marker data comes from community sources. Those belong to their owners and are used here in an unofficial fan project.
