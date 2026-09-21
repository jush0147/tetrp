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
  await expect.poll(()=>page.evaluate(()=>Boolean(window.analysis)),{timeout:120000}).toBe(true);
  return page.evaluate(()=>window.analysis);
}
test.setTimeout(180000);
test('Kiwi demo reveals beyond initial preview, navigates history and exits to exact recorded position',async({page})=>{
  await page.addInitScript(()=>document.addEventListener('tetrp:demo',e=>window.demo=e.detail));
  await open(page);
  const before=await page.evaluate(()=>JSON.stringify(window.position));
  await page.evaluate(()=>{window.ticks=0;window.timer=setInterval(()=>window.ticks++,10);});
  for(let i=1;i<=8;i++){
    const result=await analyze(page);expect(result.action.kind).toBe('place');expect(result.nodeBudget).toBe(200000);
    expect(result.nodes).toBeLessThanOrEqual(200000);
    expect(await page.evaluate(()=>window.demo.index)).toBe(i);
    expect(await page.evaluate(()=>window.demo.state.next.length)).toBe(5);
  }
  const last=await page.evaluate(()=>window.demo.state);
  await page.locator('#previous').click();await expect(page.locator('#playback-position')).toContainText('Kiwi 7 / 8');
  await page.locator('#next-placement').click();await expect(page.locator('#playback-position')).toContainText('Kiwi 8 / 8');
  expect(await page.evaluate(()=>window.demo.state)).toEqual(last);
  expect(await page.evaluate(()=>window.ticks)).toBeGreaterThan(10);
  await expect(page.locator('#play')).toBeDisabled();await expect(page.locator('#scrubber')).toBeDisabled();
  expect(await page.evaluate(()=>JSON.stringify(window.position))).toBe(before);
  await page.locator('#clear-analysis').click();await expect(page.locator('#analysis-panel')).toBeHidden();
  expect(await page.evaluate(()=>JSON.stringify(window.position))).toBe(before);
  await expect(page.locator('#pieces')).toHaveText('0');await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#next-placement').click();await expect(page.locator('#pieces')).toHaveText('1');
  await page.evaluate(()=>clearInterval(window.timer));
});

test('unknown observable garbage is retained during demo and player switch discards branch',async({page})=>{
  await page.addInitScript(()=>document.addEventListener('tetrp:demo',e=>window.demo=e.detail));
  const data=replay().replay;data.options.version=19;
  data.events.splice(1,0,
    {frame:0,type:'ige',data:{id:1,frame:0,type:'target',data:{targets:[9]}}},
    {frame:0,type:'ige',data:{id:2,frame:0,type:'interaction',data:{type:'garbage',amt:4,gameid:9,frame:0,cid:1,iid:1,ackiid:0}}});
  await open(page,{version:1,gamemode:'league',replay:{rounds:[[{id:'a',replay:data},{id:'b',replay:{...data,events:replay().replay.events}}]]}},'pending.ttrm');
  await page.locator('#next-placement').click();await expect(page.locator('#pieces')).toHaveText('1');
  const before=await page.evaluate(()=>JSON.stringify(window.position));const result=await analyze(page);
  expect(result.unknownActivationPackets).toBe(1);
  await expect(page.locator('#analysis-details')).toContainText('到達時間未知');
  expect(await page.evaluate(()=>JSON.stringify(window.position))).toBe(before);
  await page.locator('#player-swap').click();await expect(page.locator('#analysis-panel')).toBeHidden();
  await expect(page.locator('#analyze')).toHaveAttribute('aria-busy','false');
});

test('exit while thinking or showing target cancels commit, then a new session works',async({page})=>{
  await open(page);const before=await page.evaluate(()=>JSON.stringify(window.position));
  await page.locator('#analyze').click();await page.locator('#clear-analysis').click();
  await expect(page.locator('#analysis-panel')).toBeHidden();
  const r=await analyze(page);expect(r.action.kind).toBe('place');
  await page.locator('#clear-analysis').click();
  expect(await page.evaluate(()=>JSON.stringify(window.position))).toBe(before);
  await expect(page.locator('#pieces')).toHaveText('0');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  expect(errors).toEqual([]);
});

test('empty Hold executes and reanalyzes before placement; all assets stay local',async({page})=>{
  const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(()=>{window.demoViews=[];document.addEventListener('tetrp:demo',e=>window.demoViews.push(e.detail));});
  await open(page,replay(1));const r=await analyze(page);expect(r.action.kind).toBe('place');
  const views=await page.evaluate(()=>window.demoViews);
  expect(views.some(v=>v.index===0&&v.state.hold.locked)).toBe(true);
  expect(views.at(-1).index).toBe(1);
  expect(requests.every(u=>new URL(u).origin===new URL(page.url()).origin)).toBe(true);
  await page.setViewportSize({width:667,height:280});
  for(const id of ['board','analyze','previous','next-placement']){
    const b=await page.locator('#'+id).boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(667);expect(b.y+b.height).toBeLessThanOrEqual(280);
  }
});
