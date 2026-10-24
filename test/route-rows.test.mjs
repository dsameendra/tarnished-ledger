import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../css/styles.css");
const js = read("../js/ui/route.js");
const html = read("../index.html");
const block = css.slice(css.indexOf("/* lighter step rows on phones"));

test("phone step rows: meta line and More button exist only in the phone block", () => {
  assert.match(css, /\.step \.meta, \.step \.more \{ display: none; \}/);
  assert.match(block, /@media \(max-width: 699\.98px\)/);
  assert.match(block, /\.step \.more \{ display: grid;/);
  assert.match(block, /\.step\.open \.links, \.step\.cur \.links \{ display: flex; \}/);
  assert.match(block, /\.step\.cur \.more \{ display: none; \}/);
  assert.match(block, /\.chip:not\(\.miss\)/, "the Don't miss chip stays visible");
});

test("More button is a real, labelled, expandable control", () => {
  assert.match(js, /class="more" data-more aria-expanded="false" aria-controls="l-\$\{s\.id\}" aria-label="[^"]+"/);
  assert.match(js, /setAttribute\("aria-expanded"/);
  assert.match(js, /classList\.add\("cur"\)/);
  assert.match(block, /\.step \.more::after \{ content: ""; position: absolute; inset: -6px/, "30px button grows to a 42px+ hit area");
});

test("meta line is built from the same data as the chips", () => {
  assert.match(js, /Legendary: \$\{collectibleName/);
  assert.match(js, /\$\{trophyWord\(\)\}: \$\{trophyName/);
});

test("Compact toggle in the toolbar is bound to the compact setting", () => {
  assert.match(html, /id="compactBtn"[^>]*aria-pressed="false">Compact</);
  assert.match(js, /setSetting\("compact"/);
  assert.match(js, /\$\("compactBtn"\)\.setAttribute\("aria-pressed"/);
  assert.match(html, /data-sw="compact"/);
});
