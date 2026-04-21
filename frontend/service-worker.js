const CACHE_NAME = "dois-irmaos-static-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/static/css/styles.css",
  "/static/js/app.js",
  "/static/js/api.js",
  "/static/js/helpers.js",
  "/static/js/charts.js",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/icons/apple-touch-icon.png",
];

const DEV_HOST_REGEX = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/;
const DEV_MODE = self.location.protocol !== "https:" || DEV_HOST_REGEX.test(self.location.hostname) || self.location.port === "8000";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (DEV_MODE) return;

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        if (DEV_MODE) return caches.delete(key);
        return key !== CACHE_NAME ? caches.delete(key) : Promise.resolve(false);
      }),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (DEV_MODE) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put("/", networkResponse.clone());
        return networkResponse;
      } catch {
        return caches.match("/") || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const fetchPromise = fetch(request).then(async (networkResponse) => {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    });

    return cached || fetchPromise;
  })());
});
