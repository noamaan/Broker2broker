/* Cache only an anonymous offline fallback. Never cache account pages, API responses or private files. */
const CACHE = 'b2b-offline-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('b2b-offline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
});
