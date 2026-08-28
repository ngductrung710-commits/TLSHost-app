/*
 * Service worker: offline shell and push notifications.
 *
 * Kept small and hand-written. A generated one caches aggressively by default,
 * and this app is a calendar — a stale board that says a room is free when it
 * is not is the single worst thing it could show. So: nothing that comes from
 * the database is ever served from cache.
 */

const CACHE = "tlshost-v1";

/*
 * Only the things that are the same for everyone. No page under /lich,
 * /tong-quan, /dat or anywhere else is listed here, on purpose: those are
 * per-org, per-session, and time-sensitive.
 */
const SHELL = ["/offline", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/*
 * Network first, and cache only as a last resort for navigations.
 *
 * A host who opens the app on a boat with no signal gets a page saying so,
 * rather than yesterday's calendar presented as today's. Everything else —
 * data, forms, the feed — is left to the network entirely.
 */
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() => caches.match("/offline").then((r) => r ?? Response.error())),
  );
});

/*
 * A push carries an encrypted payload only this browser can open. If it
 * arrives without one — some services send a bare wake-up — show something
 * rather than nothing, because a silent push on iOS costs the site its
 * permission.
 */
self.addEventListener("push", (event) => {
  let data = { title: "TLSHost", body: "Có cập nhật mới.", url: "/tong-quan" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
      // Replaces rather than stacks: five bookings overnight should be five
      // lines in one place, not five separate buzzes to dismiss.
      tag: "tlshost-booking",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/tong-quan";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus a tab that is already open rather than piling up new ones.
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
