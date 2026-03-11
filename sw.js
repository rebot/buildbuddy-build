const CACHE_VERSION = "buildbuddy-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const APP_SCOPE = new URL("./", self.location).pathname;
const OFFLINE_DOCUMENT = `${APP_SCOPE}index.html`;

const APP_SHELL = [
  `${APP_SCOPE}`,
  OFFLINE_DOCUMENT,
  `${APP_SCOPE}manifest.webmanifest`,
  `${APP_SCOPE}icons/buildbuddy-logo.svg`,
  `${APP_SCOPE}icons/pwa-192x192.png`,
  `${APP_SCOPE}icons/pwa-512x512.png`,
  `${APP_SCOPE}icons/apple-touch-icon.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith("buildbuddy-") && !name.startsWith(CACHE_VERSION))
          .map((name) => caches.delete(name)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseCopy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseCopy));
          return response;
        })
        .catch(async () => {
          const cachedDocument = await caches.match(request);
          if (cachedDocument) {
            return cachedDocument;
          }
          const offlineDocument = await caches.match(OFFLINE_DOCUMENT);
          return offlineDocument || Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          const responseCopy = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseCopy));
          return networkResponse;
        })
        .catch(() => Response.error());
    }),
  );
});
