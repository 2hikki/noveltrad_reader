const CACHE_NAME = "novelatrad-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./launchericon-192x192.png",
  "./launchericon-512x512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copia));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});