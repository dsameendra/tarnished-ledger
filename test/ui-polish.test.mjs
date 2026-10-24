import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const css = read("css/styles.css"), html = read("index.html"), nav = read("js/ui/nav.js"), lists = read("js/ui/lists.js"), route = read("js/ui/route.js");
const map = read("js/ui/map.js"), settings = read("js/ui/settings.js"), icons = read("js/lib/icons.js"), rail = read("js/ui/rail.js");

test("phone map: Layers button opens a bottom sheet (aria-expanded, Escape, focus returns)", () => {
  assert.match(html, /id="mapLayersBtn" aria-expanded="false" aria-controls="mapLeft"/);
  assert.match(html, /id="mapLayersX" aria-label="Close map layers"/);
  assert.match(css, /\.mapcard\.fs\.layers-open \.mt-left \{[^}]*position: absolute/);
  assert.match(css, /\.mapcard\.fs \.mt-left \{ display: none; \}/);
  assert.match(map, /setAttribute\("aria-expanded", String\(open\)\)/);
  assert.match(map, /e\.key === "Escape" && fs && \$\("mapCard"\)\.classList\.contains\("layers-open"\)/);
  assert.match(map, /\$\("mapLayersBtn"\)\.focus\(\)/);
});

test("map toolbar keeps Go to, Find me and Maximize together at the top right on phones", () => {
  assert.match(css, /\.mt-tools \{ grid-column: 1; grid-row: 1; justify-self: stretch/);
  assert.match(css, /\.mapcard\.fs \.mt-tools \{ grid-column: 2; grid-row: 1; \}/);
  assert.match(css, /@container \(min-width: 18\.5rem\)/);
});

test("zoom stack: fit is an SVG, the scale pill lives in the stack", () => {
  assert.match(html, /data-z="fit"[^>]*><svg/);
  assert.ok(!html.includes("&#x2922;"));
  const stack = html.slice(html.indexOf('id="mapZoom"'), html.indexOf('id="mapMini"'));
  assert.ok(stack.includes('id="mapScale"'));
  assert.ok(!/\.mapscale \{[^}]*position: absolute/.test(css));
});

test("done steps recede at every width and stay reachable through More", () => {
  assert.match(css, /^\.step\.checked \.chips, \.step\.checked \.links \{ display: none; \}/m);
  assert.match(css, /\.step\.checked\.open \.chips, \.step\.checked\.open \.links \{ display: flex; \}/);
  assert.match(css, /\.step\.checked \.more \{ display: grid;/);
});

test("lists: 28px tick with a 44px hit area, inert rows draw a lock, text taps pulse the box", () => {
  assert.match(css, /\.row \.check \{ width: 28px; height: 28px;/);
  assert.match(lists, /class="check lock"/);
  assert.match(icons, /lock: '/);
  assert.match(lists, /classList\.add\("hint"\)/);
  assert.match(css, /\.check\.hint \{ animation: tickhint/);
});

test("meta lines never start a line with a middot", () => {
  assert.ok(lists.includes("&nbsp;· "));
  assert.ok(!/ · <button type="button" class="jump"/.test(lists));
  assert.match(route, /m\.join\("&nbsp;· "\)/);
});

test("DLC segment on the phone checklist switch, heading follows it", () => {
  assert.match(nav, /data-ck="dlc"/);
  assert.match(nav, /scope\(\) === "both"/);
  assert.match(css, /#v-tro\[data-sub="dlc"\] #troList/);
  assert.match(lists, /dataset\.sub === "dlc"/);
});

test("route search also matches trophy, legendary and DLC goal names", () => {
  assert.match(route, /data-text="\$\{attr\(s\.text \+ " " \+ chipNames\(s\)\)\}"/);
});

test("naming and labels", () => {
  assert.match(html, /<h2 class="view-h">Legendary items<\/h2>/);
  assert.match(html, /<span>Legendary items<\/span>/);
  assert.match(html, /id="compactBtn" type="button" title="Compact steps/);
  assert.match(html, /id="hideBtn" type="button" title="Hide completed steps"/);
  assert.match(html, /<aside class="rail" aria-label="Progress">/);
  assert.match(html, /id="welcomeTr"/);
  assert.match(rail, /welcomeTr/);
  assert.match(lists, /Four \$\{trophiesWord\(\)\.toLowerCase\(\)\} need a full set/);
  assert.match(map, /Counts are for this layer/);
});

test("gear and book icons for Settings and Guide", () => {
  assert.match(nav, /\["guide", "Guide", "book"\]/);
  assert.match(nav, /\["set", "Settings", "gear"\]/);
  assert.match(icons, /gear: '/);
  assert.match(icons, /book: '/);
});

test("keep-awake pill only shows when the setting is on and the lock failed", () => {
  assert.match(settings, /pill\.hidden = !\(store\.setting\("awake"\) && \(state === "blocked" \|\| state === "unsupported"\)\)/);
});

test("small css fixes: link underline, legend swatch, narrow toolbar, gutter, switch margin", () => {
  assert.match(css, /\.links a \{[^}]*text-decoration: underline[^}]*text-underline-offset: 3px/);
  assert.ok(!/\.links a \{[^}]*border-bottom/.test(css));
  assert.match(css, /lg-ahead \{ border-top: 3px dashed var\(--muted\)/);
  assert.match(css, /@media \(max-width: 360px\) \{\s*#v-route \.toolbar \.search \{ grid-column: span 6; \}/);
  assert.match(css, /\.more-list \{[^}]*margin: 0 max\(16px, var\(--safe-r\)\) 8px max\(16px, var\(--safe-l\)\)/);
  assert.match(css, /\.seg\.ckswitch \{ display: flex; margin: 12px 0; \}/);
  assert.match(css, /\.ph-links \.maplink\[data-phaseall\] \{[^}]*border: 0/);
});
