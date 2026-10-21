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

## Maximized view and navigation

- **Maximize** (button, or `M`): the map card becomes a fixed dialog that fills the browser window (`#mapCard.fs`). It does not use the browser Fullscreen API, so users can still put the browser itself in full screen. `Esc`, the Restore button and the browser Back button all close it. The page behind is `inert`, scroll is locked, Tab is trapped and focus returns to the button.
- **Phones**: the toolbar wraps into rows, zoom controls move to the bottom right, and the marker filters and details open as bottom sheets. The overview hides while a sheet is open. Safe-area insets are respected.
- **Tablets and laptops**: a single toolbar row, the marker filters dock as a 340px column, the details card sits top left and the legend floats at the bottom.
- **Overview**: a small canvas copy of the art with a box for the current view. Tap or drag it to move the map. The map-controls button hides it. It never takes more than 30% of the stage height.
- **Place names**: `js/data/map-places.js` lists `[label, x, y, tier]` per layer in image pixels. Tier 1 names show over the whole map, tier 2 appear when zoomed in. They are drawn in their own pane above the marker dots and below the route pins.
- **Go to**: a native select built from the same list, plus "Whole map".
- **Keys**: `M` maximize, `/` search, `Esc` close, plus and minus zoom, arrows pan.

## What is saved and synced

Found markers and the marker filter choices (show markers, selected categories, hide found, route phases) live in the main store (`js/lib/store.js`), not in the map module, so they follow the same rules as ticks:

- Each found marker is `[0|1, timestamp]`, merged newest-wins per marker. Un-finding a marker is a newer record, so it also syncs.
- The filter choices are one record with a timestamp; the newest device wins.
- Both are in the gist snapshot (`found`, `mapPrefs`), in file backups, and are cleared by Reset progress.
- Layout choices (filter panel open, collapsed groups, last view, overview on or off) stay on each device.
- Older installs that kept `tarnished-ledger:map-found` and the filter in `tarnished-ledger:map-filter` are migrated once with timestamp 1, so anything another device already decided wins.

## Marker icons

Every category has its own icon in `js/data/map-icons.js` (`[glyph, colour]`), and the shapes are original vector paths in `js/ui/map-glyphs.js`. Characters (person, merchant, ghost, trainer, invasion) share the person shape and differ by colour; everything else has its own shape, such as a padlock for imp seal statues, a bell for bell bearings, a castle for legacy dungeons or a heart for dragon hearts. A test checks that no two categories share the same glyph and colour. To add a shape, add a path to `D` in `map-glyphs.js` and point a category at it.

## Wording, route links and progress

- **Wording**: `js/data/map-verbs.js` picks the words by what a marker is: bosses and enemies say *Mark defeated / Defeated*, items, gear, materials and key items say *Mark picked up / Picked up*, graces and landmarks say *discovered*, dungeons and evergaols say *cleared*, imp seal statues say *opened*, characters say *met*, and puzzles and quests say *done*. Add an exception by category id in `BY_CAT`.
- **Linked to the route**: a marker is done when you tick it on the map or when a route step that covers it is ticked. `STEP_LOCS` is the main table. Trophies, legendary items and DLC goals are linked through the step that completes them (`TROPHY_LOCS`, `COLLECT_LOCS`, `GOAL_LOCS`). Ticking a marker that is the only one a step covers (one boss, one item) also ticks that step, and unticking undoes it; steps that cover several markers are never ticked from the map.
- **Progress section** under the map (closed by default, so the map fills the screen): counts and lists per category, "Essentials" (graces, bosses, route items) or every marker, with *Yet to defeat / pick up / discover* and the finished ones. Tapping an item flies to it. The same section has the route phase list on a second tab. `summarize()` in `js/ui/map-progress.js` is pure and unit tested.

## Route steps on the map

- Selecting a numbered pin, a phase in the Route phases tab, or "Show phase on map" on the Route tab shows that phase's checklist: in the sheet when the map is maximized, and as a card under the map otherwise (the sheet then only has a short header and a "Steps below" button, so the map keeps the screen).
- Steps are real checkboxes: ticking one is the same as ticking it in the route, so the progress, trophies and every marker it covers update at once.
- Steps that have markers get a **Show** button. One marker opens its details with a "Back to phase steps" button; several are framed together. The phase's markers are ringed on the map even when their category is switched off.
- Prev and Next walk the route phase by phase and fly to each pin.
- A marker's sheet lists the route steps that cover it as tickable rows. On the Route tab, steps with markers have a **Show on map** button.

## Sharp tiles

`assets/map/tiles/` holds a tile pyramid per map. The one-piece `assets/map/*.webp` always loads first, so there is something to look at immediately. When you zoom in, the tile layer fetches only the visible 512px tiles at the level that matches the zoom, and the blurrier picture shows underneath until each tile arrives. Tiles are served cache-first by the service worker (they never change under the same name), so a place you have looked at stays available offline. Surface 3 levels (up to 7544 px wide), underground and the Realm of Shadow 2 levels. To change the images, rebuild with `scripts/calibrate/hires.py` and bump the cache name in `sw.js`.

## Roundtable Hold

The base-game Roundtable Hold has no part of the world map, so it is its own layer (`hub`, the third button next to Surface and Underground). MapGenie files its 126 markers under region 1333, and `scripts/build-map-data.mjs` writes them to `assets/map/data/hub.json`. No public floor plan exists, so there is no fitted art: `assets/map/hub.svg` is a plain original backdrop and the calibration in `js/data/map-calib.js` (`hub`) only spreads MapGenie's positions across it (22,000,000 px per Web Mercator unit, 90px margin). Positions are relative to each other, not to any room. The layer always shows everything in it, whatever the category filters say. The Nightreign hub is a different place and is not used.

## Twin steps, counters and skipped path steps

- `js/data/twins.js` lists route steps that are the same fact in two places (Radahn and Mohg in the base route and in D1). Ticking one ticks the other, and merges settle each pair by the newer timestamp. Ticking the boss on the map reaches both through the markers they share.
- Finding a Scadutree Fragment or Revered Spirit Ash on the map adds 1 to its Goals counter, and un-finding takes 1 off. The counter can still be set by hand.
- `PATH_SKIP` in `js/data/map-guide.js` lists steps that stay linked (Show on map, ticking) but are not drawn as a stop on the route, such as a vague "head toward the castle" step that would send the line the wrong way.

## Installed iPhone/iPad app (top of the page)

`index.html` sets `html.ios-pwa` before first paint when the page runs from the Home Screen (`navigator.standalone === true`, or the standalone display mode on an Apple touch device). Only then does `--top-inset` become the safe-area inset plus a 20px `--pwa-gap`, which moves the page content (`.shell`), the solid strip behind the status bar, the skip link, the sidebar and the maximized map's toolbar below the status area. In a browser tab or on a desktop the class is absent, `--top-inset` is just the safe-area inset (0), and nothing changes. If the title still looks soft in the installed app, change the 20px in `html.ios-pwa` in `css/styles.css`. After an update, fully close and relaunch the app while online; if it still shows the old layout, remove it from the Home Screen and add it again from Safari.
