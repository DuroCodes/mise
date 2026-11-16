// Mise service worker: makes the app installable and keeps recipes you have
// opened readable without a connection. Cache names match src/lib/offline.ts.
// Bump the version comment when this file changes so browsers pick it up: v2.
const SHELL = "mise-shell-v1";
const API = "mise-api-v1";
const IMAGES = "mise-images-v1";
const KEEP = [SHELL, API, IMAGES];

// Read-only API routes worth keeping for offline use. Everything else
// (auth, admin, imports, AI, writes) always goes to the network.
const CACHEABLE_API = [
  /^\/api\/me$/,
  /^\/api\/features$/,
  /^\/api\/tags$/,
  /^\/api\/recipes$/,
  /^\/api\/recipes\/[^/]+$/,
  /^\/api\/recipes\/[^/]+\/logs$/,
  /^\/api\/shopping$/,
  /^\/api\/collections$/,
  /^\/api\/collections\/[^/]+$/,
  /^\/api\/plan$/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/favicon.svg"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("mise-") && !KEEP.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

const trim = async (cacheName, max) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const request of keys.slice(0, Math.max(0, keys.length - max)))
    await cache.delete(request);
};

const networkFirst = async (request, cacheName, cacheKey = request) => {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200)
      await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
};

const cacheFirst = async (request, cacheName, max) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.status === 200) {
    await cache.put(request, response.clone());
    void trim(cacheName, max);
  }
  return response;
};

const offlineJson = () =>
  new Response(JSON.stringify({ error: "You're offline" }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });

// Notifications --------------------------------------------------------------

self.addEventListener("push", (event) => {
  let note = {};
  try {
    note = event.data ? event.data.json() : {};
  } catch {
    note = { title: "Mise", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    (async () => {
      // A timer already chimes in an open, visible tab; don't double up.
      if (note.kind === "timer") {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        if (windows.some((client) => client.visibilityState === "visible")) return;
      }
      await self.registration.showNotification(note.title || "Mise", {
        body: note.body || "",
        tag: note.tag || undefined,
        renotify: note.kind === "timer",
        requireInteraction: note.kind === "timer",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: typeof note.url === "string" && note.url.startsWith("/") ? note.url : "/" },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(url).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;

  if (request.mode === "navigate") {
    if (path.startsWith("/api/")) return;
    event.respondWith(
      networkFirst(request, SHELL, "/").catch(
        () => new Response("Offline", { status: 503 })
      )
    );
    return;
  }

  if (path.startsWith("/api/")) {
    if (!CACHEABLE_API.some((pattern) => pattern.test(path))) return;
    event.respondWith(
      networkFirst(request, API).catch(() => offlineJson())
    );
    return;
  }

  if (path.startsWith("/uploads/")) {
    event.respondWith(cacheFirst(request, IMAGES, 300));
    return;
  }

  if (path.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, SHELL, 80));
    return;
  }

  if (/\.(?:svg|png|webmanifest|ico)$/.test(path)) {
    event.respondWith(cacheFirst(request, SHELL, 80));
  }
});
