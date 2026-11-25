const CACHE_NAME = "novelatrad-v27";
const OFFLINE_VOLS_CACHE = "novelatrad-offline-vols";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/state.js",
  "./js/offline.js",
  "./js/media.js",
  "./js/views.js",
  "./js/reader.js",
  "./js/cloud.js",
  "./manifest.json",
  "./launchericon-192x192.png",
  "./launchericon-512x512.png"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== OFFLINE_VOLS_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.open(OFFLINE_VOLS_CACHE).then((volCache) =>
      volCache.match(e.request).then((cachedVolFile) => {
        if (cachedVolFile) return cachedVolFile;
        return fetch(e.request)
          .then((res) => {
            const copia = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copia));
            return res;
          })
          .catch(() => caches.match(e.request));
      })
    )
  );
});