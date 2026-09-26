// Generated build replaces the version and precache list. Persistent job data is never touched.
const VERSION = "__PILLAR_CACHE__";
const PREFIX = "fortestack-shell-" + encodeURIComponent(self.registration.scope) + "-";
const CACHE = PREFIX + VERSION;
const SHELL = /* __PILLAR_PRECACHE__ */ ["./", "./manifest.webmanifest", "./fortestack-icon.svg", "./fonts/DejaVuSans.ttf"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
    (key.startsWith(PREFIX) && key !== CACHE) || ["fortestack-shell-v1","fortestack-shell-v2","fortestack-shell-v3"].includes(key)
  ).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if (event.request.mode !== "navigate" && cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return cached || (event.request.mode === "navigate" ? await cache.match("./") : undefined) || Response.error();
    }
  })());
});
