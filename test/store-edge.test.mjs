import test from "node:test";
import assert from "node:assert/strict";
import { makeStorage } from "./helpers.mjs";

globalThis.localStorage = makeStorage();
const store = await import("../js/lib/store.js");

// Fresh storage for each test.
const fresh = (seed) => { globalThis.localStorage = makeStorage(seed); store.load(); };

test("load: corrupt JSON keeps defaults and preserves the raw text", () => {
  fresh({ "tarnished-ledger:v2": "{oops" });
  assert.equal(store.isStorageOK(), true);
  assert.deepEqual(store.get().marks, {});
  assert.equal(localStorage.getItem("tarnished-ledger:v2:corrupt"), "{oops");
  fresh({ "tarnished-ledger:v2": "null" });
  assert.equal(store.setting("platform"), "ps");
});

test("load: malformed entries and settings are dropped, not trusted", () => {
  fresh({ "tarnished-ledger:v2": `{
    "marks": { "a.1": [1, 5], "a.2": "x", "a.3": [1, "NaN"], "__proto__": [1, 1] },
    "counters": { "sf": [999, 3], "toString": [1, 1], "rsa": ["x", 4] },
    "settings": { "platform": "<img>", "dlc": "yes", "focus": "dlc", "mode": "dark", "extra": 1 },
    "profileT": "nope" }` });
  assert.deepEqual(Object.keys(store.get().marks), ["a.1"]);
  assert.equal(Object.getPrototypeOf(store.get().marks), Object.prototype);
  assert.equal(store.counter("sf"), 50);
  assert.equal(store.counter("rsa"), 0);
  assert.deepEqual(Object.keys(store.get().counters), ["sf", "rsa"]);
  assert.equal(store.setting("platform"), "ps");
  assert.equal(store.setting("dlc"), false);
  assert.equal(store.setting("focus"), "dlc");
  assert.equal(store.setting("mode"), "dark");
  assert.equal(store.setting("extra"), undefined);
  assert.equal(store.get().profileT, 0);
});

test("load: blocked storage reports not saving instead of throwing", () => {
  globalThis.localStorage = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() {} };
  store.load();
  assert.equal(store.isStorageOK(), false);
  store.setDone("x.1", true);
  assert.equal(store.isDone("x.1"), true);
});

test("write: a quota error flips the storage flag and a later success clears it", () => {
  fresh();
  const ok = globalThis.localStorage;
  globalThis.localStorage = { ...ok, setItem() { throw new Error("QuotaExceededError"); } };
  store.setDone("x.1", true);
  assert.equal(store.isStorageOK(), false);
  globalThis.localStorage = ok;
  store.setDone("x.2", true);
  assert.equal(store.isStorageOK(), true);
});

test("legacy er100-v1 save migrates, keeping only known settings", () => {
  fresh({ "er100-v1": JSON.stringify({ done: { "prep.1": 1, "prep.2": 1 }, t: 1234, set: { accent: "frost", bogus: 1 }, closed: { p1: true } }) });
  assert.deepEqual(store.doneIds().sort(), ["prep.1", "prep.2"]);
  assert.equal(store.get().marks["prep.1"][1], 1234);
  assert.equal(store.setting("accent"), "frost");
  assert.equal(store.setting("bogus"), undefined);
  assert.ok(localStorage.getItem("tarnished-ledger:v2"));
  fresh({ "er100-v1": "garbage" });
  assert.deepEqual(store.doneIds(), []);
});

test("setCounter: clamps, rounds, rejects NaN and unknown ids", () => {
  fresh();
  store.setCounter("sf", 80);
  assert.equal(store.counter("sf"), 50);
  store.setCounter("sf", -4);
  assert.equal(store.counter("sf"), 0);
  store.setCounter("rsa", 2.6);
  assert.equal(store.counter("rsa"), 3);
  store.setCounter("rsa", NaN);
  assert.equal(store.counter("rsa"), 0);
  store.setCounter("nope", 5);
  assert.equal(store.get().counters.nope, undefined);
});

test("mergeMarks: ties settle on done, so two devices converge", () => {
  fresh();
  store.mergeMarks({ "a.1": [0, 100] });
  assert.equal(store.mergeMarks({ "a.1": [1, 100] }), true);
  assert.equal(store.isDone("a.1"), true);
  assert.equal(store.mergeMarks({ "a.1": [0, 100] }), false);
  assert.equal(store.remoteCovers({ marks: { "a.1": [0, 100] } }), false);
  assert.equal(store.remoteCovers({ marks: { "a.1": [1, 100] } }), true);
});

test("mergeMarks: junk and unknown ids are skipped", () => {
  fresh();
  assert.equal(store.mergeMarks({ "a.1": "x", "a.2": [1], "a.3": [1, "z"], "a.4": [1, 9] }, new Set(["a.1", "a.2", "a.3"])), false);
  assert.equal(store.mergeMarks(null), false);
  assert.equal(store.mergeMarks([1, 2]), false);
});

test("mergeExtras: remote profile with unknown values is ignored", () => {
  fresh();
  assert.equal(store.mergeExtras({ profile: { t: 10, platform: "<script>", dlc: "1", focus: "x" } }), false);
  assert.equal(store.setting("platform"), "ps");
  assert.equal(store.mergeExtras(JSON.parse('{"counters":{"constructor":[3,9],"__proto__":[1,1]}}')), false);
});

test("resetProgress clears marks and counters, and stamps ids it had never seen", () => {
  fresh();
  store.setDone("a.1", true);
  store.setCounter("sf", 9);
  store.resetProgress(["a.9"]);
  assert.deepEqual(store.doneIds(), []);
  assert.equal(store.counter("sf"), 0);
  assert.equal(store.get().marks["a.9"][0], 0);
  // An older remote tick must not bring it back.
  assert.equal(store.mergeMarks({ "a.9": [1, 5], "a.1": [1, 5] }), false);
});

test("importData: bad input throws and leaves progress untouched", () => {
  fresh();
  store.setDone("a.1", true);
  for (const bad of ["not json", "[]", "5", "null", '{"marks":5}', '{"marks":[1]}', "ER1:%%%"]) {
    assert.throws(() => store.importData(bad), undefined, bad);
  }
  assert.equal(store.isDone("a.1"), true);
});

test("importData: ER1 code and v1 backup, filtered by valid ids", () => {
  fresh();
  const valid = new Set(["a.1", "a.2"]);
  assert.equal(store.importData("ER1:" + btoa("a.1,a.2,zzz.9"), valid), 2);
  assert.equal(store.get().marks["zzz.9"], undefined);
  assert.equal(store.importData({ done: { "a.2": 1 }, t: 5 }, valid), 1);
  assert.equal(store.isDone("a.1"), false);
  assert.equal(store.isDone("a.2"), true);
});

test("importData: imported ticks beat an older remote copy but not a newer one", () => {
  fresh();
  store.importData({ marks: { "a.1": [1, 1] } });
  const t = store.get().marks["a.1"][1];
  assert.equal(store.mergeMarks({ "a.1": [0, t - 1] }), false);
  assert.equal(store.mergeMarks({ "a.1": [0, t + 1] }), true);
});

test("snapshot is a copy: later ticks do not change an earlier snapshot", () => {
  fresh();
  const snap = store.snapshot();
  store.setDone("a.1", true);
  assert.equal(snap.marks["a.1"], undefined);
});
