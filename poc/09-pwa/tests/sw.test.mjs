import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const scope = 'http://localhost:1234/Bien-ban-hop/poc/09-pwa/';

class FakeResponse {
  constructor(body) { this.body = body; this.ok = true; this.type = 'basic'; }
  clone() { return new FakeResponse(this.body); }
}
function fixture() {
  const stores = new Map();
  let online = true, fetchCount = 0, skipWaiting = 0, claim = 0;
  let sourceVersion = 'v1', writerHeld = false, hasLocks = true;
  const fetchFn = async request => {
    fetchCount++;
    if (!online) throw new Error('offline');
    return new FakeResponse(sourceVersion + ':' + (typeof request === 'string' ? request : request.url));
  };
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(urls) { for (const item of urls) entries.set(item, await fetchFn(item)); },
        async match(req) { return entries.get(typeof req === 'string' ? req : req.url) ?? null; },
        async put(req, value) { entries.set(typeof req === 'string' ? req : req.url, value); }
      };
    }
  };
  function worker(code) {
    const handlers = new Map();
    const locks = { async request(_name, opts, callback) {
      return callback(writerHeld && opts.mode === 'exclusive' ? null : { name: _name });
    } };
    const self = {
      registration: { scope }, location: { origin: 'http://localhost:1234' },
      get navigator() { return hasLocks ? {locks} : {}; },
      clients: { async claim() { claim++; } },
      async skipWaiting() { skipWaiting++; },
      addEventListener(name, callback) { handlers.set(name, callback); }
    };
    vm.runInNewContext(code, { self, caches, fetch: fetchFn, URL, Response: { error() { return { error: true }; } } });
    async function dispatch(name, payload, from = scope + 'index.html') {
      let task, response, answer;
      const event = {
        ...(name === 'fetch' ? { request: payload } : { data: payload, source: {url:from}, ports: [{postMessage(msg) {answer=msg;}}] }),
        waitUntil(p) { task = p; }, respondWith(p) { response = p; }
      };
      handlers.get(name)(event);
      if (task) await task;
      return response ? await response : answer;
    }
    return { dispatch };
  }
  return { worker, stores, setOnline(state) { online = state; }, setVersion(v) {sourceVersion=v;},
    setWriterHeld(v) {writerHeld=v;}, setLocks(v) {hasLocks=v;},
    stats() { return { fetchCount, skipWaiting, claim }; } };
}

test('TC33: offline shell is scoped; OPFS and IndexedDB never enter CacheStorage', async () => {
  const f = fixture(), sw = f.worker(source);
  await sw.dispatch('install');
  assert.equal(f.stats().skipWaiting, 0);
  assert.equal(f.stores.size, 1);
  const urls = [...f.stores.get('mochop-poc09-shell-v1').keys()];
  assert.ok(urls.some(u => u.endsWith('/recording-session.js')));
  assert.ok(urls.some(u => u.endsWith('/autosave-session.js')));
  assert.ok(urls.every(u => u.startsWith(scope)));
  assert.ok(urls.every(u => !u.endsWith('.bin')));
  f.setOnline(false);
  const offline = await sw.dispatch('fetch', {url:scope, method:'GET', mode:'navigate'});
  assert.equal(offline.body, 'v1:' + scope+'index.html');
  const cached = await sw.dispatch('fetch', {url:scope+'app.js', method:'GET', mode:'cors'});
  assert.equal(cached.body, 'v1:' + scope+'app.js');
  const outside = await sw.dispatch('fetch', {url:'http://localhost:1234/unrelated/data', method:'GET', mode:'cors'});
  assert.equal(outside, undefined);
});

test('G09-ADD-04: direct SW activate message during another meeting writer is denied', async () => {
  const f=fixture(), old=f.worker(source);
  await old.dispatch('install'); await old.dispatch('activate');
  f.setVersion('v2');
  const next=f.worker(source.replace("const VERSION = 'v1';", "const VERSION = 'v2';"));
  await next.dispatch('install');
  f.setWriterHeld(true);
  // Historical unguarded command is now fully ignored.
  await next.dispatch('message',{type:'ACTIVATE_AFTER_EXCLUSIVE_GATE'});
  assert.equal(f.stats().skipWaiting,0);
  const denied = await next.dispatch('message',{type:'REQUEST_SAFE_ACTIVATION'});
  assert.equal(denied.accepted,false);
  assert.match(denied.reason,/Another meeting/);
  assert.equal(f.stats().skipWaiting,0);
  f.setWriterHeld(false);
  const accepted=await next.dispatch('message',{type:'REQUEST_SAFE_ACTIVATION'});
  assert.equal(accepted.accepted,true);
  assert.equal(f.stats().skipWaiting,1);
  await next.dispatch('activate');
  assert.equal(f.stats().claim,2);
  assert.ok(f.stores.has('mochop-poc09-shell-v1'));
  assert.ok(f.stores.has('mochop-poc09-shell-v2'));
});

test('G09-ADD-04: outside-scope sender and absent Worker Web Locks cannot activate SW', async () => {
  const f=fixture(), sw=f.worker(source);
  await sw.dispatch('install');
  const outside=await sw.dispatch('message',{type:'REQUEST_SAFE_ACTIVATION'},'http://localhost:1234/unrelated/index.html');
  assert.equal(outside.accepted,false);
  assert.match(outside.reason,/outside/);
  const malformed=await sw.dispatch('message',{type:'REQUEST_SAFE_ACTIVATION'},'garbage://not-a-client');
  assert.equal(malformed.accepted,false);
  f.setLocks(false);
  const noLock=await sw.dispatch('message',{type:'REQUEST_SAFE_ACTIVATION'});
  assert.equal(noLock.accepted,false);
  assert.match(noLock.reason,/unavailable/);
  assert.equal(f.stats().skipWaiting,0);
});

test('G09-ADD-04: HTML/JS/CSS remain same shell version even after online v2 is published', async () => {
  const f=fixture(), old=f.worker(source);
  await old.dispatch('install');
  f.setVersion('v2');
  const next=f.worker(source.replace("const VERSION = 'v1';", "const VERSION = 'v2';"));
  await next.dispatch('install'); // new cache prepared, but old worker still controls tabs
  const oldNavigate=await old.dispatch('fetch',{url:scope,method:'GET',mode:'navigate'});
  const oldScript=await old.dispatch('fetch',{url:scope+'app.js',method:'GET',mode:'cors'});
  assert.equal(oldNavigate.body, 'v1:' + scope+'index.html');
  assert.equal(oldScript.body, 'v1:' + scope+'app.js');
  const newNavigate=await next.dispatch('fetch',{url:scope,method:'GET',mode:'navigate'});
  const newScript=await next.dispatch('fetch',{url:scope+'app.js',method:'GET',mode:'cors'});
  assert.equal(newNavigate.body, 'v2:' + scope+'index.html');
  assert.equal(newScript.body, 'v2:' + scope+'app.js');
});
