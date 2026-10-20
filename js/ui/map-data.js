// Loads the map data modules (calibration, categories, markers, guide mapping) and builds lookups.
// With ?mapdev in the URL it uses the stand-in fixture in js/dev/ instead of the real data.
import { COLORS } from "./map-glyphs.js";

const dev = /[?&]mapdev\b/.test(location.search);
const pick = (m, k) => m[k] ?? m.default?.[k] ?? m.default;

export async function loadMapData() {
  let calib, project, groups, cats, markers, guide = {};
  if (dev) {
    const f = await import("../dev/map-fixture.js");
    ({ CALIB: calib, project, GROUPS: groups, CATS: cats, GUIDE: guide, MARKERS: markers } = f);
  } else {
    const [a, b, c] = await Promise.all([import("../data/map-calib.js"), import("../data/map-categories.js"), import("../data/map-markers.js")]);
    calib = pick(a, "CALIB"); project = a.project; groups = b.GROUPS; cats = b.CATS;
    markers = pick(c, "MARKERS");
    if (typeof markers === "function") markers = await markers();
    guide = await import("../data/map-guide.js").catch(() => ({}));
  }
  const catById = new Map(cats.map((c) => [c.id, { ...c, color: c.color || COLORS[c.glyph] || COLORS.misc }]));
  const list = [];
  const byId = new Map();
  const byLayer = { base: [], under: [], dlc: [] };
  for (const [id, cat, lat, lng, title, layer, sub, note] of markers) {
    const c = catById.get(cat);
    if (!c || !byLayer[layer] || !calib[layer]) continue;
    const [x, y] = project(layer, sub || "_", lat, lng);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const m = { id, cat, title, layer, sub, note, x, y, glyph: c.glyph, color: c.color };
    list.push(m);
    byId.set(id, m);
    byLayer[layer].push(m);
  }
  const stepsOf = new Map();
  for (const [step, locs] of Object.entries(guide.STEP_LOCS || {})) for (const l of locs) (stepsOf.get(l) || stepsOf.set(l, []).get(l)).push(step);
  return { calib, groups, cats: [...catById.values()], catById, list, byId, byLayer, stepsOf, stepLocs: guide.STEP_LOCS || {}, focus: guide.PHASE_FOCUS || {}, dev };
}
