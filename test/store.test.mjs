import test from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const store = await import("../js/lib/store.js");

test("mergeExtras: newest counter wins, clamped, unknown ids ignored", () => {
  store.load();
  store.setCounter("sf", 3);
  const t = store.get().counters.sf[1];
  assert.equal(store.mergeExtras({ counters: { sf: [10, t - 1000] } }), false);
  assert.equal(store.counter("sf"), 3);
  assert.equal(store.mergeExtras({ counters: { sf: [99, t + 1000], bogus: [5, t + 1000] } }), true);
  assert.equal(store.counter("sf"), 50);
  assert.equal(store.get().counters.bogus, undefined);
});

test("mergeExtras: newer profile applies, older is ignored", () => {
  store.setSetting("dlc", true);
  const t = store.get().profileT;
  assert.equal(store.mergeExtras({ profile: { t: t - 1, dlc: false, focus: "dlc", platform: "xbox" } }), false);
  assert.equal(store.setting("dlc"), true);
  assert.equal(store.mergeExtras({ profile: { t: t + 5, dlc: false, focus: "dlc", platform: "xbox" } }), true);
  assert.equal(store.setting("dlc"), false);
  assert.equal(store.setting("focus"), "dlc");
  assert.equal(store.setting("platform"), "xbox");
});

test("remoteCovers: false when local is newer, true once remote catches up", () => {
  store.setDone("prep.1", true);
  store.setCounter("rsa", 4);
  const snap = JSON.parse(JSON.stringify(store.snapshot()));
  assert.equal(store.remoteCovers(snap), true);
  assert.equal(store.remoteCovers({ marks: snap.marks, counters: {}, profile: snap.profile }), false);
  assert.equal(store.remoteCovers({ marks: {}, counters: snap.counters, profile: snap.profile }), false);
  assert.equal(store.remoteCovers({ marks: snap.marks, counters: snap.counters, profile: { t: 0 } }), false);
});

test("mergeMarks: newest wins per step", () => {
  const t = store.get().marks["prep.1"][1];
  store.mergeMarks({ "prep.1": [0, t - 10] });
  assert.equal(store.isDone("prep.1"), true);
  store.mergeMarks({ "prep.1": [0, t + 10] });
  assert.equal(store.isDone("prep.1"), false);
});

test("importData restores counters from a v3 backup", () => {
  store.importData({ marks: {}, counters: { sf: [7, 1] } });
  assert.equal(store.counter("sf"), 7);
});

test("twin steps (base route and the DLC prerequisites) tick together and settle by newest timestamp", async () => {
  const { TWINS } = await import("../js/data/twins.js");
  const [a, b] = TWINS[0];
  store.setDone(a, true);
  assert.equal(store.isDone(b), true);
  store.setDone(b, false);
  assert.equal(store.isDone(a), false);
  store.setDoneMany([a], true);
  assert.equal(store.isDone(b), true);
  // a remote copy that only knows one of them, and is newer, settles both
  store.mergeMarks({ [a]: [0, Date.now() + 5000] });
  assert.equal(store.isDone(b), false);
});

test("blessing counter = markers found on the map + hand-set offset; both devices' finds count after a merge", async () => {
  const { COUNTER_MARKERS } = await import("../js/data/counter-markers.js");
  const [a, b, c] = COUNTER_MARKERS.sf;
  store.resetProgress([]);
  store.setCounter("sf", 5);
  assert.equal(store.counter("sf"), 5);
  store.setFound(a, true);
  assert.equal(store.counter("sf"), 6);
  // another device found b while offline
  store.mergeExtras({ found: { [b]: [1, Date.now() + 10] } });
  assert.equal(store.counter("sf"), 7);
  store.setCounter("sf", 1); // below the number found: the offset goes negative, the display follows
  assert.equal(store.counter("sf"), 1);
  store.setFound(c, true);
  assert.equal(store.counter("sf"), 2);
  store.setCounter("sf", 0);
  assert.equal(store.counter("sf"), 0);
});
