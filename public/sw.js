// Calandre service worker.
// - App shell: pages are network-first with a cached fallback, then /offline.html.
// - Hashed build assets and icons: cache-first (their URLs change when they change).
// - Car photos: cache-first in their own bounded cache, so photos already seen work offline.
const VERSION = "calandre-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const PHOTO_CACHE = `${VERSION}-photos`;
/** Each car has two renditions; this keeps the photo cache around 25 MB at most. */
const MAX_PHOTOS = 160;
const SHELL = ["/", "/play", "/categories", "/stats", "/settings", "/credits", "/offline.html", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Drops the oldest photos once the cache grows past its limit (insertion order ≈ age). */
async function trimPhotos() {
  const cache = await caches.open(PHOTO_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_PHOTOS)).map((key) => cache.delete(key)));
}

async function cacheFirst(request, cacheName, onStore) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    if (onStore) onStore();
  }
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ??
      (await cache.match("/offline.html")) ??
      Response.error()
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only same-origin traffic is cached; external links are never intercepted.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/cars/")) {
    event.respondWith(cacheFirst(request, PHOTO_CACHE, () => trimPhotos()));
    return;
  }
  if (/^\/(_next\/static|icons)\//.test(url.pathname) || url.pathname === "/icon.svg") {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});
