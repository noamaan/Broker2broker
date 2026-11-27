const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { act } = React;
const { JSDOM } = require('jsdom');

function load(path, modules, extras = {}) {
  const source = fs.readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => modules[name] ?? require(name), process, Buffer, console, URL, Date, setTimeout, ...extras }, { filename: path });
  return exports;
}

test('header follows the dashboard session for signed-in and signed-out accounts on desktop and mobile', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/' });
  const old = { window: global.window, document: global.document, navigator: global.navigator, Event: global.Event, fetch: global.fetch, act: global.IS_REACT_ACT_ENVIRONMENT, secret: process.env.B2B_SESSION_SECRET };
  global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.Event = dom.window.Event; global.IS_REACT_ACT_ENVIRONMENT = true;
  process.env.B2B_SESSION_SECRET = 'isolated-test-secret-not-used-in-production';
  const { createRoot } = require('react-dom/client');
  let cookie = '';
  const jar = { get: () => cookie ? { value: cookie } : undefined, set: (_key, value) => { cookie = value; } };
  const user = { userID: 'test-member', fullName: 'Test Member', role: 'USER', accountStatus: 'ACTIVE', membershipStatus: 'ACTIVE', currentPlan: 'YEARLY', membershipExpiresAt: '2027-11-27T00:00:00Z' };
  const auth = load('lib/server/auth.ts', { 'server-only': {}, 'next/headers': { cookies: async () => jar }, './backend': { backendRequest: async (_action, data) => data.userID === user.userID ? user : null } });
  const http = {
    ok: data => Response.json(data, { headers: { 'Cache-Control': 'no-store' } }),
    apiError: e => Response.json({ error: { code: e.code, message: e.message } }, { status: e.status || 500 })
  };
  const me = load('app/api/auth/me/route.ts', { '@/lib/server/auth': auth, '@/lib/server/http': http });
  let fail = false;
  const fetch = async (url, init) => {
    if (url === '/api/auth/me') { assert.equal(init.cache, 'no-store'); assert.equal(init.credentials, 'same-origin'); if (fail) throw Error('offline'); return me.GET(); }
    if (url === '/api/auth/login') { await auth.setSessionCookie(user.userID); return Response.json({ user }); }
    if (url === '/api/auth/logout') { await auth.clearSessionCookie(); return Response.json({ signedOut: true }); }
    throw Error(`unexpected request ${url}`);
  };
  global.fetch = fetch;
  const extras = { window: dom.window, document: dom.window.document, Event: dom.window.Event, fetch };
  const api = load('lib/client/api.ts', {}, extras);
  const modules = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) }, 'next/navigation': { usePathname: () => '/', useRouter: () => ({ push() {}, refresh() {} }) }, 'lucide-react': Object.fromEntries(['Menu','X','ArrowUpRight','Building2'].map(k => [k, () => null])), '@/lib/branding': { BRAND_NAME: 'Broker2Broker' }, '@/lib/client/api': api };
  const { SiteHeader } = load('components/site-header.tsx', modules, extras);
  const root = createRoot(dom.window.document.getElementById('root'));
  const desktop = () => document.querySelector('[aria-label="Account navigation"]');
  const mobile = () => document.querySelector('[aria-label="Mobile navigation"]');
  const contains = (element, text) => element.textContent.includes(text);
  const click = async element => act(async () => { element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 0)); });
  try {
    await act(async () => { root.render(React.createElement(SiteHeader)); await new Promise(resolve => setTimeout(resolve, 0)); });
    const anonymous = await me.GET(); assert.equal(anonymous.status, 401); assert.equal(anonymous.headers.get('cache-control'), 'no-store');
    cookie = 'tampered-token'; assert.equal((await me.GET()).status, 401); cookie = '';
    assert.ok(contains(desktop(), 'Log in') && contains(desktop(), 'Join the network'));
    await click(document.querySelector('[aria-label="Open navigation"]'));
    assert.ok(contains(mobile(), 'Log in') && contains(mobile(), 'Join free'));
    assert.equal(mobile().querySelector('a[href="/register"]').textContent, 'Join free');

    await act(async () => { await api.apiFetch('/api/auth/login', { method: 'POST' }); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal((await auth.getCurrentUser()).userID, user.userID); // The same server check used by the dashboard.
    const signedIn = await me.GET(); assert.equal(signedIn.status, 200); assert.equal(signedIn.headers.get('cache-control'), 'no-store');
    user.membershipStatus = 'EXPIRED';
    assert.equal((await me.GET()).status, 200, 'sign-in state is independent of membership');
    user.membershipStatus = 'ACTIVE';
    for (const nav of [desktop(), mobile()]) {
      assert.ok(contains(nav, 'Dashboard') && contains(nav, 'Profile') && contains(nav, 'Sign out'));
      assert.ok(!contains(nav, 'Log in') && !contains(nav, 'Join free') && !contains(nav, 'Join the network'));
    }
    fail = true;
    await act(async () => { window.dispatchEvent(new Event('focus')); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.ok(contains(desktop(), 'Dashboard'), 'offline errors must not pretend the user logged out');
    fail = false;
    await click([...mobile().querySelectorAll('button')].find(el => el.textContent === 'Sign out'));
    assert.equal(await auth.getCurrentUser(), null);
    assert.ok(contains(desktop(), 'Log in'));
    await click(document.querySelector('[aria-label="Open navigation"]'));
    assert.ok(contains(mobile(), 'Join free'));
    // A session changed in another tab is checked again, not trusted from storage.
    await auth.setSessionCookie(user.userID);
    await act(async () => { window.dispatchEvent(new dom.window.StorageEvent('storage', { key: api.AUTH_CHANGED_STORAGE_KEY, newValue: 'changed' })); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.ok(contains(desktop(), 'Dashboard') && contains(mobile(), 'Dashboard'));
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    global.window = old.window; global.document = old.document; global.navigator = old.navigator; global.Event = old.Event; global.fetch = old.fetch; global.IS_REACT_ACT_ENVIRONMENT = old.act;
    if (old.secret === undefined) delete process.env.B2B_SESSION_SECRET; else process.env.B2B_SESSION_SECRET = old.secret;
  }
});
