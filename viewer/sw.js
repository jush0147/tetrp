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
    if(!self.registration.active)await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const previous=(await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE);
    for(const key of previous)await caches.delete(key);
    await self.clients.claim();
    if(replacing||previous.length)for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){
      if(client.url.startsWith(self.registration.scope))client.postMessage({type:'RELOAD_UPDATE',version:VERSION});
    }
  })());
});
let preparing=false;
self.addEventListener('message',event=>{
  if(event.data?.type!=='REQUEST_UPDATE'||preparing)return;
  preparing=true;
  event.waitUntil((async()=>{
    const clients=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>c.url.startsWith(self.registration.scope));
    const ready=await Promise.all(clients.map(client=>new Promise(resolve=>{
      const channel=new MessageChannel();
      const timer=setTimeout(()=>{channel.port1.close();resolve(false);},15000);
      channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data?.ready===true);};
      try{client.postMessage({type:'PREPARE_UPDATE',version:VERSION},[channel.port2]);}
      catch{clearTimeout(timer);channel.port1.close();resolve(false);}
    })));
    if(ready.every(Boolean))await self.skipWaiting();
    else for(const client of clients)client.postMessage({type:'CANCEL_UPDATE'});
  })().finally(()=>{preparing=false;}));
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
