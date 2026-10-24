import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const js = readFileSync(new URL("../js/ui/route.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");

test("finished phases fold into one trail row with an expandable button", () => {
  assert.match(js, /class="trail-btn" aria-expanded="false" aria-controls="phases"/);
  assert.match(js, /Phases \$\{first\} to \$\{phaseLabel\(run\[run\.length - 1\]\)\} done/);
  assert.match(js, /classList\.toggle\("folded", past && !trailOpen\)/);
  assert.match(js, /classList\.toggle\("ahead", !past && pi > cur\)/);
  assert.match(css, /\.phase\.folded \{ display: none; \}/);
});

test("search reveals matching steps inside folded phases, and hide-done drops the trail", () => {
  assert.match(css, /\.searching \.phase\.folded:not\(\.nomatch\) \{ display: block; \}/);
  assert.match(css, /\.hide-done \.trail/);
  assert.match(js, /classList\.toggle\("searching", Boolean\(query\)\)/);
});

test("jumping to a step in a folded phase unfolds the trail", () => {
  assert.match(js, /function unfold\(ph\)/);
  assert.match(js, /unfold\(ph\);/);
});

test("the next missable row jumps to the next undone warn step", () => {
  assert.match(js, /s\.kind === "warn" && !store\.isDone\(s\.id\)/);
  assert.match(js, /data-missable="\$\{w\.id\}"/);
  assert.match(js, /jump\(mb\.dataset\.missable\)/);
});

test("current phase is loud, upcoming phases are quiet stops joined by a line", () => {
  assert.match(css, /details\.phase\.current \.num \{ background: var\(--accent\)/);
  assert.match(css, /details\.phase\.ahead \.num/);
  assert.match(css, /details\.phase\.ahead:not\(\[open\]\) > summary::before/);
});
