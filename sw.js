// Offline cache for the app shell. Same-origin files only (fonts are self-hosted):
// calls to api.github.com (sync) are never intercepted or cached.
// Keep SHELL in step with the files in the repo: `npm run check` fails when they drift apart.
const PREFIX = "tarnished-ledger-";
const CACHE = PREFIX + "v39";
const SHELL_HASH = "061c3b8d0ad53ebac58b63cbdf0b5499752758f159c66afabe6bb282e510b485"; // content hash of SHELL + MAP_PACK; `npm run bump` rewrites it, `npm run check` fails when it is stale
// Map tiles never change under the same name, so they live in their own cache that survives updates.
const TILES = PREFIX + "tiles";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/styles.css", "js/app.js",
  "js/data/route.js", "js/data/trophies.js", "js/data/map.js", "js/data/links.js", "js/data/guide.js", "js/data/dlc-route.js", "js/data/dlc-goals.js", "js/data/map-calib.js", "js/data/map-categories.js", "js/data/map-markers.js", "js/data/map-guide.js", "js/data/map-places.js", "js/data/map-icons.js", "js/data/map-tiles.js", "js/data/twins.js", "js/data/counter-markers.js", "js/data/map-verbs.js", "js/ui/map-progress.js", "js/ui/map-route.js",
  "js/lib/store.js", "js/lib/sync.js", "js/lib/icons.js", "js/lib/wake.js", "js/lib/update.js", "js/lib/dom.js", "js/lib/labels.js", "js/lib/model.js",
  "js/ui/nav.js", "js/ui/rail.js", "js/ui/route.js", "js/ui/lists.js", "js/ui/map.js", "js/ui/map-canvas.js", "js/ui/map-data.js", "js/ui/map-glyphs.js", "js/ui/map-state.js",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "js/ui/guide.js", "js/ui/settings.js", "js/ui/toast.js",
  "assets/fonts/AlegreyaSans-400.woff2", "assets/fonts/AlegreyaSans-500.woff2", "assets/fonts/AlegreyaSans-700.woff2", "assets/fonts/Cinzel.woff2", "assets/fonts/OFL-AlegreyaSans.txt", "assets/fonts/OFL-Cinzel.txt",
  "assets/icons/icon-64.png", "assets/icons/icon-180.png", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png",
];
// The map pack (about 2.5 MB): images and marker data for every map. Fetched after the app itself is installed and
// never blocks the install, so a failure only means the map is cached on first use instead. Tiles are cached as you view them.
const MAP_PACK = [
  "assets/map/surface.webp", "assets/map/underground.webp", "assets/map/dlc.webp", "assets/map/hub.svg",
  "assets/map/data/base.json", "assets/map/data/under.json", "assets/map/data/dlc.json", "assets/map/data/hub.json",
];

self.addEventListener("install", (e) => {
  // "reload" skips the HTTP cache, so a new version never precaches files that are still cached from the old one.
  // No skipWaiting here: an updated worker waits until the page asks (js/lib/update.js) or every window is closed,
  // so a running page never gets lazy imports (js/ui/map-data.js) from a newer version than the one it loaded.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))
    .then(() => Promise.allSettled(MAP_PACK.map((u) => c.add(new Request(u, { cache: "reload" })))))));
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  // Only touch our own caches: on github.io every project site on the account shares one origin.
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIX) && k !== CACHE && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const fromCache = (req) => caches.open(CACHE).then((c) => c.match(req, req.mode === "navigate" ? { ignoreSearch: true } : undefined));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Map tiles never change under the same name and there are hundreds of them: serve from the cache first.
  if (url.pathname.includes("/assets/map/tiles/")) {
    e.respondWith(caches.open(TILES).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) e.waitUntil(c.put(req, res.clone())); return res; }))));
    return;
  }
  // Cache first, no background revalidation: every file of one page load comes from the same versioned cache, so
  // versions never mix and startup does not wait on the network. New versions arrive through a changed sw.js.
  // Anything not cached yet (a file added without a bump) goes to the network and is kept.
  e.respondWith(
    fromCache(req).then((hit) => hit || fetch(req, { cache: "no-cache" }).then((res) => {
      if (res.status === 200) {
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}));
      }
      return res;
    })).catch(() => (req.mode === "navigate" ? fromCache(new Request("index.html")) : null)).then((res) => res || Response.error()),
  );
});
