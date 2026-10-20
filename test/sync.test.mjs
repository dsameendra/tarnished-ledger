import test, { beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { makeStorage, fakeGithub, reply, settle } from "./helpers.mjs";

const handlers = { visibilitychange: [], online: [] };
globalThis.document = { visibilityState: "visible", addEventListener: (n, f) => handlers[n].push(f) };
globalThis.window = { addEventListener: (n, f) => handlers[n].push(f) };
globalThis.localStorage = makeStorage();

const store = await import("../js/lib/store.js");
const sync = await import("../js/lib/sync.js");

const KNOWN = new Set(["prep.1", "prep.2", "prep.3"]);
let gh;
sync.init({ validIds: KNOWN });

beforeEach(() => {
  globalThis.localStorage = makeStorage();
  document.visibilityState = "visible";
  store.load();
  sync.disconnect();
  gh = fakeGithub();
  globalThis.fetch = (u, o) => gh.fetch(u, o);
});
afterEach(() => { mock.timers.reset(); });

const remoteMarks = (id) => gh.content(id).marks;

test("connect creates a private gist holding local progress when none exists", async () => {
  store.setDone("prep.1", true);
  await sync.connect("tok1");
  assert.equal(sync.isConnected(), true);
  assert.equal(sync.status.state, "ok");
  assert.equal(gh.gists.size, 1);
  assert.equal(remoteMarks([...gh.gists.keys()][0])["prep.1"][0], 1);
});

test("connect finds the existing gist and merges its newer marks", async () => {
  const id = gh.seed({ marks: { "prep.1": [1, Date.now() + 5000] }, counters: { sf: [9, Date.now()] }, profile: { t: 0 } });
  await sync.connect("tok1");
  assert.equal(gh.gists.size, 1);
  assert.equal(store.isDone("prep.1"), true);
  assert.equal(store.counter("sf"), 9);
  assert.ok(id);
});

test("older remote data does not undo a newer local change, and local is pushed", async () => {
  store.setDone("prep.1", false);
  const id = gh.seed({ marks: { "prep.1": [1, 5] } });
  await sync.connect("tok1");
  assert.equal(store.isDone("prep.1"), false);
  assert.equal(remoteMarks(id)["prep.1"][0], 0);
});

test("reset on one device propagates: the cleared mark is newer than the remote tick", async () => {
  const id = gh.seed({ marks: { "prep.1": [1, Date.now() - 1000], "prep.2": [1, Date.now() - 1000] } });
  store.resetProgress([...KNOWN]);
  await sync.connect("tok1");
  assert.equal(store.isDone("prep.1"), false);
  assert.equal(store.isDone("prep.2"), false);
  assert.equal(remoteMarks(id)["prep.2"][0], 0);
});

test("remote marks for unknown step ids are ignored", async () => {
  gh.seed(`{"marks":{"nope.1":[1,${Date.now() + 10}],"__proto__":[1,1]}}`);
  await sync.connect("tok1");
  assert.equal(store.get().marks["nope.1"], undefined);
  assert.equal(Object.getPrototypeOf(store.get().marks), Object.prototype);
});

test("a failed download of a truncated file never overwrites the remote", async () => {
  const id = gh.seed({ marks: {} });
  gh.gists.get(id).files["tarnished-ledger.json"] = { truncated: true, raw_url: "https://gist.example/raw", content: "" };
  const real = globalThis.fetch;
  globalThis.fetch = (u, o) => (String(u).startsWith("https://gist.example") ? Promise.resolve(reply(500, "oops")) : real(u, o));
  store.setDone("prep.1", true);
  await sync.connect("tok1").catch(() => {});
  assert.ok(!gh.log.some((l) => l.startsWith("PATCH")), "no PATCH expected: " + gh.log.join(", "));
  assert.equal(sync.status.state, "err");
});

test("an unreadable remote file is treated as empty and rewritten", async () => {
  const id = gh.seed("{not json");
  store.setDone("prep.1", true);
  await sync.connect("tok1");
  assert.equal(remoteMarks(id)["prep.1"][0], 1);
});

test("401 shows the token message and disconnects", async () => {
  await sync.connect("tok1");
  gh.fail = () => reply(401, {});
  await sync.syncNow();
  assert.equal(sync.isConnected(), false);
  assert.match(sync.status.message, /token/);
  assert.equal(globalThis.localStorage.getItem("tarnished-ledger:sync"), null);
});

test("403 with no quota left is a rate limit, any other 403 is a scope problem", async () => {
  await sync.connect("tok1");
  gh.fail = () => reply(403, {}, { "x-ratelimit-remaining": "0" });
  await sync.syncNow();
  assert.match(sync.status.message, /rate limit/);
  assert.equal(sync.isConnected(), true);
  gh.fail = () => reply(403, {});
  await sync.syncNow();
  assert.match(sync.status.message, /gist scope/);
  gh.fail = () => reply(429, {});
  await sync.syncNow();
  assert.match(sync.status.message, /rate limit/);
});

test("offline keeps the connection and local data, then recovers", async () => {
  await sync.connect("tok1");
  gh.offline = true;
  store.setDone("prep.2", true);
  await sync.syncNow();
  assert.equal(sync.status.state, "err");
  assert.match(sync.status.message, /offline/);
  assert.equal(sync.isConnected(), true);
  gh.offline = false;
  await sync.syncNow();
  assert.equal(sync.status.state, "ok");
  assert.equal(remoteMarks([...gh.gists.keys()][0])["prep.2"][0], 1);
});

test("a deleted gist is replaced and local progress is pushed to the new one", async () => {
  await sync.connect("tok1");
  gh.gists.clear();
  store.setDone("prep.3", true);
  await sync.syncNow();
  assert.equal(sync.status.state, "ok");
  assert.equal(gh.gists.size, 1);
  assert.equal(remoteMarks([...gh.gists.keys()][0])["prep.3"][0], 1);
});

test("a hung request times out instead of blocking sync forever", async (t) => {
  await sync.connect("tok1");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.fetch = (u, o) => new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(new Error("aborted"))));
  const p = sync.syncNow();
  await settle(3);
  t.mock.timers.tick(21000);
  await p;
  assert.equal(sync.status.state, "err");
  assert.match(sync.status.message, /in time/);
});

test("ticks are debounced into one sync", async (t) => {
  await sync.connect("tok1");
  gh.log.length = 0;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  store.setDone("prep.1", true);
  store.setDone("prep.2", true);
  t.mock.timers.tick(1000);
  assert.equal(gh.log.length, 0);
  t.mock.timers.tick(600);
  await settle();
  assert.equal(gh.log.filter((l) => l.startsWith("PATCH")).length, 1);
});

test("a tick made while a sync is in flight is synced afterwards", async (t) => {
  await sync.connect("tok1");
  gh.log.length = 0;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let release;
  gh.gateMethod = "PATCH";
  gh.gate = new Promise((r) => { release = r; });
  store.setDone("prep.2", true);
  const p = sync.syncNow();
  await settle(5);
  assert.ok(gh.log.some((l) => l.startsWith("PATCH")), "PATCH should be in flight");
  store.setDone("prep.1", true); // arrives while the PATCH is held
  gh.gate = null;
  release();
  await p;
  t.mock.timers.tick(600);
  await settle();
  assert.equal(remoteMarks([...gh.gists.keys()][0])["prep.1"][0], 1);
});

test("merging remote data does not schedule another sync", async (t) => {
  gh.seed({ marks: { "prep.1": [1, Date.now() + 100] } });
  await sync.connect("tok1");
  gh.log.length = 0;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(gh.log.length, 0);
});

test("disconnect during a sync stops it and does not restore the saved config", async () => {
  await sync.connect("tok1");
  let release;
  gh.gate = new Promise((r) => { release = r; });
  const p = sync.syncNow();
  await settle(3);
  sync.disconnect();
  gh.gate = null;
  release();
  await p;
  assert.equal(sync.isConnected(), false);
  assert.equal(globalThis.localStorage.getItem("tarnished-ledger:sync"), null);
  assert.equal(sync.status.state, "off");
});

test("hiding the page flushes a pending change immediately", async (t) => {
  await sync.connect("tok1");
  gh.log.length = 0;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  store.setDone("prep.1", true);
  document.visibilityState = "hidden";
  handlers.visibilitychange.forEach((f) => f());
  await settle();
  assert.equal(gh.log.filter((l) => l.startsWith("PATCH")).length, 1);
});

test("connect rejects an empty token and a bad token leaves nothing saved", async () => {
  await assert.rejects(sync.connect("  "), /Paste a token/);
  gh.fail = () => reply(401, {});
  await assert.rejects(sync.connect("bad"), /token/);
  assert.equal(sync.isConnected(), false);
  assert.equal(globalThis.localStorage.getItem("tarnished-ledger:sync"), null);
});
