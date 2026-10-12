/*
 * Service worker za Zasebni šolski urnik.
 *
 * Načela:
 *  - Statične vire (/_next/static, ikone, pisave) strežemo iz predpomnilnika.
 *  - Strani (navigacije) vedno iz omrežja; ob izpadu pokažemo /offline.
 *  - Osebnih podatkov (HTML strani, API odgovorov) NE shranjujemo,
 *    ker gre za zasebno družinsko aplikacijo.
 */

const VERSION = "v5";
const STATIC_CACHE = `urnik-static-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("urnik-") && k !== STATIC_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Nespremenljivi viri, ki jih je varno predpomniti. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // nikoli ne predpomnimo API klicev (zdravje, ics, cron ...)
  if (url.pathname.startsWith("/api/")) return;

  // 1) statični viri — najprej predpomnilnik
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return new Response("", { status: 504, statusText: "Ni povezave" });
        }
      })(),
    );
    return;
  }

  // 2) navigacije — najprej omrežje, sicer offline stran
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(OFFLINE_URL);
          return (
            cached ??
            new Response("<h1>Ni povezave</h1>", {
              status: 503,
              headers: { "content-type": "text/html; charset=utf-8" },
            })
          );
        }
      })(),
    );
  }
});

// Omogoči takojšnjo posodobitev iz strani
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// --- Push obvestila -------------------------------------------------------------

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Šolski urnik", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Šolski urnik";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          await c.focus();
          if ("navigate" in c) {
            try {
              await c.navigate(target);
            } catch {
              /* prezri */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// brskalnik je zamenjal naročnino (npr. potekla) — odjemalec jo ob naslednjem obisku obnovi
self.addEventListener("pushsubscriptionchange", () => {});
