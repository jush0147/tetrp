// Build substitutes a content hash and the exact public app asset list.
const VERSION=__VERSION__;
const ASSETS=__ASSETS__;
const PREFIX=`tetrp:${self.registration.scope}:`;
const CACHE=PREFIX+VERSION;
const urls=ASSETS.map(name=>new URL(name,self.registration.scope).href);
const allowed=new Set(urls);
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls)));
  // Wait for existing windows to close; never interrupt a loaded replay for an update.
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  const home=new URL('./',self.registration.scope);
  const key=request.mode==='navigate'&&url.origin===home.origin&&url.pathname===home.pathname
    ?new URL('index.html',home).href:request.url;
  if(!allowed.has(key))return;
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(key))||fetch(request)));
});
