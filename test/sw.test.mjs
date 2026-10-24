import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { root, parseSw, shellHash } from "../scripts/shell-hash.mjs";

const src = readFileSync(root + "sw.js", "utf8");

test("SHELL_HASH matches the files served cache-first (run `npm run bump` after editing them)", () => {
  assert.equal(parseSw(src).hash, shellHash(src));
});
test("the hash changes when the file list changes", () => {
  const other = src.replace('"css/styles.css"', '"css/styles.css", "package.json"');
  assert.notEqual(shellHash(other), shellHash(src));
});
test("an updated worker waits for the page to ask before taking over", () => {
  const install = /addEventListener\("install"[\s\S]*?\n\}\);/.exec(src)[0];
  assert.ok(!install.includes("skipWaiting()"));
  assert.match(src, /e\.data === "skipWaiting"/);
});
