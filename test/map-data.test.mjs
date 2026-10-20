import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATS, GROUPS, GLYPHS, DEFAULT_VISIBLE } from "../js/data/map-categories.js";
import { MARKER_COUNTS } from "../js/data/map-markers.js";
import { STEP_LOCS, PHASE_FOCUS } from "../js/data/map-guide.js";
import { PHASES } from "../js/data/route.js";
import { DLC_PHASES } from "../js/data/dlc-route.js";

const load = (l) => JSON.parse(readFileSync(new URL(`../assets/map/data/${l}.json`, import.meta.url), "utf8"));
const data = { base: load("base"), under: load("under"), dlc: load("dlc") };
const all = Object.values(data).flat();
const catIds = new Set(CATS.map((k) => k.id));

test("categories are well formed", () => {
  assert.equal(catIds.size, CATS.length, "duplicate category id");
  const groups = new Set(GROUPS.map((g) => g.id));
  for (const k of CATS) {
    assert.ok(groups.has(k.group), `${k.id} group`);
    assert.ok(GLYPHS.includes(k.glyph), `${k.id} glyph ${k.glyph}`);
    assert.ok(k.title, `${k.id} title`);
    assert.equal(typeof k.guide, "boolean");
  }
  assert.ok(DEFAULT_VISIBLE.length > 5 && DEFAULT_VISIBLE.length < CATS.length);
});

test("markers: counts, unique ids, known categories, no empty titles", () => {
  for (const [l, rows] of Object.entries(data)) assert.equal(rows.length, MARKER_COUNTS[l]);
  assert.equal(new Set(all.map((r) => r[0])).size, all.length, "duplicate marker ids");
  for (const r of all) {
    assert.ok(catIds.has(r[1]), `marker ${r[0]} category ${r[1]}`);
    assert.ok(typeof r[4] === "string" && r[4].trim(), `marker ${r[0]} title`);
    if (r[7]) assert.ok(r[7].length <= 160, `marker ${r[0]} note length`);
  }
});

test("markers: coordinates, layers and sub-maps", () => {
  const SUB = ["_", "ainsel", "siofra", "mohgwyn", "deeproot"];
  for (const [layer, rows] of Object.entries(data)) {
    for (const r of rows) {
      assert.equal(r[5], layer);
      assert.ok(SUB.includes(r[6]), `marker ${r[0]} sub ${r[6]}`);
      assert.equal(r[6] === "_", layer !== "under", `marker ${r[0]} sub/layer`);
      const [lat, lng] = [r[2], r[3]];
      assert.ok(lat > 0.26 && lat < 0.92 && lng > -1.13 && lng < -0.5, `marker ${r[0]} out of range ${lat},${lng}`);
      if (layer === "dlc") assert.ok(lat > 0.57 && lat < 0.75 && lng > -0.77 && lng < -0.63, `dlc marker ${r[0]} range`);
      if (layer === "under") assert.ok(lat < 0.45, `under marker ${r[0]} lat`);
      assert.equal(Math.round(lat * 1e6) / 1e6, lat);
    }
  }
});

test("no exact duplicate markers", () => {
  const seen = new Set();
  for (const r of all) {
    const k = [r[1], r[4], r[2], r[3], r[5]].join("|");
    assert.ok(!seen.has(k), `duplicate ${k}`);
    seen.add(k);
  }
});

test("every legendary item exists once in its route category", () => {
  for (const [cat, n] of [[90001, 9], [90002, 6], [90003, 7], [90004, 8]]) assert.equal(all.filter((r) => r[1] === cat).length, n, `category ${cat}`);
});

test("guide links point at existing markers and cover every phase", () => {
  const ids = new Set(all.map((r) => r[0]));
  for (const v of Object.values(STEP_LOCS).flat()) assert.ok(ids.has(v), `STEP_LOCS ${v}`);
  for (const p of [...PHASES, ...DLC_PHASES]) {
    assert.ok(ids.has(PHASE_FOCUS[p.id]), `phase ${p.id} focus`);
    p.s.forEach((_, i) => { const k = `${p.id}.${i}`; if (STEP_LOCS[k]) assert.ok(STEP_LOCS[k].length > 0); });
  }
  for (const k of Object.keys(STEP_LOCS)) assert.ok(PHASES.concat(DLC_PHASES).some((p) => k.startsWith(p.id + ".")), k);
});

test("transferred size stays small", () => {
  const bytes = all.reduce((n, r) => n + JSON.stringify(r).length, 0);
  assert.ok(bytes < 1_500_000);
});

test("every map category has its own icon: a known glyph and a unique glyph + colour pair", async () => {
  const { CATS } = await import("../js/data/map-categories.js");
  const { ICONS } = await import("../js/data/map-icons.js");
  const { GLYPHS } = await import("../js/ui/map-glyphs.js");
  const seen = new Map();
  for (const c of CATS) {
    const ic = ICONS[c.id];
    assert.ok(ic, `category ${c.id} (${c.title}) has no icon`);
    assert.ok(GLYPHS.includes(ic[0]), `${c.title}: unknown glyph ${ic[0]}`);
    assert.match(ic[1], /^#[0-9a-f]{6}$/i, `${c.title}: bad colour`);
    const key = ic.join("|").toLowerCase();
    assert.ok(!seen.has(key), `${c.title} and ${seen.get(key)} share the same icon`);
    seen.set(key, c.title);
  }
  for (const id of Object.keys(ICONS)) assert.ok(CATS.some((c) => String(c.id) === id), `icon for unknown category ${id}`);
});
