// Release step: `npm run bump` after changing any file the service worker precaches.
// Increments CACHE and records the new SHELL_HASH in sw.js. Does nothing when nothing changed.
import { readFileSync, writeFileSync } from "node:fs";
import { root, parseSw, shellHash } from "./shell-hash.mjs";

const src = readFileSync(root + "sw.js", "utf8");
const { cache, hash } = parseSw(src);
const now = shellHash(src);
if (hash === now) { console.log(`SHELL unchanged since v${cache}; nothing to bump.`); process.exit(0); }
const next = Number(cache) + 1;
writeFileSync(root + "sw.js", src
  .replace(/const CACHE = PREFIX \+ "v\d+"/, `const CACHE = PREFIX + "v${next}"`)
  .replace(/const SHELL_HASH = "[0-9a-f]*"/, `const SHELL_HASH = "${now}"`));
console.log(`CACHE v${cache} -> v${next}, SHELL_HASH ${now.slice(0, 12)}...`);
