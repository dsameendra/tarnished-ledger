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
const ACCENT = { gold: ["#7c5d15", "#d6b159"], crimson: ["#9b2f3a", "#e0727c"], frost: ["#2f6487", "#86b9dc"], silver: ["#5d5f66", "#c3c6ce"] };

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
      assert.ok(ratio(t.edge, t.surface) >= 3, "control border on surface");
      assert.ok(ratio(t.edge, t.bg) >= 3, "control border on bg");
    });
  }
}
