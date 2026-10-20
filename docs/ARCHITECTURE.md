# Architecture

A static site with no build step: ES modules, `localStorage`, a service worker.

- `index.html`: shell with a side rail (>= 980px) or bottom nav, and the tab sections `route, tro, col, map, guide, set`.
- `js/app.js`: boots everything and routes store events (`marks`, `counters`, settings) to the right renderers.
- `js/lib/`: `store.js` (state under `tarnished-ledger:v2`, merge logic), `sync.js` (gist sync), `model.js` (merged phases, scope logic, derived counts), `icons.js`, `wake.js`, `dom.js` (event bus), `labels.js`.
- `js/ui/`: one module per tab, plus `rail.js` and `nav.js`.
- `js/data/`: route, trophies, map, links, guide, and the DLC files `dlc-route.js` and `dlc-goals.js`.
- `sw.js`: network-first cache of same-origin files and Google Fonts. Never touches api.github.com. Add new files to `SHELL` and bump `CACHE` on each release.

## Scope
`model.scope()` returns `base`, `both` or `dlc` from the `dlc` and `focus` settings. Only in-scope phases render, and counts follow the scope. In `dlc` scope the Legendary tab is hidden, Trophies becomes Goals, and the map shows the DLC graph.

## Checks
`npm run check` validates the route data. `npm test` unit-tests the store merge logic.
