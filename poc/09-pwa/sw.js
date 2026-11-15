/* Shell only. Never cache IndexedDB/OPFS data, URLs outside scope, or audio. */
const VERSION = 'v1'; // TEST_UPGRADE_MARKER
const SHELL_CACHE = 'mochop-poc09-shell-' + VERSION;
const ASSETS = ['./index.html', './app.js', './style.css', './lease.js', './db.js', './migration-core.js', './recording-session.js', './autosave-session.js', './maintenance-retry.js', './opfs-worker.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
const base = self.registration.scope;
const url = relative => new URL(relative, base).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(ASSETS.map(url));
    // Deliberately do not call skipWaiting(); active writers keep the old code.
  })());
});

self.addEventListener('activate', event => {
  // Keep older version caches while old app tabs may still be open. Controlled cleanup belongs in release logic.
  event.waitUntil(self.clients.claim());
});

// A client message is NOT evidence that the maintenance lock is held.
// Only the waiting SW may acquire the origin-wide exclusive gate and activate.
const MAINTENANCE_LOCK = 'mochop:poc09:maintenance';
self.addEventListener('message', event => {
  if (event.data?.type !== 'REQUEST_SAFE_ACTIVATION') return;
  event.waitUntil((async () => {
    const reply = event.ports?.[0];
    const source = event.source?.url;
    let validSource = false;
    try {
      validSource = typeof source === 'string' && new URL(source).origin === self.location.origin && source.startsWith(base);
    } catch (_) { /* malformed source can never authorize activation */ }
    let accepted = false;
    let reason = 'Requesting client outside this PWA scope';
    try {
      if (validSource) {
        if (!self.navigator?.locks) {
          reason = 'SW Web Locks unavailable: activation refused';
        } else {
          await self.navigator.locks.request(MAINTENANCE_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
            if (!lock) { reason = 'Another meeting holds a writer/recording lock'; return; }
            await self.skipWaiting();
            accepted = true;
          });
        }
      }
    } catch (error) { reason = 'SW maintenance gate failed: ' + String(error?.message || error); }
    reply?.postMessage({ accepted, reason: accepted ? undefined : reason });
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const target = new URL(req.url);
  if (target.origin !== self.location.origin || !target.href.startsWith(base) || req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    // Cache-first HTML MUST match the JS/CSS cached by this same active worker.
    // Network-first HTML would mix v2 markup with v1 scripts while v2 is WAITING.
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      return (await cache.match(url('./index.html'))) || fetch(req).catch(() => Response.error());
    })());
    return;
  }
  const shellUrl = ASSETS.map(url);
  if (!shellUrl.includes(target.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(req)) || fetch(req);
  })());
});
