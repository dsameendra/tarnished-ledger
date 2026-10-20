import test from "node:test";
import assert from "node:assert/strict";
import { makeStorage } from "./helpers.mjs";

async function boot(seed = {}) {
  globalThis.localStorage = makeStorage(seed);
  const store = await import("../js/lib/store.js?" + Math.random());
  store.load();
  return store;
}

test("found markers: set, query and emit", async () => {
  const store = await boot();
  const seen = [];
  store.onChange((k) => seen.push(k));
  store.setFound(101, true);
  assert.equal(store.isFound(101), true);
  assert.equal(store.isFound("101"), true);
  store.setFound("101", false);
  assert.equal(store.isFound(101), false);
  assert.deepEqual(seen, ["found", "found"]);
});

test("found markers: newest wins per marker and un-finding syncs", async () => {
  const store = await boot();
  store.setFound(1, true);
  const t = store.get().found["1"][1];
  assert.equal(store.mergeExtras({ found: { 1: [0, t - 5], 2: [1, t] } }), true);
  assert.equal(store.isFound(1), true);
  assert.equal(store.isFound(2), true);
  assert.equal(store.mergeExtras({ found: { 1: [0, t + 5] } }), true);
  assert.equal(store.isFound(1), false);
});

test("found markers: junk in remote data is dropped", async () => {
  const store = await boot();
  store.mergeExtras({ found: { __proto__: [1, 5], "7": "x", "8": [1, "nope"], "9": [1, 10] } });
  assert.deepEqual(Object.keys(store.get().found), ["9"]);
});

test("map prefs: newest wins, junk is cleaned, defaults when missing", async () => {
  const store = await boot();
  assert.deepEqual(store.mapPrefs(), { on: true, hideFound: false, route: true, cats: null });
  store.setMapPrefs({ hideFound: true, cats: [5664, "5655"] });
  const t = store.get().mapT;
  assert.equal(store.mergeExtras({ mapPrefs: { t: t - 1, hideFound: false } }), false);
  assert.equal(store.mapPrefs().hideFound, true);
  assert.equal(store.mergeExtras({ mapPrefs: { t: t + 1, on: false, hideFound: "yes", cats: [1, {}, "2"] } }), true);
  assert.deepEqual(store.mapPrefs(), { on: false, hideFound: false, route: true, cats: [1, "2"] });
});

test("snapshot carries found markers and map prefs; remoteCovers checks them", async () => {
  const store = await boot();
  store.setFound(3, true);
  store.setMapPrefs({ route: false });
  const snap = JSON.parse(JSON.stringify(store.snapshot()));
  assert.equal(snap.v, 4);
  assert.deepEqual(Object.keys(snap.found), ["3"]);
  assert.equal(snap.mapPrefs.route, false);
  assert.equal(store.remoteCovers(snap), true);
  assert.equal(store.remoteCovers({ ...snap, found: {} }), false);
  assert.equal(store.remoteCovers({ ...snap, mapPrefs: { t: 0 } }), false);
});

test("reset progress clears found markers; backups restore them", async () => {
  const store = await boot();
  store.setFound(4, true);
  const backup = JSON.parse(JSON.stringify(store.snapshot()));
  store.resetProgress();
  assert.equal(store.isFound(4), false);
  store.importData(backup);
  assert.equal(store.isFound(4), true);
});

test("old map keys are folded in once with timestamp 1", async () => {
  const store = await boot({
    "tarnished-ledger:map-found": JSON.stringify([11, "12"]),
    "tarnished-ledger:map-filter": JSON.stringify({ on: false, hideFound: true, cats: [1, 2], panel: true }),
    "tarnished-ledger:v2": JSON.stringify({ v: 3, marks: {}, counters: {}, settings: {} }),
  });
  assert.equal(store.isFound(11), true);
  assert.equal(store.isFound(12), true);
  assert.equal(globalThis.localStorage.getItem("tarnished-ledger:map-found"), null);
  assert.deepEqual(store.mapPrefs(), { on: false, hideFound: true, route: true, cats: [1, 2] });
  assert.equal(store.get().mapT, 1);
  // a device that already decided something newer wins over the migrated data
  assert.equal(store.mergeExtras({ found: { 11: [0, 50] } }), true);
  assert.equal(store.isFound(11), false);
});

test("old map keys are folded in even when no other progress was saved yet", async () => {
  const store = await boot({ "tarnished-ledger:map-found": JSON.stringify([77]) });
  assert.equal(store.isFound(77), true);
  assert.ok(globalThis.localStorage.getItem("tarnished-ledger:v2"), "migrated data is written to the main store");
});

test("setDoneMany ticks and unticks several steps with one update", async () => {
  const store = await boot();
  let n = 0;
  store.onChange((k) => { if (k === "marks") n++; });
  store.setDoneMany(["a.1", "a.2", "a.3"], true);
  assert.equal(n, 1);
  assert.deepEqual(["a.1", "a.2", "a.3"].map((i) => store.isDone(i)), [true, true, true]);
  store.setDoneMany(["a.1", "a.2"], false);
  assert.deepEqual(["a.1", "a.2", "a.3"].map((i) => store.isDone(i)), [false, false, true]);
  assert.ok(store.get().marks["a.1"][1] > store.get().marks["a.3"][1] - 1, "later change is newer");
});
