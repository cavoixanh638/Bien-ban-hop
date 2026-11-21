// G10 offline shell. No audio, personal note, OPFS or IndexedDB contents in CacheStorage.
const VERSION='bien-ban-hop-20261121-g00-audio-options';
const CACHE='bien-ban-hop-shell-'+VERSION, SCOPE=self.registration.scope;
const url=relative=>new URL(relative,SCOPE).href;
// Keep the old lock key: older and newer PWA clients must share the same safety lock.
const MAINTENANCE_LOCK='mochop:poc09:maintenance';
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const page=await fetch(url('./'),{cache:'reload'});
    if(!page.ok)throw Error('Không tải được application shell');
    const html=await page.clone().text();
    await cache.put(url('./'),page);
    // Vite hashed script/css in same HTML; cache the exact pair for this shell version.
    const assets=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(x=>new URL(x[1],url('./')).href)
      .filter(x=>x.startsWith(SCOPE)&&/\.(?:js|css)(?:\?|$)/.test(x));
    await Promise.all(assets.map(async a=>{const r=await fetch(a,{cache:'reload'});if(r.ok)await cache.put(a,r);}));
    // Never skipWaiting on install, especially during a recording.
  })());
});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
  if(event.data?.type!=='REQUEST_SAFE_ACTIVATION')return;
  event.waitUntil((async()=>{
    let accepted=false,reason='Nguồn cập nhật không hợp lệ';
    const source=event.source?.url,reply=event.ports?.[0];
    if(typeof source==='string'&&source.startsWith(SCOPE)&&new URL(source).origin===self.location.origin){
      if(!self.navigator?.locks)reason='Không có Web Locks trong Service Worker';
      else try{await self.navigator.locks.request(MAINTENANCE_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
        if(!lock){reason='Một tab đang giữ quyền ghi';return;}
        await self.skipWaiting();accepted=true;
      });}catch(e){reason='Lỗi khóa bảo trì: '+e.message;}
    }
    reply?.postMessage({accepted,reason:accepted?'':reason});
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request,target=new URL(req.url);
  if(req.method!=='GET'||target.origin!==self.location.origin||!target.href.startsWith(SCOPE))return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      return await cache.match(url('./'))||await fetch(req).catch(()=>Response.error());
    })());return;
  }
  // Cache-first for same-version assets; never cache REST/data/audio or cross-origin responses.
  if(!/\.(?:js|css|svg|webmanifest|wasm)(?:\?|$)/.test(target.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const hit=await cache.match(req);if(hit)return hit;
    const r=await fetch(req);
    if(r.ok&&r.type==='basic'&&!target.pathname.includes('/audio/'))await cache.put(req,r.clone());
    return r;
  })());
});
