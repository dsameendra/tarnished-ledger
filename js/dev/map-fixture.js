// Development stand-in for the map data contract (calibration, categories, markers, guide mapping).
// Only loaded when the page URL contains ?mapdev. Never referenced by the service worker.
import { PHASES, stepById } from "../lib/model.js";

const SIZES = { base: [3600, 3600], under: [3000, 3000], dlc: [3200, 3200] };

function art(mapKey, w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  const hue = { base: 95, under: 260, dlc: 20 }[mapKey];
  x.fillStyle = `hsl(${hue} 18% 16%)`; x.fillRect(0, 0, w, h);
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    x.fillStyle = `hsla(${hue + rnd() * 50} 28% ${22 + rnd() * 20}% / .55)`;
    x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 80 + rnd() * 380, 60 + rnd() * 280, rnd() * 3, 0, 6.3); x.fill();
  }
  x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = 3; x.font = "bold 90px serif"; x.fillStyle = "rgba(255,255,255,.2)";
  for (let i = 0; i <= 8; i++) {
    x.beginPath(); x.moveTo(i * w / 8, 0); x.lineTo(i * w / 8, h); x.moveTo(0, i * h / 8); x.lineTo(w, i * h / 8); x.stroke();
    if (i < 8) x.fillText(String.fromCharCode(65 + i) + (i + 1), i * w / 8 + 20, i * h / 8 + 100);
  }
  x.fillStyle = "rgba(255,255,255,.3)"; x.font = "bold 160px serif";
  x.fillText("FIXTURE " + mapKey.toUpperCase(), w * 0.1, h * 0.5);
  return c.toDataURL("image/webp", 0.7);
}

const aff = (w, h) => [w, 0, 0, 0, h, 0];
export const CALIB = {};
for (const [k, [w, h]] of Object.entries(SIZES)) {
  CALIB[k] = { img: art(k, w, h), w, h, t: k === "under" ? { ainsel: aff(w, h), siofra: aff(w, h), deeproot: aff(w, h) } : { _: aff(w, h) } };
}

const xmOf = (lng) => (lng + 180) / 360;
const ymOf = (lat) => (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2;
export function project(mapKey, sub, lat, lng) {
  const [a, b, c, d, e, f] = CALIB[mapKey].t[sub] || CALIB[mapKey].t._;
  const xm = xmOf(lng), ym = ymOf(lat * Math.PI / 180);
  return [a * xm + b * ym + c, d * xm + e * ym + f];
}
const unproject = (px, py, w, h) => [Math.atan(Math.sinh(Math.PI * (1 - 2 * py / h))) * 180 / Math.PI, (px / w) * 360 - 180];

export const GROUPS = [{ id: "route", title: "Route" }, { id: "gear", title: "Gear" }, { id: "world", title: "World" }, { id: "extra", title: "Extras" }];
const G = [
  ["grace", "Sites of grace", "route", "grace", true], ["boss", "Bosses", "route", "boss", true], ["dungeon", "Dungeons", "route", "dungeon", true],
  ["key", "Key items", "route", "key", true], ["weapon", "Weapons", "gear", "weapon", true], ["spell", "Spells", "gear", "spell", false],
  ["talisman", "Talismans", "gear", "talisman", true], ["ash", "Spirit ashes", "gear", "ash", false], ["armor", "Armor", "gear", "armor", false],
  ["npc", "NPCs", "world", "npc", true], ["item", "Items", "extra", "item", false], ["material", "Materials", "extra", "material", false],
  ["gate", "Gateways", "world", "gate", false], ["tower", "Towers", "world", "tower", false], ["misc", "Other", "extra", "misc", false],
];
export const CATS = G.map(([id, title, group, glyph, guide]) => ({ id, title, group, glyph, guide }));

const UNDER = new Set(["nok", "ain", "deep", "mohg", "ash1"]);
const layerOf = (p) => (p.dlc ? "dlc" : UNDER.has(p.id) ? "under" : "base");
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const NAMES = ["Ruins", "Hollow", "Crypt", "Bridge", "Tower", "Grave", "Camp", "Shrine", "Cellar", "Well"];
export const MARKERS = [];
const add = (id, cat, layer, px, py, title, note) => {
  const [w, h] = SIZES[layer];
  const sub = layer === "under" ? ["ainsel", "siofra", "deeproot"][Math.floor(rnd() * 3)] : "_";
  const [lat, lng] = unproject(px, py, w, h);
  MARKERS.push([id, cat, lat, lng, title, layer, sub, note]);
};
for (const [layer, n] of [["base", 4200], ["under", 900], ["dlc", 900]]) {
  const [w, h] = SIZES[layer];
  for (let i = 0; i < n; i++) {
    const cat = CATS[Math.floor(rnd() * CATS.length)];
    add(`${layer}-${i}`, cat.id, layer, 100 + rnd() * (w - 200), 100 + rnd() * (h - 200), `${cat.title.replace(/s$/, "")} ${NAMES[i % 10]} ${i}`, i % 3 ? undefined : "Fixture note: placeholder text for layout testing.");
  }
}

export const GUIDE = { STEP_LOCS: {}, PHASE_FOCUS: {} };
PHASES.forEach((p, i) => {
  const layer = layerOf(p);
  const [w, h] = SIZES[layer];
  const t = (i % 25) / 25;
  add("loc-" + p.id, "grace", layer, w * (0.12 + 0.76 * t), h * (0.5 + 0.35 * Math.sin(t * 9 + (p.dlc ? 2 : 0))), "Phase spot: " + p.n, "Fixture focus location for phase " + p.id + ".");
  GUIDE.PHASE_FOCUS[p.id] = "loc-" + p.id;
  const first = stepById.get(p.id + ".0");
  if (first) GUIDE.STEP_LOCS[first.id] = ["loc-" + p.id];
});
