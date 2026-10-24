// Calandre service worker.
// - App shell, catalogue and car details shards: network-first with a cached fallback, then /offline.html.
// - Hashed build assets and icons: cache-first (their URLs change when they change).
// - Car photos are hotlinked from Wikimedia Commons and deliberately NOT cached here:
//   only the browser's own (bounded) HTTP cache may keep recently seen ones.
const VERSION = "calandre-v3";
const SHELL_CACHE = `${VERSION}-shell`;
const SHELL = [
  "/",
  "/play",
  "/categories",
  "/garage",
  "/stats",
  "/settings",
  "/credits",
  "/offline.html",
  "/catalogue.json",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
];

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
      // Also removes the v1 photo cache from when photos were bundled.
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, fallback) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ?? (fallback ? await cache.match(fallback) : undefined) ?? Response.error()
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Cross-origin requests (Wikimedia photos, Wikipedia links…) are left to the browser.
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/catalogue.json" || url.pathname.startsWith("/details/")) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (/^\/(_next\/static|icons)\//.test(url.pathname) || url.pathname === "/icon.svg") {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/offline.html"));
  }
});
