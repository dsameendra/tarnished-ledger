// Content hash of every file the service worker serves cache-first (SHELL + MAP_PACK).
// Shared by `npm run check` (fails when it drifts from SHELL_HASH in sw.js), `npm run bump` and test/sw.test.mjs.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("..", import.meta.url));
const list = (src, name) => JSON.parse("[" + new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`).exec(src)[1].replace(/,\s*$/, "") + "]");
const TEXT = /\.(js|css|html|json|svg|webmanifest)$/;

export function parseSw(src) {
  return { shell: list(src, "SHELL"), pack: list(src, "MAP_PACK"), cache: /const CACHE = PREFIX \+ "v(\d+)"/.exec(src)?.[1], hash: /const SHELL_HASH = "([0-9a-f]*)"/.exec(src)?.[1] };
}

export function shellHash(src = readFileSync(root + "sw.js", "utf8")) {
  const { shell, pack } = parseSw(src);
  const h = createHash("sha256");
  for (const f of [...new Set([...shell, ...pack].map((f) => (f === "./" ? "index.html" : f)))].sort()) {
    let b = readFileSync(root + f);
    if (TEXT.test(f)) b = Buffer.from(b.toString("utf8").replace(/\r\n/g, "\n"));
    h.update(f + "\0").update(b).update("\0");
  }
  return h.digest("hex");
}
