import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const rule = (sel) => css.split("\n").filter((l) => l.startsWith(sel + " {") || l.startsWith(sel + ", ")).join("\n");

test("a ticked step recedes by colour, not opacity, so its chips and links keep their tested contrast", () => {
  assert.doesNotMatch(rule(".step.checked"), /opacity/);
  assert.match(css, /\.step\.checked \.txt p \{ color: var\(--muted\)/);
  assert.doesNotMatch(rule(".seg-filter button i"), /opacity/);
});

test("keyboard focus is visible on the map progress lists", () => {
  assert.doesNotMatch(css, /\.pg-row:hover, \.pg-row:focus-visible \{[^}]*outline: none/);
  assert.doesNotMatch(css, /\.pg-list button:hover, \.pg-list button:focus-visible \{[^}]*outline: none/);
  assert.match(css, /\.pg-row:focus-visible \{ outline: 2px solid var\(--accent\)/);
  assert.match(css, /\.pg-list button:focus-visible \{ outline: 2px solid var\(--accent\)/);
});

test("Settings controls reach 44px on touch screens", () => {
  const coarse = css.slice(css.indexOf("@media (pointer: coarse)"));
  assert.match(coarse, /\.seg button \{ min-height: 44px; \}/);
  assert.match(coarse, /\.swatches button \{ width: 44px; height: 44px; \}/);
  assert.match(coarse, /\.switch::before \{[^}]*inset: -7px 0/);
});

test("the map explains how to reach markers without a pointer, and can be skipped", () => {
  assert.match(html, /id="mapHelp"/);
  assert.match(html, /id="map"[^>]*aria-describedby="mapHelp"/);
  assert.match(html, /id="mapSkip"/);
});

test("on a short landscape phone the inline map leaves room to scroll the page", () => {
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\) \{ \.mapcard:not\(\.fs\) \.mapstage \{ height: clamp\(200px, 55svh, 340px\); \} \}/);
});
