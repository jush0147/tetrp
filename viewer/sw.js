// Build substitutes a content hash and the exact public app asset list.
const VERSION=__VERSION__;
const ASSETS=__ASSETS__;
const PREFIX=`tetrp:${self.registration.scope}:`;
const CACHE=PREFIX+VERSION;
const replacing=Boolean(self.registration.active);
const urls=ASSETS.map(name=>new URL(name,self.registration.scope).href);
const allowed=new Set(urls);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    await (await caches.open(CACHE)).addAll(urls.map(url=>new Request(url,{cache:'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const previous=(await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE);
    for(const key of previous)await caches.delete(key);
    await self.clients.claim();
    // Also upgrades old pages that have no controllerchange/update listener.
    if(replacing||previous.length)for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){
      // Navigation waits for activation to finish: do not await it inside activate.
      if(client.url.startsWith(self.registration.scope))client.navigate(client.url).catch(()=>{});
    }
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
