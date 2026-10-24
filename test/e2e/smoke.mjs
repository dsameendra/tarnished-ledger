// Browser checks for the review fixes. Not part of `npm test` (which has no dependencies).
//   python3 -m http.server 8502 &   then   NODE_PATH=<dir with playwright>/node_modules node test/e2e/smoke.mjs [url]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const URL_ = process.argv[2] || "http://localhost:8502/index.html";
const KEY = "tarnished-ledger:v2";
const b = await chromium.launch();
let bad = 0;
const ok = (name, cond, extra = "") => { console.log(cond ? "PASS" : "FAIL", name, cond ? "" : extra); if (!cond) bad++; };

async function open(seed, opts = {}, url = URL_) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", acceptDownloads: true, ...opts });
  const p = await c.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(([s]) => {
    if (!localStorage.getItem("seeded")) { localStorage.setItem("seeded", "1"); localStorage.setItem("tarnished-ledger:welcome", "1"); if (s) localStorage.setItem("tarnished-ledger:v2", s); }
  }, [seed]);
  await p.goto(url);
  await p.waitForSelector("#phases .step", { state: "attached" });
  return { c, p, errs };
}
const saved = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const doneCount = async (p) => Object.values((await saved(p)).marks).filter((m) => m[0] === 1).length;
const settings = async (p) => { await p.evaluate(() => document.querySelector('#tabs button[data-tab="set"]')?.click() || (location.hash = "#set")); await p.waitForTimeout(150); };

// CODE-5 / UX-3 / CODE-12
{
  const { c, p } = await open();
  await p.focus("#nextDone");
  await p.keyboard.press("Enter");
  ok("CODE-5 focus stays on Mark done", await p.evaluate(() => document.activeElement.id) === "nextDone");
  const t = await p.textContent("#nextTicked");
  ok("UX-3 inline ticked line with Undo", /^Ticked: .+Undo$/.test(t), t);
  ok("UX-3 line is a status region", await p.getAttribute("#nextTicked", "role") === "status");
  const n1 = await doneCount(p);
  await p.click("#nextTicked .ticked-undo");
  ok("UX-3 Undo takes the tick back", (await doneCount(p)) === n1 - 1);
  ok("UX-3 line cleared after Undo", (await p.textContent("#nextTicked")) === "");
  await p.click("#nextDone"); await p.click("#nextDone");
  await settings(p);
  const before = await doneCount(p);
  await p.keyboard.press("Control+z");
  ok("CODE-12 Ctrl+Z ignored outside the Route tab", (await doneCount(p)) === before);
  await c.close();
}

// CODE-3 / CODE-4
{
  const { c, p } = await open();
  await p.evaluate(() => document.querySelector('[data-sw="autoopen"]').click());
  const before = JSON.stringify((await saved(p)).closed);
  await p.fill("#q", "grace");
  await p.waitForTimeout(300);
  ok("CODE-4 search does not persist phase open state", JSON.stringify((await saved(p)).closed) === before);
  await p.fill("#q", "");
  await p.click("details.phase summary >> nth=0");
  await p.waitForTimeout(200);
  ok("CODE-4 a real toggle is persisted", Object.keys((await saved(p)).closed).length === 1);
  await p.fill("#q", "mohg");
  await p.evaluate(() => document.querySelector('[data-set="platform"] button[data-v="xbox"]').click());
  await p.waitForTimeout(200);
  const r = await p.evaluate(() => ({ vis: document.querySelectorAll(".step[data-id]:not(.nomatch)").length, count: document.getElementById("qCount").textContent }));
  ok("CODE-3 filter follows a re-render", String(r.vis) === r.count.split(" ")[0] && r.vis < 50, JSON.stringify(r));
  await c.close();
}

// UX-5: Mark phase done moves focus to the toast's Undo
{
  const { c, p } = await open();
  await p.focus("[data-phaseall] >> nth=0");
  await p.keyboard.press("Enter");
  ok("UX-5 focus on toast Undo after Mark phase done", await p.evaluate(() => document.activeElement.id) === "toastUndo");
  ok("UX-4 inverse label", await p.evaluate(() => [...document.querySelectorAll("[data-phaseall]")].some((x) => x.textContent === "Clear this phase")));
  await c.close();
}

// UX-9, UX-1: preview, undo
{
  const { c, p } = await open();
  for (let i = 0; i < 3; i++) await p.click("#nextDone");
  await settings(p);
  await p.fill("#importBox", "ER1:" + Buffer.from("limw.0").toString("base64"));
  await p.click("#importBtn");
  const txt = await p.textContent("#restoreText");
  ok("UX-9 confirmation shows both counts", /code has 1 done step; you have \d+ done steps?/.test(txt), txt);
  ok("UX-9 steps-only note", /carries done steps only/.test(await p.textContent("#importHint")));
  await p.click("#restoreYes");
  ok("UX-1 undo offered after restore", await p.isVisible("#undoLast"));
  const n = await doneCount(p);
  await p.click("#undoLast");
  ok("UX-1 undo brings the steps back", (await doneCount(p)) > n - 1 && (await doneCount(p)) >= 3, String(await doneCount(p)));
  await p.fill("#importBox", "garbage");
  await p.click("#importBtn");
  ok("UX-9 unreadable code rejected before asking", await p.isHidden("#restoreConfirm"));
  await p.click("#resetBtn");
  ok("UX-1 reset text names what is cleared and the gist tip", /Clear \d+ done steps?/.test(await p.textContent("#resetText")));
  await p.click("#resetYes");
  ok("UX-1 reset can be undone", await p.isVisible("#undoLast"));
  await p.click("#undoLast");
  ok("UX-1 undo after reset", (await doneCount(p)) >= 3);
  await c.close();
}

// UX-2: unreadable save
{
  const { c, p } = await open("{broken json");
  ok("UX-2 notice in Settings", await p.evaluate(() => !document.getElementById("corruptNote").hidden));
  ok("UX-2 notice by Up next", await p.isVisible("#nextCorrupt"));
  const dl = p.waitForEvent("download");
  await p.click("#nextCorrupt [data-corrupt-download]");
  const d = await dl;
  ok("UX-2 download carries the raw text", (await require("node:fs/promises").readFile(await d.path(), "utf8")) === "{broken json");
  await p.click("#nextCorrupt [data-corrupt-dismiss]");
  ok("UX-2 dismiss hides it", (await p.locator("#nextCorrupt").count()) === 0);
  await c.close();
}

// UX-6 / CODE-8: update notice
{
  const { c, p } = await open();
  await p.evaluate(async () => { (await import("./js/lib/update.js")).showNotice("A new version is ready.", "Update", () => {}); });
  const r = await p.evaluate(() => {
    const n = document.getElementById("updateNote").getBoundingClientRect(), t = document.querySelector("#tabs").getBoundingClientRect();
    return { bottom: n.bottom, tabTop: t.top, h: n.height, role: document.getElementById("updateNote").getAttribute("role") };
  });
  ok("UX-6 notice above the tab bar, one line", r.bottom <= r.tabTop + 1 && r.h < 70 && r.role === "status", JSON.stringify(r));
  await p.click("#updateNote >> text=Later");
  ok("UX-6 Later dismisses", (await p.locator("#updateNote").count()) === 0);
  await c.close();
}

// CODE-2: sync-driven scope change must still draw the base route
{
  const seed = JSON.stringify({ settings: { dlc: true, focus: "dlc" }, profileT: 5 });
  const { c, p } = await open(seed, { viewport: { width: 1200, height: 900 } }, URL_ + "?mapdebug#map");
  await p.waitForFunction(() => window.__tlMap && window.__tlMap().D, null, { timeout: 20000 });
  await p.waitForTimeout(500);
  await p.evaluate(async () => {
    const s = await import("./js/lib/store.js"), t = Date.now() + 1000;
    s.mergeExtras({ mapPrefs: { on: true, hideFound: false, route: true, cats: null, t }, profile: { t, platform: "ps", dlc: true, focus: "both" } });
  });
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('#mapWorld button[data-v="base"]')?.click());
  await p.waitForTimeout(1500);
  const legs = await p.evaluate(() => document.querySelectorAll("path.mp-seg").length);
  ok("CODE-2 base route drawn after a remote scope change", legs > 0, "legs " + legs);
  await c.close();
}

await b.close();
console.log(bad ? `${bad} FAILED` : "all passed");
process.exit(bad ? 1 : 0);
