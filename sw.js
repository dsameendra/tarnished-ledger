// Offline cache for the app shell. Same-origin files and the Google Fonts hosts only:
// calls to api.github.com (sync) are never intercepted or cached.
// Keep SHELL in step with the files in the repo: `npm run check` fails when they drift apart.
const PREFIX = "tarnished-ledger-";
const CACHE = PREFIX + "v6";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/styles.css", "js/app.js",
  "js/data/route.js", "js/data/trophies.js", "js/data/map.js", "js/data/links.js", "js/data/guide.js", "js/data/dlc-route.js", "js/data/dlc-goals.js", "js/data/map-calib.js", "js/data/map-categories.js", "js/data/map-markers.js", "js/data/map-guide.js",
  "js/lib/store.js", "js/lib/sync.js", "js/lib/icons.js", "js/lib/wake.js", "js/lib/dom.js", "js/lib/labels.js", "js/lib/model.js",
  "js/ui/nav.js", "js/ui/rail.js", "js/ui/route.js", "js/ui/lists.js", "js/ui/map.js", "js/ui/guide.js", "js/ui/settings.js",
  "assets/icons/icon-64.png", "assets/icons/icon-180.png", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const NETWORK_WAIT_MS = 6000;

self.addEventListener("install", (e) => {
  // "reload" skips the HTTP cache, so a new version never precaches files that are still cached from the old one.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  // Only touch our own caches: on github.io every project site on the account shares one origin.
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
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
