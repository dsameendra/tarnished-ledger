// Offline cache for the app shell. Same-origin files and the Google Fonts hosts only:
// calls to api.github.com (sync) are never intercepted or cached.
// Keep SHELL in step with the files in the repo: `npm run check` fails when they drift apart.
const PREFIX = "tarnished-ledger-";
const CACHE = PREFIX + "v26";
// Map tiles never change under the same name, so they live in their own cache that survives updates.
const TILES = PREFIX + "tiles";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/styles.css", "js/app.js",
  "js/data/route.js", "js/data/trophies.js", "js/data/map.js", "js/data/links.js", "js/data/guide.js", "js/data/dlc-route.js", "js/data/dlc-goals.js", "js/data/map-calib.js", "js/data/map-categories.js", "js/data/map-markers.js", "js/data/map-guide.js", "js/data/map-places.js", "js/data/map-icons.js", "js/data/map-tiles.js", "js/data/twins.js", "js/data/counter-markers.js", "js/data/map-verbs.js", "js/ui/map-progress.js", "js/ui/map-route.js",
  "js/lib/store.js", "js/lib/sync.js", "js/lib/icons.js", "js/lib/wake.js", "js/lib/dom.js", "js/lib/labels.js", "js/lib/model.js",
  "js/ui/nav.js", "js/ui/rail.js", "js/ui/route.js", "js/ui/lists.js", "js/ui/map.js", "js/ui/map-canvas.js", "js/ui/map-data.js", "js/ui/map-glyphs.js", "js/ui/map-state.js",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "js/ui/guide.js", "js/ui/settings.js",
  "assets/icons/icon-64.png", "assets/icons/icon-180.png", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png",
];
// The map pack (about 2.5 MB): images and marker data for every map. Fetched after the app itself is installed and
// never blocks the install, so a failure only means the map is cached on first use instead. Tiles are cached as you view them.
const MAP_PACK = [
  "assets/map/surface.webp", "assets/map/underground.webp", "assets/map/dlc.webp", "assets/map/hub.svg",
  "assets/map/data/base.json", "assets/map/data/under.json", "assets/map/data/dlc.json", "assets/map/data/hub.json",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const NETWORK_WAIT_MS = 6000;

self.addEventListener("install", (e) => {
  // "reload" skips the HTTP cache, so a new version never precaches files that are still cached from the old one.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))
    .then(() => Promise.allSettled(MAP_PACK.map((u) => c.add(new Request(u, { cache: "reload" })))))));
  self.skipWaiting();
});
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
  const font = FONT_HOSTS.includes(url.hostname);
  if (url.origin !== location.origin && !font) return;

  // Map tiles never change under the same name and there are hundreds of them: serve from the cache first.
  if (url.pathname.includes("/assets/map/tiles/")) {
    e.respondWith(caches.open(TILES).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) e.waitUntil(c.put(req, res.clone())); return res; }))));
    return;
  }
  // Network first so a new deploy shows up on the next load. "no-cache" revalidates instead of trusting the
  // HTTP cache (GitHub Pages sends max-age=600). If the network is slow, a cached copy is used after a short wait.
  const network = fetch(req, font ? undefined : { cache: "no-cache" }).then((res) => {
    // Font stylesheets and files are loaded without CORS, so they come back opaque (ok is false); keep those too.
    if (res.status === 200 || (font && res.type === "opaque")) {
      const copy = res.clone();
      e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}));
    }
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_WAIT_MS));
  e.respondWith(
    Promise.race([network, timeout.then(() => fromCache(req).then((hit) => hit || network))])
      .catch(() => fromCache(req).then((hit) => hit || (req.mode === "navigate" ? fromCache(new Request("index.html")) : null)))
      .then((res) => res || Response.error()),
  );
});
