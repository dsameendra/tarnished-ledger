import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CALIB, project } from "../js/data/map-calib.js";

const MAX_MEDIAN_PX = 3;

const SAMPLES = [
  ["base", "_", "The First Step", 0.6128315003820, -0.7258097827438],
  ["base", "_", "Erdtree-Gazing Hill", 0.7831042066563, -0.76991066336731],
  ["base", "_", "Gelmir Hero's Grave", 0.80256042899849, -0.77576324343667],
  ["base", "_", "Elphael Inner Wall", 0.89477269517187, -0.64486607909342],
  ["under", "siofra", "Siofra River Bank", 0.27831036277713, -0.68015198434733],
  ["under", "ainsel", "Ainsel River Main", 0.39255874814978, -0.7766006059567],
  ["under", "ainsel", "Lake of Rot Shoreside", 0.37876794872714, -0.80388545246498],
  ["under", "deeproot", "Great Waterfall Crest", 0.42319690590436, -0.69154124914149],
  ["dlc", "_", "Gravesite Plain", 0.63799013280462, -0.73054668687249],
  ["dlc", "_", "Castle Ensis Checkpoint", 0.68364839823880, -0.71912383815337],
  ["dlc", "_", "Shadow Keep Main Gate", 0.71136592756589, -0.70657968511819],
  ["dlc", "_", "Belurat, Tower Settlement", 0.6735597995139, -0.75531731355451],
];

test("known Site of Grace locations project inside their map image", () => {
  for (const [map, sub, title, lat, lng] of SAMPLES) {
    const [x, y] = project(map, sub, lat, lng);
    const { w, h } = CALIB[map];
    assert.ok(x > 20 && x < w - 20 && y > 20 && y < h - 20, `${title} -> ${x.toFixed(1)}, ${y.toFixed(1)} outside ${w}x${h}`);
  }
});

test("underground sub-maps share one scale but have distinct offsets", () => {
  const t = CALIB.under.t;
  assert.equal(t.ainsel[0], t.siofra[0]);
  assert.notEqual(t.ainsel[5], t.siofra[5]);
});

test("recorded fit residuals are under the threshold", () => {
  const src = readFileSync(new URL("../js/data/map-calib.js", import.meta.url), "utf8");
  const header = src.split("\n")[0];
  const found = [...header.matchAll(/([a-z.]+)=(\d+(?:\.\d+)?)/g)];
  assert.ok(found.length >= 5, "header lists a residual per map and sub-map");
  for (const [, name, v] of found) assert.ok(Number(v) < MAX_MEDIAN_PX, `${name} median ${v}px`);
});

test("project is a pure affine mapping of normalised mercator", () => {
  const [a, b] = project("base", "_", 0.7, -0.7);
  const [c, d] = project("base", "_", 0.7, -0.7);
  assert.deepEqual([a, b], [c, d]);
  const [x0] = project("dlc", "_", 0.7, -0.7);
  const [x1] = project("dlc", "_", 0.7, -0.69);
  assert.ok(x1 > x0);
});
