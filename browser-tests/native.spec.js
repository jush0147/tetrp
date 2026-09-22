import {test,expect} from '@playwright/test';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {writeFile} from 'node:fs/promises';

test('native Worker analyzes public states off the UI thread and caches ranked candidates',async({page},info)=>{
  await page.goto('./?kiwi=native');
  const snapshots=[1,42,123,456,789,987].map((seed,i)=>{
    const e=new Engine({seed});
    for(let y=40-(i===5?14:i?4:0);y<40;y++)e.state.board.rows[y]=Array.from({length:10},(_,x)=>x===4?null:'gb');
    if(i===2||i===3){const cid=e.receive({from:'P2',iid:1,amt:4});if(i===2){e.confirm(cid);e.state.attack.pending[0].active=true;}}
    if(i===4)e.hold();
    return visibleState(e.state);
  });
  const result=await page.evaluate(async snapshots=>{
    const worker=new Worker(new URL('kiwi-worker.js',location.href),{type:'module'});
    let ticks=0,id=0;const timer=setInterval(()=>ticks++,10);
    const request=state=>new Promise((resolve,reject)=>{
      worker.onmessage=({data})=>data.error?reject(new Error(data.error)):resolve(data.result);
      worker.onerror=reject;worker.postMessage({id:++id,state,core:'native'});
    });
    try{
      const reports=[];for(const state of snapshots)reports.push(await request(state));
      const cached=await request(snapshots.at(-1));return {reports,cached,ticks};
    }finally{clearInterval(timer);worker.terminate();}
  },snapshots);
  expect(result.ticks).toBeGreaterThan(10);expect(result.cached.cached).toBe(true);
  for(const r of result.reports){expect(r.path).toBe('native');expect(r.nodes).toBeLessThanOrEqual(r.nodeBudget);}
  const warm=result.reports.slice(1).map(r=>r.totalMs).sort((a,b)=>a-b);
  const output=info.outputPath('native-worker-performance.json');
  await writeFile(output,JSON.stringify({coldMs:result.reports[0].totalMs,
    warmP95Ms:warm[Math.ceil(warm.length*.95)-1],samples:result.reports.map(r=>({ms:r.totalMs,depth:r.completedDepth,completion:r.completion})),
    note:'Six synthetic empty/stack/garbage/Hold/danger states, not corpus certification.'},null,2));
  await info.attach('native-worker-performance.json',{path:output,contentType:'application/json'});
});

test('native candidate uses existing TL branch, reveals pieces and restores recorded position',async({page})=>{
  await page.addInitScript(()=>{
    document.addEventListener('tetrp:position',e=>window.position=e.detail);
    document.addEventListener('tetrp:analysis',e=>window.analysis=e.detail);
    document.addEventListener('tetrp:demo',e=>window.demo=e.detail);
  });
  await page.goto('./?kiwi=native');
  const replay={frames:90,options:{version:19,seed:42,handling:{safelock:false}},events:[
    {frame:0,type:'start',data:{}},{frame:90,type:'end',data:{reason:'topout'}}]};
  const data={version:1,gamemode:'league',replay:{rounds:[[{id:'a',replay},{id:'b',replay}]]}};
  await page.locator('#file').setInputFiles({name:'native.ttrm',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await expect(page.locator('#analyze')).toBeEnabled();
  const before=await page.evaluate(()=>JSON.stringify(window.position));
  for(let i=1;i<=7;i++){
    await page.evaluate(()=>window.analysis=null);await page.locator('#analyze').click();
    await expect.poll(()=>page.evaluate(()=>Boolean(window.analysis)),{timeout:30000}).toBe(true);
    expect(await page.evaluate(()=>window.analysis.path)).toBe('native');
    expect(await page.evaluate(()=>window.demo.index)).toBe(i);
    expect(await page.evaluate(()=>window.demo.state.next.length)).toBe(5);
  }
  await page.locator('#clear-analysis').click();
  expect(await page.evaluate(()=>JSON.stringify(window.position))).toBe(before);
  await page.locator('#analyze').click();await page.locator('#clear-analysis').click();
  await expect(page.locator('#analysis-panel')).toBeHidden();
});
