// Bump the version on every published change so clients drop the old cache.
const CACHE = "scale-trainer-v20";
const PRECACHE = [
  "./",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/strings.js",
  "js/theory.js",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/favicon.svg",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "fonts/instrument-sans-latin.woff2",
  "fonts/young-serif-latin.woff2",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App files: network first so updates arrive, cache as offline fallback.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then(hit => hit || (req.mode === "navigate" ? caches.match("index.html") : undefined))
          .then(hit => hit || Response.error())
      )
    );
  }
});
