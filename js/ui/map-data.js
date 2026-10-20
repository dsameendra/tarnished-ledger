// Loads the map data modules (calibration, categories, markers, guide mapping) and builds lookups.
import { COLORS } from "./map-glyphs.js";

// Mohgwyn Palace markers are filed under the Siofra region but share its sub-map transform.
const SUB = { mohgwyn: "siofra" };

export async function loadMapData() {
  const [a, b, c, guide] = await Promise.all([
    import("../data/map-calib.js"), import("../data/map-categories.js"), import("../data/map-markers.js"),
    import("../data/map-guide.js").catch(() => ({})),
  ]);
  const { CALIB: calib, project } = a;
  const { GROUPS: groups, CATS: cats } = b;
  const rows = (await Promise.all(Object.keys(c.MARKER_FILES).map((l) => c.loadMarkers(l)))).flat();
  // Ids are numbers in the data files; the DOM hands them back as strings, so everything is keyed by string.
  const catById = new Map(cats.map((c) => [String(c.id), { ...c, id: String(c.id), color: c.color || COLORS[c.glyph] || COLORS.misc }]));
  const list = [];
  const byId = new Map();
  const byLayer = { base: [], under: [], dlc: [] };
  for (const [id, cat, lat, lng, title, layer, sub, note, wiki] of rows) {
    const c = catById.get(String(cat));
    if (!c || !byLayer[layer] || !calib[layer]) continue;
    const [x, y] = project(layer, SUB[sub] || sub || "_", lat, lng);
    // Markers that project outside the image (for example Roundtable Hold) are never drawn.
    if (!(x >= 0 && y >= 0 && x <= calib[layer].w && y <= calib[layer].h)) continue;
    const m = { id: String(id), cat: String(cat), title, layer, sub, note, wiki, x, y, glyph: c.glyph, color: c.color };
    list.push(m);
    byId.set(m.id, m);
    byLayer[layer].push(m);
  }
  const stepsOf = new Map();
  for (const [step, locs] of Object.entries(guide.STEP_LOCS || {})) for (const l of locs) (stepsOf.get(String(l)) || stepsOf.set(String(l), []).get(String(l))).push(step);
  return { calib, groups, cats: [...catById.values()], catById, list, byId, byLayer, stepsOf, stepLocs: Object.fromEntries(Object.entries(guide.STEP_LOCS || {}).map(([k, v]) => [k, v.map(String)])), focus: Object.fromEntries(Object.entries(guide.PHASE_FOCUS || {}).map(([k, v]) => [k, String(v)])) };
}
