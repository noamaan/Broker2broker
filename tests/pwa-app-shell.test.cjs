const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { act } = React;
const { JSDOM } = require('jsdom');
function load(path, modules, extra={}) {
  const source=fs.readFileSync(path,'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const exports={}; vm.runInNewContext(code,{exports,require:n=>modules[n]??require(n),process,Buffer,console,URL,Date,setTimeout,...extra},{filename:path}); return exports;
}
test('manifest keeps the installed app identity, starts at member workspace and supplies a maskable icon', () => {
  const manifest=load('app/manifest.ts',{}).default();
  assert.equal(manifest.id,'/'); assert.equal(manifest.scope,'/'); assert.equal(manifest.start_url,'/dashboard'); assert.equal(manifest.display,'standalone');
  const icon=manifest.icons.find(x=>x.purpose==='maskable'); assert.equal(icon.sizes,'512x512');
  const bytes=fs.readFileSync(`public${icon.src}`); assert.equal(bytes.readUInt32BE(16),512); assert.equal(bytes.readUInt32BE(20),512);
});

test('app workspace provides accessible navigation, menu, account functions and closes on Escape', async () => {
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.test/dashboard'});
  const previous={window:global.window,document:global.document,navigator:global.navigator,act:global.IS_REACT_ACT_ENVIRONMENT};
  global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.IS_REACT_ACT_ENVIRONMENT=true;
  const {createRoot}=require('react-dom/client');
  dom.window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  const link=({href,children,...props})=>React.createElement('a',{href,...props},children);
  const modules={react:React,'react/jsx-runtime':require('react/jsx-runtime'),'next/link':{__esModule:true,default:link},'next/navigation':{usePathname:()=>'/dashboard',useRouter:()=>({push(){},refresh(){}})},'@/lib/client/api':{apiFetch:async()=>({})}};
  const {DashboardShell}=load('components/dashboard-shell.tsx',modules,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement});
  const root=createRoot(document.getElementById('root'));
  const user={fullName:'Example Broker',role:'ADMIN',city:'Mumbai',agencyName:'Test Agency',membershipStatus:'ACTIVE'};
  try {
    await act(async()=>root.render(React.createElement(DashboardShell,{user},React.createElement('p',null,'Workspace content'))));
    const nav=document.querySelector('[aria-label="App navigation"]');assert.ok(nav);
    assert.deepEqual(Array.from(nav.querySelectorAll('a')).map(a=>a.getAttribute('href')),['/dashboard','/dashboard/explore','/dashboard/new-listing','/dashboard/my-listings']);
    assert.equal(nav.querySelector('a[aria-current="page"]').textContent,'Home');
    const more=nav.querySelector('button');assert.equal(more.getAttribute('aria-expanded'),'false');
    more.focus();
    await act(async()=>more.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
    assert.equal(more.getAttribute('aria-expanded'),'true');const menu=document.querySelector('[aria-label="Dashboard menu"]');assert.ok(menu);assert.equal(document.querySelector('[role=dialog]').getAttribute('aria-modal'),'true');assert.equal(document.body.style.overflow,'hidden');assert.equal(document.activeElement.getAttribute('aria-label'),'Close menu');
    for(const path of ['/dashboard/saved','/dashboard/enquiries','/dashboard/membership','/dashboard/profile','/dashboard/settings','/admin','/'])assert.ok(menu.querySelector(`a[href="${path}"]`),path);
    await act(async()=>window.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(more.getAttribute('aria-expanded'),'false');assert.equal(document.querySelector('[aria-label="Dashboard menu"]'),null);assert.equal(document.body.style.overflow,'');assert.equal(document.activeElement,more);
    assert.ok(document.querySelector('[aria-label="Quick navigation"]'), 'browser navigation remains available');
  } finally {await act(async()=>root.unmount());dom.window.close();global.window=previous.window;global.document=previous.document;global.navigator=previous.navigator;global.IS_REACT_ACT_ENVIRONMENT=previous.act;}
});

test('offline status appears and clears on reconnection without caching data', async () => {
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.test/'});
  const old={window:global.window,document:global.document,navigator:global.navigator,act:global.IS_REACT_ACT_ENVIRONMENT};
  global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.IS_REACT_ACT_ENVIRONMENT=true;
  let online=true;Object.defineProperty(dom.window.navigator,'onLine',{configurable:true,get:()=>online});
  const {createRoot}=require('react-dom/client');const modules={react:React,'react/jsx-runtime':require('react/jsx-runtime')};
  const {Pwa}=load('components/pwa.tsx',modules,{window:dom.window,navigator:dom.window.navigator,location:dom.window.location});const root=createRoot(document.getElementById('root'));
  try {await act(async()=>root.render(React.createElement(Pwa)));assert.equal(document.querySelector('[role=status]'),null);
    online=false;await act(async()=>window.dispatchEvent(new dom.window.Event('offline')));assert.match(document.querySelector('[role=status]').textContent,/offline/i);
    online=true;await act(async()=>window.dispatchEvent(new dom.window.Event('online')));assert.equal(document.querySelector('[role=status]'),null);
  } finally {await act(async()=>root.unmount());dom.window.close();global.window=old.window;global.document=old.document;global.navigator=old.navigator;global.IS_REACT_ACT_ENVIRONMENT=old.act;}
});
