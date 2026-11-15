/* Shell only. Never cache IndexedDB/OPFS data, URLs outside scope, or audio. */
const VERSION = 'v1'; // TEST_UPGRADE_MARKER
const SHELL_CACHE = 'mochop-poc09-shell-' + VERSION;
const ASSETS = ['./index.html', './app.js', './style.css', './lease.js', './db.js', './migration-core.js', './opfs-worker.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
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

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_AFTER_EXCLUSIVE_GATE') {
    // The client owns the exclusive maintenance Web Lock until controllerchange.
    // Only a trusted app client invokes this; never called during install automatically.
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const target = new URL(req.url);
  if (target.origin !== self.location.origin || !target.href.startsWith(base) || req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(req, { cache: 'no-store' });
        if (response.ok && response.type === 'basic' && target.pathname === new URL('./index.html', base).pathname) await cache.put(url('./index.html'), response.clone());
        return response;
      } catch (_) {
        return (await cache.match(url('./index.html'))) || Response.error();
      }
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
