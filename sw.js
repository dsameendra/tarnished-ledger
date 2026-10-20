// Offline cache for the app shell. Same-origin files and the Google Fonts hosts only:
// calls to api.github.com (sync) are never intercepted or cached.
const CACHE = "tarnished-ledger-v5";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/styles.css", "js/app.js",
  "js/data/route.js", "js/data/trophies.js", "js/data/map.js", "js/data/links.js", "js/data/guide.js", "js/data/dlc-route.js", "js/data/dlc-goals.js",
  "js/lib/store.js", "js/lib/sync.js", "js/lib/icons.js", "js/lib/wake.js", "js/lib/dom.js", "js/lib/labels.js", "js/lib/model.js",
  "js/ui/nav.js", "js/ui/rail.js", "js/ui/route.js", "js/ui/lists.js", "js/ui/map.js", "js/ui/guide.js", "js/ui/settings.js",
  "assets/icons/icon-64.png", "assets/icons/icon-180.png", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !FONT_HOSTS.includes(url.hostname)) return;
  // Network first so a new deploy shows up on the next load; fall back to cache offline.
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))),
  );
});
