# Map data

Marker data comes from the public MapGenie API (map 413 "The Lands Between", map 638 "Realm of Shadow"), used for this fan project at the owner's request. The raw JSON is not committed.

## Files

| File | What |
|---|---|
| `js/data/map-categories.js` | `GROUPS`, `CATS`, `DEFAULT_VISIBLE`, `GLYPHS`. Hand-curated. |
| `assets/map/data/{base,under,dlc}.json` | Marker rows, one file per layer (about 147 KB gzipped in total). Generated. |
| `js/data/map-markers.js` | Generated manifest: `MARKER_FILES`, `MARKER_COUNTS`, field index `F`, `loadMarkers(layer)`. |
| `js/data/map-guide.js` | Guide to map links: `STEP_LOCS`, `PHASE_FOCUS`, `TROPHY_LOCS`, `COLLECT_LOCS`, `GOAL_LOCS`. Hand-reviewed. |
| `scripts/build-map-data.mjs` | Builds the generated files. |

## Marker row

`[id, categoryId, lat, lng, title, layer, sub, note?, wiki?]`

- `id`: MapGenie location id (unique across layers).
- `lat`, `lng`: MapGenie's own coordinate space, 6 decimals. The overworld sits at lat 0.54-0.92, lng -0.83..-0.59; the underground maps at lat 0.26-0.45. The Realm of Shadow has its own space (lat 0.58-0.74, lng -0.77..-0.64). The map art has to be calibrated to these.
- `layer`: `base` (surface, map 413), `under` (Ainsel River, Siofra River, Deeproot Depths and Mohgwyn Palace) or `dlc` (map 638).
- `sub`: `_`, `ainsel`, `siofra`, `deeproot` or `mohgwyn`. MapGenie files Mohgwyn Palace under the Siofra River region; markers east of lng -0.66 in that region are split off as `mohgwyn`.
- `note`: short plain text (max 160 chars), only on guide categories, `""` when absent. Taken from the "Location" line of MapGenie's description.
- `wiki`: IGN wiki page slug (`https://www.ign.com/wikis/elden-ring/<slug>`), guide categories only, not for graces. Absent when MapGenie has none.

Trailing empty fields are omitted, so a row has 7, 8 or 9 entries.

## Categories

`CATS` entries are `{id, title, group, glyph, guide, virtual?, dlc?}`. `guide: true` means something in the route needs it, and these are visible by default. Ids 90001-90005 are virtual: the build script carves the 30 legendary items and the route key items (medallions, Academy Glintstone Key, Cursemark of Death, Discarded Palace Key and so on) out of Weapon, Spirit Ashes, Sorcery, Incantation, Talisman and Key Item by exact location id (`VIRTUAL_IDS`), asserting the title. Categories 11316-11318, 6026 and 6040 exist only in the Realm of Shadow and are named after their markers.

## Dropped

- 117 markers with no region or at lat > 0.92 (loot placed far outside the playable area, leftovers of dungeon interior tiles).
- No exact duplicates were found.
- Media, screenshots and long descriptions.

## Guide links

`STEP_LOCS` maps a step id (`phase.index`) to location ids; only steps that name a place, boss, item or grace are listed. `PHASE_FOCUS` gives every phase one representative pin. Each line in `map-guide.js` ends with the marker titles for review. Titles were matched by script, then each match was reviewed by hand against the marker's region and note. `npm run check` fails on any id missing from the markers and lists trophies without a location as a warning (platinum and God-Slaying Armament have no place).

## Rebuild

1. Download the two API responses (plain GET with `Accept: application/json`): `https://mapgenie.io/api/v1/maps/413/data` as `lands-between.json` and `https://mapgenie.io/api/v1/maps/638/data` as `realm-of-shadow.json`, into one folder.
2. `node scripts/build-map-data.mjs <folder>`
3. `npm run check && npm test`

The build fails if a virtual location id no longer has the expected title, so a changed upstream id cannot ship the wrong pin. Add new files to `SHELL` in `sw.js` and bump the cache name on release.

## Credit

The map images come from the maps shared by Eziolambo on Reddit: [Lands Between and underground](https://www.reddit.com/r/Eldenring/comments/tyn3f8/elden_ring_map_1623_mb_and_underground_920_kb/) and [Shadow of the Erdtree](https://www.reddit.com/r/Eldenring/comments/1dthvpe/high_quality_elden_ring_sote_dlc_map_all_grace/). Keep this credit visible in the Map tab, Settings, About and the README.
