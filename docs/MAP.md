# Map viewer

The Map tab is a zoomable image map built on Leaflet 1.9.4 (BSD-2, vendored in `vendor/leaflet/`). Leaflet, the map data and the images load the first time the tab opens, so the other tabs pay nothing for it.

## Pieces

| File | Role |
|---|---|
| `js/ui/map.js` | Tab controller: `renderMap()` and `initMap()` (called by `js/app.js`), layer and world switching, filter panel, search, detail sheet, route phase pins, Find me |
| `js/ui/map-canvas.js` | One canvas for all markers: viewport culling, cached glyph sprites, dots when zoomed out, tap hit-testing |
| `js/ui/map-glyphs.js` | Original vector glyphs per `glyph` key and their colours |
| `js/ui/map-data.js` | Imports the data modules, projects markers to image pixels, builds lookups |
| `js/ui/map-state.js` | localStorage: filters, last view per layer, found markers |

## Coordinates

Each layer is one image shown with `L.CRS.Simple` and `L.imageOverlay`. A pixel `(x, y)` is the Leaflet point `lat = -y, lng = x`. Zoom 0 is one image pixel per screen pixel; the minimum zoom is "whole image fits" and is recomputed when the container resizes. Zoom is fractional (`zoomSnap: 0`).

Markers carry real map latitude and longitude in the data. At load, `project(layer, sub, lat, lng)` from `js/data/map-calib.js` turns them into image pixels. Never project at draw time.

## Data contract

- `js/data/map-calib.js`: `CALIB = { base, under, dlc }`, each `{ img, w, h, t: { subKey: [a,b,c,d,e,f] } }`, and `project(mapKey, sub, lat, lng) -> [px, py]` (sub is `_` when the layer has no sub-maps). The affine maps normalised Web Mercator `xm = (lng+180)/360`, `ym = (1 - ln(tan(lat) + 1/cos(lat))/PI)/2` to pixels: `px = a*xm + b*ym + c`, `py = d*xm + e*ym + f`.
- `js/data/map-categories.js`: `GROUPS = [{ id, title }]` in display order and `CATS = [{ id, title, group, glyph, guide }]`. `guide: true` categories are the default "Guide only" set. An optional `color` overrides the glyph colour.
- `js/data/map-markers.js`: `MARKERS = [[id, categoryId, lat, lng, title, layer, sub, note?], ...]` with `layer` of `base`, `under` or `dlc`. A default export that is a constant or an (async) function is accepted too.
- `js/data/map-guide.js`: `STEP_LOCS` (route step id to marker ids), `PHASE_FOCUS` (phase id to one marker id, where the numbered pin sits), plus `TROPHY_LOCS`, `COLLECT_LOCS`, `GOAL_LOCS` for future use. Location ids are marker ids. The module is optional: without it the pins and Show step buttons are simply absent.

Markers whose category, layer or projection is invalid are skipped silently.

## Behaviour notes

- Worlds follow `scope()` from `js/lib/model.js`: base scope shows only the Lands Between, dlc scope only the Realm of Shadow, both shows a switch. Inside the Lands Between a Surface and Underground switch swaps the image.
- Filters: master switch, presets, per-category checkboxes with live counts for the current layer, Hide found, Route phases. Saved under `tarnished-ledger:map-filter`. Found markers are saved under `tarnished-ledger:map-found` (one array of ids, not synced). The last view per layer is saved under `tarnished-ledger:map-view`.
- The chosen world and Surface or Underground layer are saved with the filters. If a layer image fails to load, the stage shows a message with a retry button and the rest of the map keeps working; if the data or Leaflet fail to load, the same panel offers a full retry.
- Touch devices get a custom double-tap zoom; mouse double-click is Leaflet's.
- Taps use generous hit tolerance (larger on coarse pointers). Search ignores filters and shows the match even when its category is off.
- Route steps can open the map with `emit("locate", stepId)` (from `js/lib/dom.js`). The map handles it by selecting the step's first in-scope location. The Show step buttons in the marker sheet do the reverse with `emit("jump", stepId)`.
- Reduced motion turns off inertia and fly-to animation. Keyboard: focus the map, arrows pan, plus and minus zoom. Markers on the canvas are not individually focusable; search is the keyboard route to a marker.

## Add a category

1. Add it to `CATS` in `js/data/map-categories.js` with an existing `glyph` key and a `group` id from `GROUPS`.
2. Use its id as the second field of marker rows.

The filter panel and legend are built from `CATS`, so nothing else changes.

## Add a glyph

Add a path in a `[-1, 1]` box to `D` in `js/ui/map-glyphs.js` and a colour in `COLORS`. Use `M ... Z` subpaths for holes; fills use the even-odd rule.

## Add a layer

1. Add the image and `t` affine(s) to `CALIB` under a new key, and use that key as `layer` in the markers.
2. In `js/ui/map.js` add it to `LAYER_NAME`, `mode()` and the controls in `index.html`, and to `byLayer` in `map-data.js`.

## Developing without the real data

Open the site with `?mapdebug` to expose `window.__tlMap()` (the Leaflet map, canvas layer and current filter state) for tests.

## Service worker

`sw.js` precaches the viewer modules and the vendored Leaflet files. The map data modules and images are fetched on first open and cached by the network-first handler. Add the data modules to `SHELL` when they land, and bump `CACHE`.

## Fit, sub-maps and defaults

- `CONTENT` in `js/ui/map.js` holds the non-black region of each image (measured from the art). Fit, minimum zoom and pan bounds use it, and the stage height follows its aspect ratio. Update it when an image changes.
- `SUBS` holds the Ainsel, Siofra (including Mohgwyn Palace) and Deeproot rectangles for the jump buttons on the Underground layer.
- Markers that project outside the image are dropped when loading, so they never render and never get a route pin.
- Default markers ("Essentials"): guide categories in the Route items and Bosses groups plus sites of grace. "Guide" is every `guide: true` category. Markers are dots when zoomed out and glyphs when zoomed in. Ids are strings throughout the viewer.
- Debug hook: `?mapdebug` exposes `window.__tlMap()`.
