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
  const catById = new Map(cats.map((c) => [c.id, { ...c, color: c.color || COLORS[c.glyph] || COLORS.misc }]));
  const list = [];
  const byId = new Map();
  const byLayer = { base: [], under: [], dlc: [] };
  for (const [id, cat, lat, lng, title, layer, sub, note, wiki] of rows) {
    const c = catById.get(cat);
    if (!c || !byLayer[layer] || !calib[layer]) continue;
    const [x, y] = project(layer, SUB[sub] || sub || "_", lat, lng);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const m = { id, cat, title, layer, sub, note, wiki, x, y, glyph: c.glyph, color: c.color };
    list.push(m);
    byId.set(id, m);
    byLayer[layer].push(m);
  }
  const stepsOf = new Map();
  for (const [step, locs] of Object.entries(guide.STEP_LOCS || {})) for (const l of locs) (stepsOf.get(l) || stepsOf.set(l, []).get(l)).push(step);
  return { calib, groups, cats: [...catById.values()], catById, list, byId, byLayer, stepsOf, stepLocs: guide.STEP_LOCS || {}, focus: guide.PHASE_FOCUS || {} };
}
