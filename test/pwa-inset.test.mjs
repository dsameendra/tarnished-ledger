import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("installed iPhone/iPad app: the layout clears the status area, scoped to html.ios-pwa", () => {
  // the class is set before first paint from navigator.standalone (iOS) or the standalone display mode on Apple touch devices
  assert.match(html, /classList\.add\("ios-pwa"\)/);
  assert.match(html, /navigator\.standalone === true/);
  assert.match(html, /maxTouchPoints > 1/);
  // the content starts below the solid status strip, and only in the installed app
  assert.match(css, /html\.ios-pwa \.shell \{ padding-top: calc\(14px \+ var\(--top-inset\)\); \}/);
  assert.match(css, /html\.ios-pwa \{\s*--pwa-gap: min\(20px, calc\(var\(--safe-t\) \* 1000\)\);\s*--top-inset: calc\(var\(--safe-t\) \+ var\(--pwa-gap\)\);/);
  // everywhere else the inset is just the safe area, so a browser tab (inset 0) is unchanged
  assert.match(css, /--top-inset: var\(--safe-t\);/);
  assert.match(css, /body::before \{[^}]*height: var\(--top-inset\)/);
  // no top inset is read straight from env() any more outside the single definition
  assert.equal((css.match(/env\(safe-area-inset-top/g) || []).length, 1);
});
