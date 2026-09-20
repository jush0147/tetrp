import {test,expect} from '@playwright/test';
const replay=(seed=42)=>({version:1,gamemode:'40l',replay:{frames:90,options:{version:15,seed,handling:{safelock:false}},events:[
  {frame:0,type:'start',data:{}},...[1,13,25].flatMap(frame=>[{frame,type:'keydown',data:{key:'hardDrop',subframe:.2}},
  {frame:frame+1,type:'keyup',data:{key:'hardDrop',subframe:.4}}]),{frame:90,type:'end',data:{reason:'clear'}}]}});
async function open(page,data=replay(),name='analysis.ttr'){
  await page.addInitScript(()=>{
    document.addEventListener('tetrp:position',e=>window.position=e.detail);
    document.addEventListener('tetrp:analysis',e=>{window.analysis=e.detail;(window.analyses??=[]).push(e.detail);});
  });
  await page.goto('./');await page.locator('#file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await expect(page.locator('#analyze')).toBeEnabled();
}
async function analyze(page){
  await page.evaluate(()=>window.analysis=null);await page.locator('#analyze').click();
  await expect.poll(()=>page.evaluate(()=>Boolean(window.analysis)),{timeout:45000}).toBe(true);
  return page.evaluate(()=>window.analysis);
}
test('Kiwi real WASM at replay positions: responsive, deterministic, detached and cancellable',async({page},info)=>{
  const workers=[];page.on('worker',w=>workers.push(w.url()));await open(page);
  const before=await page.evaluate(()=>JSON.stringify(window.position));
  await page.evaluate(()=>{window.ticks=0;window.tickInterval=setInterval(()=>window.ticks++,10);});
  const first=await analyze(page);expect(first.nodeBudget).toBe(200000);expect(first.nodes).toBe(200000);
  expect(first.path).toBe('persistent');expect(first.move.cells).toHaveLength(4);
  expect(workers.some(w=>w.endsWith('/kiwi-worker.js'))).toBe(true);
  expect(await page.evaluate(()=>window.ticks)).toBeGreaterThan(3);
  expect(await page.evaluate(()=>JSON.stringify(window.position))).toBe(before);
  await expect(page.locator('#board')).toHaveAttribute('aria-label',/Kiwi/);
  const again=await analyze(page);expect(again.move).toEqual(first.move);expect(again.cached).toBe(true);
  await page.locator('#clear-analysis').click();await expect(page.locator('#analysis-panel')).toBeHidden();
  expect(await page.evaluate(()=>JSON.stringify(window.position))).toBe(before);
  await page.locator('#analyze').click();await page.locator('#next-placement').click();
  await expect(page.locator('#pieces')).toHaveText('1');await expect(page.locator('#analysis-panel')).toBeHidden();
  const second=await analyze(page);expect(second.nodeBudget).toBe(200000);
  await page.locator('#previous').click();await expect(page.locator('#pieces')).toHaveText('0');
  expect((await analyze(page)).move).toEqual(first.move);
  await page.evaluate(()=>clearInterval(window.tickInterval));
  console.log(JSON.stringify({browser:info.project.name,performance:[first,second].map(r=>({searchMs:r.searchMs,totalMs:r.totalMs,nodes:r.nodes}))}));
});
test('Kiwi handles TL pending and switching players invalidates analysis',async({page})=>{
  const data=replay().replay;Object.assign(data.options,{version:19,b2bcharge_base:3,garbageare:5,garbagearebump:12});
  const packet=(type,id)=>({frame:0,type:'ige',data:{id,frame:0,type,data:{type:'garbage',amt:4,gameid:9,frame:0,cid:1,iid:1,ackiid:0}}});
  data.events.splice(1,0,{frame:0,type:'ige',data:{id:1,frame:0,type:'target',data:{targets:[9]}}},packet('interaction',2),packet('interaction_confirm',3));
  const match={version:1,gamemode:'league',replay:{rounds:[[{id:'a',username:'Alpha',replay:data},{id:'b',username:'Beta',replay:{...replay(99).replay,options:{version:19,seed:99,handling:{safelock:false}}}}]]}};
  await open(page,match,'match.ttrm');
  // At placement 1 the already-confirmed incoming remains observable (20-frame travel).
  await page.locator('#next-placement').click();await expect(page.locator('#pieces')).toHaveText('1');
  const r=await analyze(page);expect(r.path).toBe('pending-snapshot');expect(r.nodes).toBe(200000);
  await expect(page.locator('#analysis-details')).toContainText('10 種');
  await expect(page.locator('#analysis-details')).toContainText('surge base=3');
  await page.locator('#player-swap').click();await expect(page.locator('#analysis-panel')).toBeHidden();
  const other=await analyze(page);expect(other.path).toBe('persistent');
});
test('unknown observable garbage arrival fails explicitly without damaging replay',async({page})=>{
  const data=replay().replay;data.options.version=19;
  data.events.splice(1,0,
    {frame:0,type:'ige',data:{id:1,frame:0,type:'target',data:{targets:[9]}}},
    {frame:0,type:'ige',data:{id:2,frame:0,type:'interaction',data:{type:'garbage',amt:4,gameid:9,frame:0,cid:1,iid:1,ackiid:0}}});
  await open(page,{version:1,gamemode:'league',replay:{rounds:[[{id:'a',replay:data}]]}},'pending.ttrm');
  await page.locator('#next-placement').click();await expect(page.locator('#pieces')).toHaveText('1');
  const before=await page.evaluate(()=>JSON.stringify(window.position));await page.locator('#analyze').click();
  await expect(page.locator('#analysis-status')).toContainText('activation frame');
  expect(await page.evaluate(()=>window.analysis)).toBeUndefined();
  expect(await page.evaluate(()=>JSON.stringify(window.position))).toBe(before);
  await page.locator('#clear-analysis').click();await page.locator('#previous').click();
  await expect(page.locator('#pieces')).toHaveText('0');expect((await analyze(page)).path).toBe('persistent');
});
test('Kiwi search assets are local and Hold recommendation is labelled',async({page})=>{
  const requests=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  // This seed produces an empty-Hold recommendation in the frozen 200k profile.
  await open(page,replay(1));const r=await analyze(page);
  expect(r.move.useHold).toBe(true);await expect(page.locator('#analysis-status')).toContainText('HOLD');
  expect(requests.every(r=>new URL(r.url).origin==='http://127.0.0.1:4173'&&r.method==='GET')).toBe(true);
  expect(requests.some(r=>r.url.endsWith('/cold_clear_2_bg.wasm'))).toBe(true);
  await page.setViewportSize({width:667,height:280});
  for(const id of ['board','analyze','play','previous','next-placement']){
    const b=await page.locator('#'+id).boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(667);expect(b.y+b.height).toBeLessThanOrEqual(280);
  }
  const board=await page.locator('#board').boundingBox(),panel=await page.locator('#analysis-panel').boundingBox();
  expect(board.y+board.height).toBeLessThanOrEqual(panel.y);
});
