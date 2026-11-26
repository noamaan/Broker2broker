const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function worker(fetchImpl = async () => 'online') {
  const handlers = {};
  const cached = [];
  const deleted = [];
  const notices = [];
  const self = { registration: { showNotification: async (title, options) => notices.push({ title, options }) }, location: { origin: 'https://example.test' }, clients: { claim: async () => {} }, skipWaiting: async () => {}, addEventListener: (name, fn) => { handlers[name] = fn; } };
  const caches = { open: async () => ({ add: async path => cached.push(path) }), keys: async () => ['b2b-offline-old', 'other-cache'], delete: async name => deleted.push(name), match: async path => path === '/offline.html' ? 'offline fallback' : undefined };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), { self, caches, fetch: fetchImpl, URL, Response, Promise });
  return { handlers, cached, deleted, notices };
}
function event(request) { return { request, respondWith(value) { this.response = value; }, waitUntil(value) { this.wait = value; } }; }
test('installation caches only the offline fallback; activation clears only old app caches', async () => {
  const w = worker(); const install = event(); w.handlers.install(install); await install.wait;
  assert.deepEqual(w.cached, ['/offline.html']);
  const activate = event(); w.handlers.activate(activate); await activate.wait;
  assert.deepEqual(w.deleted, ['b2b-offline-old']);
});
test('navigation is network first and has a safe offline fallback', async () => {
  const online = worker(); const req = { method: 'GET', mode: 'navigate', url: 'https://example.test/dashboard' };
  const e = event(req); online.handlers.fetch(e); assert.equal(await e.response, 'online');
  const offline = worker(async () => { throw new Error('offline'); }); const e2 = event(req); offline.handlers.fetch(e2); assert.equal(await e2.response, 'offline fallback');
});
test('API, asset, cross-origin and non-GET requests are never intercepted', () => {
  const w = worker();
  for (const request of [
    { method: 'GET', mode: 'cors', url: 'https://example.test/api/listings' },
    { method: 'GET', mode: 'no-cors', url: 'https://example.test/api/files/private' },
    { method: 'POST', mode: 'navigate', url: 'https://example.test/dashboard' },
    { method: 'GET', mode: 'navigate', url: 'https://other.test/' }
  ]) { const e = event(request); w.handlers.fetch(e); assert.equal(e.response, undefined); }
});

test('push alerts are generic and never display private payload content', async () => {
  const w=worker(); const e=event(); e.data={json:()=>({title:'private name',body:'secret details'})}; w.handlers.push(e); await e.wait;
  assert.equal(w.notices[0].title,'Broker2Broker');
  assert.equal(w.notices[0].options.body,'You have a new notification. Open the app to view it.');
  assert.equal(w.notices[0].options.data.url,'/dashboard/notifications');
});
