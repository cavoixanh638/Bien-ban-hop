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
  let online = true;
  let fetchCount = 0;
  let skipWaiting = 0;
  let claim = 0;
  const fetchFn = async request => {
    fetchCount++;
    if (!online) throw new Error('offline');
    return new FakeResponse('network:' + (typeof request === 'string' ? request : request.url));
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
    const self = {
      registration: { scope }, location: { origin: 'http://localhost:1234' },
      clients: { async claim() { claim++; } },
      async skipWaiting() { skipWaiting++; },
      addEventListener(name, callback) { handlers.set(name, callback); }
    };
    vm.runInNewContext(code, { self, caches, fetch: fetchFn, URL, Response: { error() { return { error: true }; } } });
    async function dispatch(name, requestOrData) {
      let task;
      let response;
      const event = {
        ...(name === 'fetch' ? { request: requestOrData } : { data: requestOrData }),
        waitUntil(p) { task = p; }, respondWith(p) { response = p; }
      };
      handlers.get(name)(event);
      if (task) await task;
      return response ? await response : undefined;
    }
    return { dispatch };
  }
  return { worker, stores, setOnline(state) { online = state; }, stats() { return { fetchCount, skipWaiting, claim }; } };
}

test('TC33: shell precache supports offline navigation under repo base path without caching data', async () => {
  const f = fixture();
  const sw = f.worker(source);
  await sw.dispatch('install');
  assert.equal(f.stats().skipWaiting, 0);
  assert.equal(f.stores.size, 1);
  const urls = [...f.stores.get('mochop-poc09-shell-v1').keys()];
  assert.ok(urls.some(u => u.endsWith('/app.js')));
  assert.ok(urls.some(u => u.endsWith('/migration-core.js')));
  assert.ok(urls.every(u => u.startsWith(scope)));
  assert.ok(urls.every(u => !u.endsWith('.bin')));
  f.setOnline(false);
  const offline = await sw.dispatch('fetch', { url: scope, method: 'GET', mode: 'navigate' });
  assert.equal(offline.body, 'network:' + scope + 'index.html');
  const cached = await sw.dispatch('fetch', { url: scope + 'app.js', method: 'GET', mode: 'cors' });
  assert.equal(cached.body, 'network:' + scope + 'app.js');
  const outside = await sw.dispatch('fetch', { url: 'http://localhost:1234/unrelated/data', method: 'GET', mode: 'cors' });
  assert.equal(outside, undefined);
});

test('TC34: new version does not skipWaiting until explicit message; older caches preserved', async () => {
  const f = fixture();
  const old = f.worker(source);
  await old.dispatch('install');
  await old.dispatch('activate');
  const nextSource = source.replace("const VERSION = 'v1';", "const VERSION = 'v2';");
  const next = f.worker(nextSource);
  await next.dispatch('install');
  assert.equal(f.stats().skipWaiting, 0);
  assert.ok(f.stores.has('mochop-poc09-shell-v1'));
  assert.ok(f.stores.has('mochop-poc09-shell-v2'));
  await next.dispatch('message', { type: 'UNTRUSTED_BROADCAST' });
  assert.equal(f.stats().skipWaiting, 0);
  await next.dispatch('message', { type: 'ACTIVATE_AFTER_EXCLUSIVE_GATE' });
  assert.equal(f.stats().skipWaiting, 1);
  await next.dispatch('activate');
  assert.equal(f.stats().claim, 2);
  assert.ok(f.stores.has('mochop-poc09-shell-v1'));
});
