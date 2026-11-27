/* Cache only an anonymous offline fallback. Never cache account pages, API responses or private files. */
const CACHE = 'b2b-offline-v2';
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
// Payloads contain no private message or account data.
self.addEventListener('push', event => {
  if (!event.data) return;
  event.waitUntil(self.registration.showNotification('Broker2Broker', {
    body: 'You have a new notification. Open the app to view it.',
    icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'b2b-notification', data: { url: '/dashboard/notifications' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate('/dashboard/notifications').then(client => client?.focus());
    return self.clients.openWindow('/dashboard/notifications');
  }));
});
