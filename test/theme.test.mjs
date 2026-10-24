import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const [r, g, b] = hex(h).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => "#" + hex(a).map((v, i) => Math.round((v * (1 - t) + hex(b)[i] * t) * 255).toString(16).padStart(2, "0")).join("");

// Pull "--l-bg: #xxxxxx" style tokens for each accent, and the accent colours themselves.
function tokens(accent) {
  const sel = accent === "gold" ? ":root {" : `:root[data-accent="${accent}"] {`;
  const i = css.indexOf(sel + " --l-bg");
  assert.ok(i >= 0, `no tokens for ${accent}`);
  const block = css.slice(i, css.indexOf("}", i));
  const get = (p) => Object.fromEntries([...block.matchAll(new RegExp(`--${p}-(\\w+): (#[0-9a-f]{6})`, "g"))].map((m) => [m[1], m[2]]));
  return { light: get("l"), dark: get("d") };
}
const ACCENT = { gold: ["#7c5d15", "#d6b159"], crimson: ["#9b2f3a", "#e0727c"], frost: ["#2f6487", "#86b9dc"], silver: ["#5d5f66", "#c3c6ce"], verdant: ["#2f6b3a", "#7fc48b"] };

for (const accent of Object.keys(ACCENT)) {
  for (const mode of ["light", "dark"]) {
    test(`${accent} ${mode}: text, muted text, accent text and control borders stay readable`, () => {
      const t = tokens(accent)[mode];
      for (const k of ["bg", "surface", "raised", "fg", "muted", "line", "edge"]) assert.ok(t[k], `${k} missing`);
      const acc = ACCENT[accent][mode === "light" ? 0 : 1];
      const soft = mix(t.surface, acc, 0.16);
      for (const bg of [t.bg, t.surface, t.raised]) {
        assert.ok(ratio(t.fg, bg) >= 11, `fg on ${bg}`);
        assert.ok(ratio(t.muted, bg) >= 4.5, `muted on ${bg}`);
        assert.ok(ratio(acc, bg) >= 4.5, `accent on ${bg}`);
      }
      assert.ok(ratio(t.muted, soft) >= 4.5, "muted on accent-soft");
      assert.ok(ratio(acc, soft) >= 4.5, "accent on accent-soft");
      // text on an accent tint uses the stronger tokens (--accent-ink, --muted-ink): same formulas as the css
      const ink = mix(acc, t.fg, 0.25), mutedInk = mix(t.muted, t.fg, 0.22);
      assert.ok(ratio(ink, soft) >= 5.5, "accent-ink on accent-soft");
      assert.ok(ratio(mutedInk, soft) >= 4.5, "muted-ink on accent-soft");
      assert.ok(ratio(t.muted, t.raised) >= 4.5, "placeholder (muted) on raised");
      assert.ok(ratio(t.edge, t.raised) >= 3, "control border on raised");
      assert.ok(ratio(t.edge, t.surface) >= 3, "control border on surface");
      assert.ok(ratio(t.edge, t.bg) >= 3, "control border on bg");
    });
  }
}

test("the css uses those tokens for tinted pairs and placeholders", () => {
  assert.match(css, /--accent-ink: color-mix\(in srgb, var\(--accent\) 75%, var\(--fg\)\)/);
  assert.match(css, /--muted-ink: color-mix\(in srgb, var\(--muted\) 78%, var\(--fg\)\)/);
  assert.match(css, /::placeholder \{ color: var\(--muted\); opacity: 1; \}/);
  for (const sel of [/\.chip\.trophy \{[^}]*color: var\(--accent-ink\)/, /\.toolbar \.btn\[aria-pressed="true"\] \{[^}]*var\(--accent-ink\)/, /\.step \.more\[aria-expanded="true"\] \{[^}]*var\(--accent-ink\)/, /\.next \.where small \{[^}]*var\(--muted-ink\)/]) assert.match(css, sel);
});

// Selected segmented controls and chips: accent fill + --onaccent text in every accent and theme (light #fffdf6, dark #14130e)
for (const accent of Object.keys(ACCENT)) {
  for (const [mode, i, onaccent] of [["light", 0, "#fffdf6"], ["dark", 1, "#14130e"]]) {
    test(`${accent} ${mode}: selected control text (--onaccent) on the accent fill is >= 4.5:1; hover text on accent-soft too`, () => {
      assert.ok(ratio(onaccent, ACCENT[accent][i]) >= 4.5, "onaccent on accent");
      const t = tokens(accent)[mode];
      assert.ok(ratio(t.fg, mix(t.surface, ACCENT[accent][i], 0.16)) >= 4.5, "fg on accent-soft (hover)");
    });
  }
}

test("css: every selected map chip/segment is accent-filled with --onaccent text; Go to / Jump selects fill their wrapper", () => {
  for (const sel of [/\.mapcard:not\(\.fs\) \.mt-subs button\[aria-pressed="true"\] \{[^}]*background: var\(--accent\)[^}]*color: var\(--onaccent\)/, /\.mapcard:not\(\.fs\) \.mt-chips \.seg button\[aria-pressed="true"\] \{[^}]*background: var\(--accent\)[^}]*color: var\(--onaccent\)/, /\n\.seg button\[aria-pressed="true"\] \{ background: var\(--accent\); color: var\(--onaccent\)/]) assert.match(css, sel);
  assert.match(css, /\.mapgo select, \.jumpph select \{[^}]*appearance: none[^}]*width: 100%[^}]*max-width: none/);
  assert.match(css, /\.mapgo, \.jumpph \{ position: relative; display: block/);
  assert.ok(!/\.mapgo select \{[^}]*max-width/.test(css), "no later max-width may shrink the select inside its wrapper");
  assert.ok(!/\.mt-go select \{/.test(css), "the wrapper (.mt-go) sizes the control, not the select");
});
