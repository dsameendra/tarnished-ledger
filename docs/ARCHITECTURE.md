# Architecture

A static site with no build step: ES modules, `localStorage`, a service worker.

- `index.html`: shell with a side rail (>= 980px) or bottom nav, and the tab sections `route, tro, col, map, guide, set`.
- `js/app.js`: boots everything and routes store events (`marks`, `counters`, settings) to the right renderers. Appearance settings only repaint; `platform`, `dlc` and `focus` re-render everything.
- `js/lib/`: `store.js` (state under `tarnished-ledger:v2`, validation and merge logic), `sync.js` (gist sync), `model.js` (merged phases, scope logic, derived counts), `icons.js`, `wake.js` (screen wake lock, calls are queued), `dom.js` (event bus), `labels.js`.
- `js/ui/`: one module per tab, plus `rail.js` and `nav.js`. The map only draws while its tab is visible.
- `js/data/`: route, trophies, map, links, guide, and the DLC files `dlc-route.js` and `dlc-goals.js`.
- `sw.js`: cache-first of same-origin files and Google Fonts. Never touches api.github.com. Details below.

## State and safety
- `store.load()` rebuilds state from `localStorage`. Marks, counters and settings are validated on load and on every merge or import (shape, known ids, value ranges), so a hand-edited save or a bad remote file cannot break rendering. An unreadable save is copied to `tarnished-ledger:v2:corrupt` before anything overwrites it.
- Strings from storage, backups and the gist are never put into `innerHTML`. Everything that is rendered as HTML comes from the static data files.
- A failed write (quota, private mode) sets a flag that shows "Not saving" in the UI; the next successful write clears it.

## Service worker
- Cache first from the versioned cache (`CACHE`), no background revalidation, so startup never waits on the network and all files of one page load come from one version (the map loads modules lazily, so mixing would be possible otherwise). Measured with 6 s of injected latency: first step rendered after 30 s with the old network-first worker, 56 ms now. Files not in the cache (first use of a font) go to the network and are kept.
- Updates arrive through `sw.js` itself. A new worker installs its cache and waits (no `skipWaiting` on install, so a running page is never switched under its own lazy imports). `js/lib/update.js` shows "A new version is ready" with a button that sends `skipWaiting` and reloads on `controllerchange`; ignoring it is safe, the new version starts once all windows are closed. Navigations use `ignoreSearch`.
- `SHELL_HASH` in `sw.js` is a content hash of `SHELL` and `MAP_PACK` (`scripts/shell-hash.mjs`). `npm run bump` updates it and increments `CACHE`; `npm run check` and `test/sw.test.mjs` fail when it is stale.
- Only caches whose name starts with `tarnished-ledger-` are deleted on activate, because every project site under `github.io` shares one origin.
- Opaque (no-CORS) responses are kept for the font hosts only.
- Add new files to `SHELL` and run `npm run bump` on each release. `npm run check` fails if `SHELL` and the shipped files differ.
- All paths are relative, so the app works under `/tarnished-ledger/`.

## Scope
`model.scope()` returns `base`, `both` or `dlc` from the `dlc` and `focus` settings. Only in-scope phases render, and counts follow the scope. In `dlc` scope the Legendary tab is hidden, Trophies becomes Goals, and the map shows only the Realm of Shadow.

## Map
See [MAP.md](MAP.md) for the Leaflet viewer, its data contract and how to extend it.

## Checks and tests
- `npm run check` (`scripts/check.mjs`): route data (ids, kinds, trophy/collectible/goal keys, duplicate step text, map pins), counters against the store and model, every `SHELL` file exists and every shipped file is listed, `index.html` links and the ids looked up with `$("...")`, manifest paths, icon sizes and theme colour.
- `npm test` (`node --test`): `test/store*.test.mjs` for merge, import, migration and corrupt data; `test/sync.test.mjs` for sync against a fake GitHub API (`test/helpers.mjs`), including races, errors and timers.
- CI (`.github/workflows/ci.yml`) runs both on every push to `main` and every pull request.
