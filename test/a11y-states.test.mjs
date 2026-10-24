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
  assert.match(coarse, /\.seg button \{ min-height: 44px; min-width: 44px; \}/);
  assert.match(coarse, /\.swatches button \{ width: 44px; height: 44px; \}/);
  assert.match(coarse, /\.switch::before \{[^}]*inset: -8px 0/);
});

test("ticks, switches and standalone links reach a 44px hit area on touch, and 200% zoom does not overflow", () => {
  const block = css.slice(css.indexOf("/* Touch targets and reflow leftovers"));
  // the abs-positioned inset is measured inside the border: 24px box + 2 x 2px border + 2 x 12px = 44px
  assert.match(block, /\.row button\.check::after \{ inset: -12px; \}/);
  assert.match(css, /\.step \.check::after \{ content: ""; position: absolute; inset: -10px; \}/); // 28px box
  assert.match(block, /\.jump::after \{[^}]*inset: -13px -6px/);
  assert.match(block, /\.ph-links a \{ padding-block: 12px; margin-block: -4px; \}/);
  assert.match(block, /\.set a, \.prose a, \.note a, \.hint a, \.mapcredit a, #sources a \{ padding-block: 13px; \}/);
  // narrow screens: the bottom tabs, the counters and long words wrap instead of widening the page
  assert.match(block, /\.nav button span \{[^}]*min-width: 0; overflow-wrap: anywhere/);
  assert.match(block, /\.counter, \.counter \.c-head > \* \{ min-width: 0; overflow-wrap: anywhere; \}/);
  assert.match(block, /@media \(max-width: 260px\) \{ body \{ overflow-wrap: anywhere; \} \}/);
});

test("the map is a labelled group (not an application, which would switch off screen reader browsing)", () => {
  assert.match(html, /<div id="map" role="group" aria-label="Interactive map/);
});

test("notifications are rare: single ticks and map ticks show no toast, only Mark phase done does", () => {
  const map = readFileSync(new URL("../js/ui/map.js", import.meta.url), "utf8");
  const route = readFileSync(new URL("../js/ui/route.js", import.meta.url), "utf8");
  assert.doesNotMatch(map, /showToast/);
  assert.equal((route.match(/showToast\(/g) || []).length, 1); // togglePhase only
  assert.match(route, /Undo brings the previous phase back/);
  // a single tick is undone with Ctrl/Cmd+Z, and an earned trophy is a brief outline, not a message
  assert.match(route, /lastTick = \{ fn: undo/);
  assert.match(route, /classList\.add\("earned"\)/);
  assert.match(css, /\.step\.earned \{/);
});

test("the map explains how to reach markers without a pointer, and can be skipped", () => {
  assert.match(html, /id="mapHelp"/);
  assert.match(html, /id="map"[^>]*aria-describedby="mapHelp"/);
  assert.match(html, /id="mapSkip"/);
});

test("on a short landscape phone the inline map leaves room to scroll the page", () => {
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\) \{ \.mapcard:not\(\.fs\) \.mapstage \{ height: clamp\(200px, 55svh, 340px\); \} \}/);
});

test("an accidental tick is recoverable: Undo for bulk ticks, and on touch only the tick box ticks", () => {
  const route = readFileSync(new URL("../js/ui/route.js", import.meta.url), "utf8");
  const lists = readFileSync(new URL("../js/ui/lists.js", import.meta.url), "utf8");
  assert.match(html, /id="toast"[^>]*role="status"/);
  assert.match(html, /id="toastUndo"/);
  assert.match(route, /showToast\(/);
  assert.match(route, /matchMedia\("\(pointer: coarse\)"\)\.matches \|\| e\.target\.closest\("\.check"\)/);
  assert.match(lists, /matchMedia\("\(pointer: coarse\)"\)\.matches \|\| e\.target\.closest\("\.check"\)/);
});

test("phone layout: one-line progress card with a toggle, jump-to-phase, and a map toolbar whose three tools stay together", () => {
  const route = readFileSync(new URL("../js/ui/route.js", import.meta.url), "utf8");
  assert.match(html, /id="heroSum"[^>]*aria-expanded="false"[^>]*aria-controls="minis"/);
  assert.match(html, /id="jumpPhase"/);
  assert.match(css, /\.hero:not\(\.open\) \.minis \{ display: none; \}/);
  assert.match(css, /#savePill:not\(\.err\) \{ display: none; \}/);
  assert.match(css, /\.mt-tools #mapHere[^{]*\{ flex: none; width: 44px;/);
  // Go to, Find me and Maximize/Restore are one cluster that stays at the top right of the map card
  assert.match(html, /<div class="mt-tools" id="mapTools"[^>]*>\s*<label class="mapgo mt-go">[\s\S]*id="mapHere"[\s\S]*id="mapFs"[\s\S]*id="mapExit"/);
  assert.match(css, /\.mt-tools \{ grid-column: 2; grid-row: 1;/);
  // icon-only buttons keep a text name for screen readers
  assert.match(html, /id="mapHere"><svg[^>]*aria-hidden="true">.*<span class="lbl">Find me<\/span>/s);
  // the Up next card names itself in its heading instead of a kicker above it
  assert.doesNotMatch(route, /class="eyebrow"/);
  assert.match(route, /Up next: \$\{PHASES\[n\.pi\]\.n\}/);
});

test("fonts are self-hosted: no request to a third-party font host", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/);
  assert.doesNotMatch(css, /fonts\.(googleapis|gstatic)\.com/);
  assert.doesNotMatch(sw, /fonts\.(googleapis|gstatic)\.com/);
  assert.match(css, /@font-face \{ font-family: "Cinzel"; [^}]*assets\/fonts\/Cinzel\.woff2/);
  assert.match(css, /@font-face \{ font-family: "Alegreya Sans"; [^}]*font-weight: 700;/);
});
