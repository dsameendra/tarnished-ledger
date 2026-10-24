import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const nav = read("js/ui/nav.js"), css = read("css/styles.css"), settings = read("js/ui/settings.js");

test("phone nav: four tabs, six views, hash ids unchanged", () => {
  assert.match(nav, /data-views=/);
  for (const id of ["checklists", "more", "moreSheet", "ckSwitch"]) assert.ok(nav.includes(id), id);
  for (const id of ["route", "tro", "col", "map", "guide", "set"]) assert.ok(nav.includes(`"${id}"`), id);
  assert.match(nav, /max-width: 979\.98px/);
  assert.match(nav, /Escape/);
  assert.match(nav, /aria-expanded/);
  assert.match(nav, /"Goals"/);
});

test("phone nav css: opposite tab sets per breakpoint, 12px labels, 44px rows", () => {
  assert.match(css, /\.nav \.tab-d \{ display: none; \}/);
  assert.match(css, /\.nav \.tab-m, \.ckswitch, \.moresheet \{ display: none !important; \}/);
  assert.match(css, /\.nav button \{[^}]*font-size: var\(--fs-xs\)/);
  assert.match(css, /\.more-row \{[^}]*min-height: 52px/);
  assert.match(css, /\.seg\.ckswitch button \{ min-height: 44px/);
});

test("tabpanel wiring follows the phone aliases", () => {
  assert.match(settings, /dataset\.views/);
  assert.match(settings, /setAttribute\("role", "tabpanel"\)/);
  assert.match(settings, /phone\.addEventListener\("change", wire\)/);
});
