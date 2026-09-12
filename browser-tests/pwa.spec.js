import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

test('PWA manifest, offline reopening and local worker playback',async({page,context,browserName})=>{
  // Stop a dedicated origin instead of Playwright's WebKit offline emulation,
  // which throws an internal navigation error on both Windows and Linux.
  const server=createServer(async(req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname.replace('/tetrp/','')||'index.html';
    if(!/^(index\.html|app\.(js|css)|worker\.js|sw\.js|manifest\.webmanifest|icon-(180|192|512)\.png)$/.test(name)){res.writeHead(404).end();return;}
    const type=name.endsWith('.js')?'text/javascript':name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'application/manifest+json';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(await readFile(new URL('../dist/'+name,import.meta.url)));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/tetrp/`;
  try{
  await page.goto(base);
  const manifest=await (await page.request.get(new URL('manifest.webmanifest',base).href)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.scope).toBe('./');expect(manifest.start_url).toBe('./');
  for(const icon of manifest.icons){
    const response=await page.request.get(new URL(icon.src,base).href);expect(response.ok()).toBe(true);
    const bytes=await response.body();expect(bytes.readUInt32BE(16)).toBe(Number(icon.sizes.split('x')[0]));
  }
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  if(browserName==='chromium'){
    const cdp=await context.newCDPSession(page);
    const result=await cdp.send('Page.getAppManifest');expect(result.errors).toEqual([]);
    expect(result.manifest.id).toBe(base);
    expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
  }
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  const response=await page.reload();expect(response.fromServiceWorker()).toBe(true);await expect(page.locator('#welcome')).toBeVisible();
  const replay={version:1,gamemode:'40l',replay:{frames:90,options:{version:15,seed:42,handling:{safelock:false}},events:[
    {frame:0,type:'start',data:{}},{frame:1,type:'keydown',data:{key:'hardDrop',subframe:.2}},
    {frame:2,type:'keyup',data:{key:'hardDrop',subframe:.4}},{frame:90,type:'end',data:{reason:'clear'}}]}};
  await page.locator('#file').setInputFiles({name:'private-offline.ttr',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replay))});
  await expect(page.locator('#viewer')).toBeVisible();await page.locator('#next-placement').click();
  await expect(page.locator('#pieces')).toHaveText('1');
  const paths=await page.evaluate(async()=>{
    const result=[];for(const name of await caches.keys())for(const r of await (await caches.open(name)).keys())result.push(new URL(r.url).pathname);
    return result.sort();
  });
  expect(paths).toEqual(['app.css','app.js','icon-180.png','icon-192.png','icon-512.png','index.html','manifest.webmanifest','worker.js'].map(p=>'/tetrp/'+p).sort());
  const reopened=await context.newPage();await page.close();await reopened.goto(base);
  await expect(reopened.locator('#welcome')).toBeVisible();
  }finally{server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}
});

test('installation help stays in menu and native prompt requires a click',async({page})=>{
  await page.goto('./');await page.locator('.file-menu summary').click();await page.locator('#install-app').click();
  await expect(page.locator('#install-help')).toBeVisible();await page.locator('#close-install-help').click();
  await page.evaluate(()=>{
    window.promptCount=0;const e=new Event('beforeinstallprompt',{cancelable:true});
    e.prompt=async()=>window.promptCount++;e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);
  });
  expect(await page.evaluate(()=>window.promptCount)).toBe(0);
  await page.locator('.file-menu summary').click();await page.locator('#install-app').click();
  expect(await page.evaluate(()=>window.promptCount)).toBe(1);
  await expect(page.locator('#install-help')).not.toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
  await page.locator('.file-menu summary').click();await expect(page.locator('#install-app')).toBeHidden();
});
