import {test,expect} from '@playwright/test';
const replay=seed=>({version:1,gamemode:'40l',replay:{frames:180,options:{version:15,seed,handling:{safelock:false}},events:[{frame:0,type:'start',data:{}},...[10,30,50].flatMap(frame=>[{frame,type:'keydown',data:{key:'hardDrop',subframe:.2}},{frame:frame+1,type:'keyup',data:{key:'hardDrop',subframe:.2}}]),{frame:180,type:'end',data:{reason:'clear'}}]}});
const match=()=>({version:1,gamemode:'league',replay:{rounds:[0,1].map(()=>['Alpha','Beta'].map((name,i)=>({id:name,username:name,replay:{...replay(40+i).replay,options:{version:19,seed:40+i,handling:{safelock:false}}}})))}});
async function open(page,data,name='sample.ttr'){await page.locator('#file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await expect(page.locator('#play')).toBeEnabled();}
async function position(page,n){await page.locator('#scrubber').evaluate((el,n)=>{el.value=String(n);el.dispatchEvent(new Event('input'));el.dispatchEvent(new Event('change'));},n);await expect(page.locator('#pieces')).toHaveText(String(n));}
async function cached(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('tetrp-current-replay');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('current');const out={};for(const key of ['current','view'])tx.objectStore('current').get(key).onsuccess=e=>out[key]=e.target.result;tx.oncomplete=()=>{db.close();resolve(out);};};}));}
async function saved(page,n){await expect.poll(async()=>(await cached(page)).view?.view?.placement).toBe(n);}
test('single current replay restores round player placement and preferences paused',async({page})=>{
  await page.addInitScript(()=>document.addEventListener('tetrp:position',event=>window.restoredState=event.detail.state));
  await page.goto('./');await expect(page.locator('html')).toHaveAttribute('data-recovery','ready');await open(page,match(),'match.ttrm');await page.locator('#round').selectOption('1');await expect(page.locator('#play')).toBeEnabled();await page.locator('#player-swap').click();await expect(page.locator('#player-swap')).toHaveAttribute('aria-pressed','true');
  await position(page,2);await page.locator('#speed').click();await page.locator('#play-mode').click();await saved(page,2);const expected=await page.evaluate(()=>window.restoredState);
  await page.reload();await expect(page.locator('#pieces')).toHaveText('2');await expect(page.locator('#round')).toHaveValue('1');await expect(page.locator('#player')).toHaveValue('1');await expect(page.locator('#speed')).toHaveAttribute('data-mode','2');await expect(page.locator('#play-mode')).toHaveAttribute('data-mode','1');await expect(page.locator('#play')).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>window.restoredState)).toEqual(expected);
  await open(page,replay(99),'replacement.ttr');await saved(page,0);expect((await cached(page)).current.name).toBe('replacement.ttr');
  await page.reload();await expect(page.locator('#pieces')).toHaveText('0');await expect(page.locator('#boards')).not.toHaveClass(/dual/);
});
test('corrupt raw replay is cleared once and missing browser storage falls back',async({page})=>{
  await page.goto('./');await expect(page.locator('html')).toHaveAttribute('data-recovery','ready');await open(page,replay(42));await saved(page,0);
  await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('tetrp-current-replay');r.onsuccess=()=>{const db=r.result,tx=db.transaction('current','readwrite'),s=tx.objectStore('current');s.get('current').onsuccess=e=>s.put({...e.target.result,raw:new TextEncoder().encode('{broken').buffer},'current');tx.oncomplete=()=>{db.close();resolve();};};}));
  await page.reload();await expect.poll(async()=>(await cached(page)).current).toBeUndefined();await expect(page.locator('#open-empty')).toBeVisible();await page.reload();await expect(page.locator('#open-empty')).toBeVisible();
  await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.deleteDatabase('tetrp-current-replay');r.onsuccess=resolve;}));await page.reload();await expect(page.locator('#open-empty')).toBeVisible();
});
test('v1 inline recovery migrates atomically to v2 without losing raw replay',async({page})=>{
  await page.goto('./');await expect(page.locator('html')).toHaveAttribute('data-recovery','ready');await page.evaluate(async data=>{
    await new Promise(resolve=>{const r=indexedDB.deleteDatabase('tetrp-current-replay');r.onsuccess=resolve;});
    await new Promise(resolve=>{const r=indexedDB.open('tetrp-current-replay',1);r.onupgradeneeded=()=>r.result.createObjectStore('current');r.onsuccess=()=>{const db=r.result,tx=db.transaction('current','readwrite');tx.objectStore('current').put({format:1,id:'old',name:'old.ttr',raw:new TextEncoder().encode(JSON.stringify(data)).buffer,view:{round:0,player:0,placement:2}},'current');tx.oncomplete=()=>{db.close();resolve();};};});
  },replay(42));await page.reload();await expect(page.locator('#pieces')).toHaveText('2');expect((await cached(page)).current.id).toBe('old');await expect(page.locator('#play')).toHaveAttribute('aria-pressed','false');
});

test('update waits for a pending atomic replacement, restores position and never loops',async({page})=>{
  const {createServer}=await import('node:http');const {readFile}=await import('node:fs/promises');let version=1;
  const server=createServer(async(req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname.replace('/tetrp/','')||'index.html';
    if(!/^(index\.html|app\.(js|css)|worker\.js|sw\.js|manifest\.webmanifest|icon-(180|192|512)\.png)$/.test(name)){res.writeHead(404).end();return;}
    let data=await readFile(new URL('../dist/'+name,import.meta.url));if(name==='sw.js')data=data.toString().replace(/const VERSION=.*?;/,`const VERSION="test-${version}";`);
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':name.endsWith('.webmanifest')?'application/manifest+json':'text/html');res.end(data);
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/tetrp/`;
  try{
    await page.goto(base);await open(page,match(),'match.ttrm');await page.locator('#round').selectOption('1');await expect(page.locator('#viewer')).toBeVisible();await page.locator('#player-swap').click();await position(page,2);await saved(page,2);
    await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    const before=await page.evaluate(()=>performance.timeOrigin);version=2;
    await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
    await expect.poll(()=>page.evaluate(()=>performance.timeOrigin).catch(()=>before)).not.toBe(before);
    await expect(page.locator('#pieces')).toHaveText('2');await expect(page.locator('#round')).toHaveValue('1');await expect(page.locator('#player')).toHaveValue('1');await expect(page.locator('#play')).toHaveAttribute('aria-pressed','false');
    const stable=await page.evaluate(()=>performance.timeOrigin);await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});await page.waitForTimeout(500);expect(await page.evaluate(()=>performance.timeOrigin)).toBe(stable);
    await page.evaluate(()=>{
      window.holdReplayWrite=true;const put=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,key){const request=put.call(this,value,key);if(this.name==='current'&&key==='current'&&window.holdReplayWrite){const store=this;function pump(){store.get('current').onsuccess=()=>{if(window.holdReplayWrite)pump();};}pump();}return request;};
    });
    await page.locator('#file').setInputFiles({name:'new.ttr',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replay(99)))});
    version=3;await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
    await expect.poll(()=>page.evaluate(()=>document.body.inert)).toBe(true);expect(await page.evaluate(()=>performance.timeOrigin)).toBe(stable);
    await page.evaluate(()=>window.holdReplayWrite=false);
    await expect.poll(()=>page.evaluate(()=>performance.timeOrigin).catch(()=>stable)).not.toBe(stable);await expect(page.locator('#pieces')).toHaveText('0');expect((await cached(page)).current.name).toBe('new.ttr');await expect(page.locator('#play')).toHaveAttribute('aria-pressed','false');
    const committed=await page.evaluate(()=>performance.timeOrigin);
    await page.evaluate(()=>{window.blockReplayStorage=true;const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(...args){if(window.blockReplayStorage)throw new DOMException('Storage unavailable','QuotaExceededError');return open.apply(this,args);};});
    version=4;await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
    await expect(page.locator('#offline-note')).toContainText('postponed');await expect.poll(()=>page.evaluate(()=>document.body.inert)).toBe(false);expect(await page.evaluate(()=>performance.timeOrigin)).toBe(committed);
    await page.evaluate(()=>window.blockReplayStorage=false);await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();r.waiting.postMessage({type:'REQUEST_UPDATE'});});
    await expect.poll(()=>page.evaluate(()=>performance.timeOrigin).catch(()=>committed)).not.toBe(committed);await expect(page.locator('#pieces')).toHaveText('0');
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});


test('aborted replacement retains the previous complete raw replay and recovery state',async({page})=>{
  await page.goto('./');await open(page,replay(42));await position(page,2);await saved(page,2);
  const previous=(await cached(page)).current.id;
  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){const r=put.call(this,value,key);if(this.name==='current'&&key==='current')this.transaction.abort();return r;};});
  await open(page,replay(99),'aborted.ttr');await expect(page.locator('#pieces')).toHaveText('0');
  const result=await cached(page);expect(result.current.id).toBe(previous);expect(result.view.view.placement).toBe(2);
  await page.reload();await expect(page.locator('#pieces')).toHaveText('2');expect((await cached(page)).current.name).toBe('sample.ttr');
});


test('a stale tab cannot overwrite the new current replay or attach its old position',async({page,context})=>{
  await page.goto('./');await open(page,replay(42));await position(page,2);await saved(page,2);
  const other=await context.newPage();await other.goto('./');await expect(other.locator('#pieces')).toHaveText('2');
  await open(other,replay(99),'latest.ttr');await saved(other,0);const current=(await cached(other)).current.id;
  await page.locator('#previous').click();await expect(page.locator('#pieces')).toHaveText('1');await expect(page.locator('#offline-note')).toContainText('postponed');
  const result=await cached(other);expect(result.current.id).toBe(current);expect(result.view.view.placement).toBe(0);expect(result.current.name).toBe('latest.ttr');
});
