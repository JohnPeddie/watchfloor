/**
 * Minimum fetch handler so Chromium will treat Watchfloor as installable
 * once the page is on HTTPS. Nothing is cached: the dashboard must always
 * talk to the machine that is running it.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
