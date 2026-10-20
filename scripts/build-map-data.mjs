// Builds the compact marker files from the raw MapGenie API responses.
//   node scripts/build-map-data.mjs <dir with lands-between.json and realm-of-shadow.json>
// Writes assets/map/data/{base,under,dlc}.json and js/data/map-markers.js (a manifest and loader).
// The raw JSON is not committed. See docs/MAP-DATA.md.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATS, CAT_BY_ID } from "../js/data/map-categories.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2];
if (!src) { console.error("usage: node scripts/build-map-data.mjs <raw-json-dir>"); process.exit(2); }
const read = (f) => JSON.parse(readFileSync(join(src, f), "utf8"));
const lands = read("lands-between.json");
const shadow = read("realm-of-shadow.json");

// MapGenie region ids (map 413) that sit underground, and which sub-map they belong to.
const UNDER = { 1349: "ainsel", 1334: "siofra", 1350: "deeproot" };
// Mohgwyn Palace is filed under the Siofra River region by MapGenie. Its markers sit at the east end
// of that region, from this longitude on. Verified against the graces (Cocoon of the Empyrean and
// Dynasty Mausoleum are east of it, Worshippers' Woods and Below The Well are west).
const MOHGWYN_LNG = -0.66;

// Route items carved out of bigger MapGenie categories: [location id, expected title].
// The title is asserted so a changed upstream id fails the build instead of shipping the wrong pin.
const VIRTUAL_IDS = {
  90001: [[164813, "Grafted Blade Greatsword"], [166764, "Sword of Night and Flame"], [167907, "Ruins Greatsword"], [166820, "Marais Executioner's Sword"], [169162, "Bolt of Gransax"], [167294, "Eclipse Shotel"], [169002, "Golden Order Greatsword"], [169010, "Devourer's Scepter"], [167891, "Dark Moon Greatsword"]],
  90002: [[165318, "Lhutel the Headless"], [168255, "Redmane Knight Ogha"], [167634, "Mimic Tear Ashes"], [167674, "Ancient Dragon Knight Kristoff Ashes"], [168059, "Black Knife Tiche"], [167679, "Cleanrot Knight Finlay Ashes"]],
  90003: [[166816, "Flame of the Fell God"], [169246, "Greyoll's Roar"], [167814, "Comet Azur"], [169050, "Stars of Ruin"], [168441, "Elden Stars"], [168058, "Ranni's Dark Moon"], [168642, "Founding Rain of Stars"]],
  90004: [[165702, "Radagon Icon"], [166506, "Radagon's Soreseal"], [167647, "Godfrey Icon"], [168606, "Moon of Nokstella"], [169301, "Marika's Soreseal"], [169295, "Dragoncrest Greatshield Talisman"], [169443, "Old Lord's Talisman"], [168184, "Erdtree's Favor +2"]],
  90005: [[164496, "Dectus Medallion (Left)"], [166653, "Dectus Medallion (Right)"], [167191, "Haligtree Secret Medallion (Right)"], [167291, "Haligtree Secret Medallion (Left)"], [167202, "Rold Medallion"], [165269, "Academy Glintstone Key"], [169305, "Cursemark of Death"], [176421, "Discarded Palace Key"], [177447, "Dark Moon Ring"], [170239, "Fingerslayer Blade"], [169052, "Miniature Ranni"], [180903, "Carian Inverted Statue"], [170409, "Sellian Sealbreaker"], [176810, "Miquella's Needle"],
    // Realm of Shadow
    [381743, "Messmer's Kindling"], [384124, "Igon's Furled Finger"], [381972, "Heart of Bayle"]],
};
const virtualOf = new Map();
for (const [cat, list] of Object.entries(VIRTUAL_IDS)) for (const [id, title] of list) virtualOf.set(id, { cat: +cat, title });

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const NOTE_MAX = 160;
// Plain-text note from MapGenie's markdown: the "Location" line if there is one, else the first line.
// Links and bold are stripped; loot lists, utility and tips are left out.
function note(desc) {
  if (!desc) return "";
  let t = String(desc).replace(/\[((?:[^\[\]]|\[[^\]]*\])*)\]\([^)]*\)/g, "$1").replace(/\*\*|__/g, "");
  const m = t.match(/Location:\s*([^\n]*)/i);
  if (m && m[1].trim()) t = m[1];
  else t = t.split("\n").find((x) => x.trim()) || "";
  t = clean(t.replace(/^\s*[-*]\s+/gm, "").replace(/\bhttps?:\/\/\S+/g, ""));
  if (t.length > NOTE_MAX) t = t.slice(0, NOTE_MAX - 1).replace(/\s+\S*$/, "") + "…";
  return t;
}

const stats = { dropped: [], dup: 0, unknownCat: new Set() };
const out = { base: [], under: [], dlc: [] };
const seen = new Set();
const r6 = (n) => Math.round(+n * 1e6) / 1e6;

function add(l, mapId) {
  const v = virtualOf.get(l.id);
  const cat = v ? v.cat : l.category_id;
  const k = CAT_BY_ID[cat];
  if (!k) { stats.unknownCat.add(cat); return; }
  let title = clean(l.title);
  if (!title) { stats.dropped.push([l.id, "empty title"]); return; }
  if (v && title.toLowerCase() !== v.title.toLowerCase()) throw new Error(`id ${l.id}: expected "${v.title}", found "${title}"`);
  if (v) title = v.title; // canonical capitalisation
  let layer = "base", sub = "_";
  if (mapId === 638) layer = "dlc";
  else if (UNDER[l.region_id]) {
    layer = "under"; sub = UNDER[l.region_id];
    if (sub === "siofra" && +l.longitude > MOHGWYN_LNG) sub = "mohgwyn";
  } else if (l.region_id == null) {
    // Region-less markers sit far outside the playable area (latitude > 1.09): leftovers of dungeon
    // interior tiles that cannot be placed on the overworld. All are general loot.
    stats.dropped.push([l.id, "no region, off map"]); return;
  }
  if (layer === "base" && +l.latitude > 0.92) { stats.dropped.push([l.id, "off map"]); return; }
  const guideish = k.guide;
  const row = [l.id, cat, r6(l.latitude), r6(l.longitude), title, layer, sub];
  const n = guideish ? note(l.description) : "";
  const w = guideish && cat !== 5658 && l.ign_page_id ? String(l.ign_page_id) : "";
  if (n || w) row.push(n);
  if (w) row.push(w);
  const key = [cat, title, row[2], row[3], layer].join("|");
  if (seen.has(key)) { stats.dup++; return; }
  seen.add(key);
  out[layer].push(row);
}
for (const l of lands.locations) add(l, 413);
for (const l of shadow.locations) add(l, 638);
if (stats.unknownCat.size) throw new Error(`categories missing from map-categories.js: ${[...stats.unknownCat]}`);
// Every virtual id must have been found.
const found = new Set(Object.values(out).flat().map((r) => r[0]));
for (const id of virtualOf.keys()) if (!found.has(id)) throw new Error(`virtual location ${id} not found`);

const order = new Map(CATS.map((k, i) => [k.id, i]));
for (const rows of Object.values(out)) rows.sort((a, b) => order.get(a[1]) - order.get(b[1]) || a[0] - b[0]);

const dir = join(root, "assets/map/data");
mkdirSync(dir, { recursive: true });
const sizes = {};
for (const [layer, rows] of Object.entries(out)) {
  const text = "[\n" + rows.map((r) => JSON.stringify(r)).join(",\n") + "\n]\n";
  writeFileSync(join(dir, `${layer}.json`), text);
  sizes[layer] = { n: rows.length, bytes: text.length, gzip: gzipSync(text).length };
}

const counts = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]));
const js = `// Generated by scripts/build-map-data.mjs. Do not edit by hand. See docs/MAP-DATA.md.
// Marker row: [id, categoryId, lat, lng, title, layer, sub, note?, wiki?]
//   layer: base | under | dlc.  sub: _ | ainsel | siofra | mohgwyn | deeproot.
//   note: short plain text, only on guide categories ("" when absent).  wiki: IGN wiki page slug ("" when absent).
export const MARKER_FILES = ${JSON.stringify(Object.fromEntries(Object.keys(out).map((k) => [k, `assets/map/data/${k}.json`])))};
export const MARKER_COUNTS = ${JSON.stringify(counts)};
export const F = { id: 0, cat: 1, lat: 2, lng: 3, title: 4, layer: 5, sub: 6, note: 7, wiki: 8 };
const cache = new Map();
// Loads one layer ("base", "under" or "dlc") once and returns its rows.
export function loadMarkers(layer, base = new URL("../../", import.meta.url)) {
  if (!cache.has(layer)) {
    cache.set(layer, fetch(new URL(MARKER_FILES[layer], base)).then((r) => { if (!r.ok) throw new Error("markers " + layer + ": " + r.status); return r.json(); }));
  }
  return cache.get(layer);
}
`;
writeFileSync(join(root, "js/data/map-markers.js"), js);

const total = Object.values(sizes).reduce((a, s) => ({ n: a.n + s.n, bytes: a.bytes + s.bytes, gzip: a.gzip + s.gzip }), { n: 0, bytes: 0, gzip: 0 });
console.log(sizes, total);
console.log(`dropped ${stats.dropped.length}`, stats.dropped.slice(0, 3), `duplicates ${stats.dup}`);
