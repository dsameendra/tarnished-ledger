// Regression tests for the review findings fixed in the store: GD-1, CODE-1, CODE-6, CODE-9, CODE-10, CODE-11, UX-1, UX-2.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStorage } from "./helpers.mjs";
import { COUNTER_MARKERS, COUNTER_QTY } from "../js/data/counter-markers.js";
import { counterMarkersSource, readRows } from "../scripts/counter-markers.mjs";
import { readFileSync } from "node:fs";

globalThis.localStorage = makeStorage();
const { validIds } = await import("../js/lib/model.js");
async function boot(seed = {}) {
  globalThis.localStorage = makeStorage(seed);
  const store = await import("../js/lib/store.js?" + Math.random());
  store.load();
  return store;
}
const HOUR = 3600e3;

test("GD-1: every marker found gives exactly 50 Scadutree Fragments and 25 Revered Spirit Ashes", async () => {
  const store = await boot();
  assert.deepEqual([COUNTER_QTY["380265"], COUNTER_QTY["382141"], COUNTER_QTY["380753"], COUNTER_QTY["382643"]], [2, 5, 2, 2]);
  for (const id of COUNTER_MARKERS.sf) store.setFound(id, true);
  assert.equal(store.counter("sf"), 50);
  for (const id of COUNTER_MARKERS.rsa) store.setFound(id, true);
  assert.equal(store.counter("rsa"), 25);
  store.setFound("382141", false);
  assert.equal(store.counter("sf"), 45);
});

test("GD-1: the committed counter-markers.js is what the generator makes from dlc.json", () => {
  const file = readFileSync(new URL("../js/data/counter-markers.js", import.meta.url), "utf8");
  assert.equal(file, counterMarkersSource(readRows()));
});

test("CODE-1: Reset progress wins over found markers and counters other devices made earlier and this device never saw", async () => {
  const store = await boot();
  const sfm = COUNTER_MARKERS.sf[0];
  store.resetProgress([...validIds]);
  store.mergeExtras({ found: { [sfm]: [1, Date.now() - 5000] }, counters: { sf: [4, Date.now() - 5000] } });
  assert.equal(store.isFound(sfm), false);
  assert.equal(store.counter("sf"), 0);
  // a find made after the reset still counts
  store.mergeExtras({ found: { [sfm]: [1, Date.now() + 1000] } });
  assert.equal(store.isFound(sfm), true);
});

test("CODE-1: a reset made on another device clears what this device holds, and travels in the snapshot", async () => {
  const a = await boot();
  const sfm = COUNTER_MARKERS.sf[0];
  a.setFound(sfm, true);
  a.setCounter("sf", 9);
  const b = await boot();
  b.resetProgress([...validIds]);
  const snap = JSON.parse(JSON.stringify(b.snapshot()));
  assert.ok(snap.resetT > 0);
  assert.equal(a.mergeExtras({ resetT: snap.resetT }), true);
  assert.equal(a.isFound(sfm), false);
  assert.equal(a.counter("sf"), 0);
  assert.equal(a.snapshot().resetT, snap.resetT);
  assert.equal(a.remoteCovers({ ...a.snapshot(), resetT: 0 }), false);
});

test("CODE-1: a save from before the watermark loads with resetT 0", async () => {
  const store = await boot({ "tarnished-ledger:v2": JSON.stringify({ v: 4, marks: {}, counters: {}, found: { 5: [1, 3] } }) });
  assert.equal(store.get().resetT, 0);
  assert.equal(store.isFound(5), true);
});

test("CODE-6: counters, map prefs and profile are strictly newer than the record they replace (future-stamped remote)", async () => {
  const store = await boot();
  const far = Date.now() + HOUR;
  store.mergeExtras({ counters: { sf: [10, far] }, mapPrefs: { t: far, route: false }, profile: { t: far, platform: "xbox", dlc: false, focus: "both" } });
  const c0 = store.get().counters.sf[1], m0 = store.get().mapT, p0 = store.get().profileT;
  store.setCounter("sf", 3);
  store.setMapPrefs({ route: true });
  store.setSetting("platform", "steam");
  assert.ok(store.get().counters.sf[1] > c0);
  assert.ok(store.get().mapT > m0);
  assert.ok(store.get().profileT > p0);
  // and that edit beats the remote record it replaced
  assert.equal(store.mergeExtras({ counters: { sf: [10, c0] }, mapPrefs: { t: m0, route: false }, profile: { t: p0, platform: "xbox" } }), false);
  assert.equal(store.counter("sf"), 3);
});

test("CODE-6: a reset after merging future-stamped marks is newer than them", async () => {
  const store = await boot();
  store.mergeMarks({ "limw.0": [1, Date.now() + HOUR] });
  const t0 = store.get().marks["limw.0"][1];
  store.resetProgress([...validIds]);
  assert.equal(store.isDone("limw.0"), false);
  assert.ok(store.get().marks["limw.0"][1] > t0);
  assert.equal(store.mergeMarks({ "limw.0": [1, t0] }), false);
});

test("CODE-6: remote timestamps count as at most five minutes ahead", async () => {
  const store = await boot();
  store.mergeMarks({ "limw.1": [1, 9e15] });
  assert.ok(store.get().marks["limw.1"][1] < Date.now() + 6 * 60e3);
  store.setDone("limw.1", false);
  assert.equal(store.isDone("limw.1"), false);
});

test("CODE-9: progressInfo counts steps, found markers and non-zero counters", async () => {
  const store = await boot();
  assert.equal(store.progressInfo().any, false);
  store.setCounter("rsa", 3);
  assert.deepEqual([store.progressInfo().any, store.progressInfo().counters], [true, 1]);
  store.setCounter("rsa", 0);
  assert.equal(store.progressInfo().any, false);
  store.setFound(COUNTER_MARKERS.rsa[0], true);
  assert.equal(store.progressInfo().found, 1);
});

test("CODE-9: importData reconciles twin steps", async () => {
  const store = await boot();
  const [a, b] = (await import("../js/data/twins.js")).TWINS[0];
  store.importData(JSON.stringify({ marks: { [a]: [1, 5] } }), validIds);
  assert.equal(store.isDone(a), true);
  assert.equal(store.isDone(b), true);
});

test("CODE-9: previewImport reads a code or file without touching anything", async () => {
  const store = await boot();
  store.setDone("limw.0", true);
  const code = "ER1:" + btoa("limw.1,limw.2,nope");
  assert.deepEqual(store.previewImport(code, validIds), { steps: 2, found: null, counters: false });
  const file = JSON.stringify({ marks: { "limw.1": [1, 5] }, counters: { sf: [1, 1] }, found: { 1: [1, 1], 2: [0, 1] } });
  assert.deepEqual(store.previewImport(file, validIds), { steps: 1, found: 1, counters: true });
  assert.throws(() => store.previewImport("not a backup", validIds));
  assert.throws(() => store.previewImport("ER1:%%%", validIds));
  assert.equal(store.isDone("limw.0"), true);
  assert.equal(store.isDone("limw.1"), false);
});

test("CODE-9: a code restore leaves found markers and counters alone, a full backup replaces them and wins over unseen ones", async () => {
  const store = await boot();
  const m = COUNTER_MARKERS.sf[0];
  store.setFound(m, true);
  store.setCounter("rsa", 2);
  store.importData("ER1:" + btoa("limw.1"), validIds);
  assert.equal(store.isFound(m), true);
  assert.equal(store.counter("rsa"), 2);
  store.importData(JSON.stringify({ marks: {}, found: {}, counters: {} }), validIds);
  assert.equal(store.isFound(m), false);
  store.mergeExtras({ found: { [m]: [1, Date.now() - 1000] } });
  assert.equal(store.isFound(m), false);
});

test("CODE-10: a throwing listener does not stop the others", async () => {
  const store = await boot();
  const seen = [];
  const log = console.error;
  const errors = [];
  console.error = (...a) => errors.push(a);
  try {
    store.onChange(() => { throw new Error("render failed"); });
    store.onChange((k) => seen.push(k));
    store.setDone("limw.1", true);
    store.setFound(77, true);
  } finally { console.error = log; }
  assert.deepEqual(seen, ["marks", "found"]);
  assert.equal(errors.length, 2);
  assert.equal(store.isDone("limw.1"), true);
});

test("CODE-11: found ids are checked and the count is capped on import, merge and load", async () => {
  const store = await boot();
  const big = {};
  for (let i = 0; i < 200000; i++) big["x" + i] = [1, 1];
  for (let i = 0; i < 12000; i++) big[String(100000 + i)] = [1, i + 1];
  store.importData(JSON.stringify({ marks: {}, found: big }), validIds);
  const n = Object.keys(store.get().found).length;
  assert.ok(n <= store.MAX_FOUND, "kept " + n);
  assert.ok(Object.keys(store.get().found).every((id) => /^\d+$/.test(id)));
  store.mergeExtras({ found: big });
  assert.ok(Object.keys(store.get().found).length <= store.MAX_FOUND);
  const again = await boot({ "tarnished-ledger:v2": JSON.stringify({ found: big }) });
  assert.ok(Object.keys(again.get().found).length <= again.MAX_FOUND);
});

test("UX-1: Reset and Restore keep a before copy and Undo puts it back with fresh stamps", async () => {
  const store = await boot();
  const m = COUNTER_MARKERS.sf[0];
  store.setDone("limw.1", true);
  store.setFound(m, true);
  store.setCounter("rsa", 4);
  assert.equal(store.beforeInfo(), null);
  store.resetProgress([...validIds]);
  assert.equal(store.doneIds().length, 0);
  const info = store.beforeInfo();
  assert.deepEqual([info.reason, info.steps, info.found], ["reset", 1, 1]);
  const resetT = store.get().resetT;
  store.undoLast();
  assert.equal(store.isDone("limw.1"), true);
  assert.equal(store.isFound(m), true);
  assert.equal(store.counter("rsa"), 4);
  assert.ok(store.get().marks["limw.1"][1] > resetT);
  assert.equal(store.beforeInfo(), null);
  // the undone state wins over the reset when it syncs back
  assert.equal(store.mergeMarks({ "limw.1": [0, resetT] }, validIds), false);
  assert.equal(store.mergeExtras({ resetT, found: { [m]: [0, resetT] } }), false);
  assert.equal(store.isFound(m), true);
  // a restore is undoable too, and an empty state does not replace a useful copy
  store.importData("ER1:" + btoa("limw.2"), validIds);
  assert.equal(store.beforeInfo().reason, "restore");
  store.resetProgress([...validIds]);
  store.resetProgress([...validIds]);
  assert.equal(store.beforeInfo().steps, 1);
});

test("UX-1: the before copy stays small even with a huge found set", async () => {
  const store = await boot();
  for (let i = 0; i < 9000; i++) store.get().found[String(i)] = [1, 5];
  store.resetProgress([]);
  assert.ok(localStorage.getItem("tarnished-ledger:v2:before").length < 150000);
});

test("UX-2: an unreadable save is offered back until dismissed", async () => {
  const store = await boot({ "tarnished-ledger:v2": "{oops" });
  assert.equal(store.corruptCopy(), "{oops");
  store.dismissCorrupt();
  assert.equal(store.corruptCopy(), null);
  assert.equal(localStorage.getItem("tarnished-ledger:v2:corrupt"), "{oops");
  const fine = await boot({ "tarnished-ledger:v2": "{}" });
  assert.equal(fine.corruptCopy(), null);
});
