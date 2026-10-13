const CACHE = "bento-rice-v22";
const FILES = [
  "./",
  "./index.html",
  "./css/app.css?v=20",
  "./js/menus.js?v=22",
  "./js/calc.js",
  "./js/app.js?v=22",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(FILES);
  }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
      return caches.delete(key);
    }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request, { cache: "no-cache" }).then(function (response) {
    var copy = response.clone();
    caches.open(CACHE).then(function (cache) {
      cache.put(event.request, copy);
    });
    return response;
  }).catch(function () {
    return caches.match(event.request);
  }));
});
