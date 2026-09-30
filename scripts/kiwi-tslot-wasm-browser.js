import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,appendFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const harnessOnly=process.argv.includes('--harness-smoke');
const out=harnessOnly?'.cache/tslot-wasm-harness':'.cache/tslot-wasm-results',reference='.cache/tslot-native-reference';
await mkdir(out,{recursive:true});
if(process.argv[2]==='notify'){
 let s;try{s=JSON.parse(await readFile(`${out}/summary.json`,'utf8'));}catch{}
 const ok=process.env.AUDIT_JOB_STATUS==='success'&&s?.correctnessPassed;
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=ok?`Visible-T WASM/Chromium Worker correctness passed. ${s.fullReportChecks} exact report checks. Relative performance screen: ${s.performanceScreenPassed?'passed':'needs review'}. No arena or promotion.`:'Visible-T WASM/Worker validation failed or incomplete; inspect artifact. No arena or promotion.';
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n'+url+'\n');
 const r=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi WASM diagnostic ready':'Kiwi WASM diagnostic needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
 assert(r.ok);assert((await r.json()).id);if(!ok)process.exitCode=1;
}else{
 const {chromium}=await import('@playwright/test');
 await rm(`${out}/failure.json`,{force:true});
 const load=async n=>JSON.parse(await readFile(`${reference}/${n}.json`,'utf8'));
 const [inputs,native,baseline,prior]=await Promise.all(['candidate-inputs','candidate','wasm-reference','summary'].map(load));
 assert.equal(prior.status,'passed');assert.equal(inputs.length,8);
 const hash=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(hash(await readFile(`${reference}/candidate-inputs.json`)),prior.inputSha256);
 const packages={candidate:harnessOnly?'.cache/eval-artifact/cc2-wasm-results/pkg':`${out}/pkg`,baseline:'.cache/eval-artifact/cc2-wasm-results/pkg'},hashes={};
 for(const [name,p] of Object.entries(packages))hashes[name]={wasm:hash(await readFile(`${p}/cold_clear_2_bg.wasm`)),js:hash(await readFile(`${p}/cold_clear_2.js`))};
 assert.equal(hashes.baseline.wasm,'ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767');
 assert.equal(hashes.baseline.js,'728881d30d20e6751b321fa4279fb63bd2aaace6161b485f3479f18967eca691');
 await writeFile(`${out}/manifest.json`,JSON.stringify({hashes,nativeRun:36566413689,baselineRun:36387270053,inputSha256:prior.inputSha256},null,2));
 const worker=`
 try {
 const {prepareKiwi,normalizeTopRecommendation}=await import('/src/analysis/kiwi.js');
 const {validatePlacement,PlacementArenaEngine,commitHold}=await import('/src/analysis/placement-authority.js');
 const kernels={},memories={};
 for(const [name,p] of Object.entries(${JSON.stringify(packages)})){
  const m=await import('/'+p+'/cold_clear_2.js');memories[name]=await m.default();kernels[name]=m.analyze_snapshot_json;
 }
 self.onmessage=({data:{input,order}})=>{try{
  const t=performance.now(),p=prepareKiwi(input.snapshot),geometryMs=performance.now()-t,results={};
  if(JSON.stringify(p.request)!==JSON.stringify(input.request))throw Error('Public request mismatch');
  for(const name of order){const started=performance.now(),report=JSON.parse(kernels[name](JSON.stringify(p.request))),searchMs=performance.now()-started;
   const action=normalizeTopRecommendation(input.snapshot,p,report);let checked;
   if(action.action.kind==='place'){const proof=validatePlacement(input.snapshot,action);checked={kind:'place',identity:proof.intent,clear:proof.clear};}
   else {const s=input.snapshot,e=new PlacementArenaEngine({rules:s.rules}),v=e.state;
    Object.assign(v,{board:structuredClone(s.board),piece:structuredClone(s.current),hold:{...s.hold},frame:s.frame,subframe:s.subframe,playing:s.playing,garbageLockedUntil:s.garbageLockedUntil});
    v.bag.queue=[...s.next];v.stats.pieces=s.piecesPlaced;Object.assign(v.attack,structuredClone(s.attack));v.attack.pieces=s.piecesPlaced;v.lastClear=v.attack.combo>0;
    const actual=commitHold(e,s,action);
    // Do not analyze an invented empty-Hold reveal. Only the known prefix is checked.
    checked={kind:'hold',mode:action.action.mode,locked:actual.hold.locked,requiresReanalysis:action.action.requiresReanalysis};
   }
   results[name]={report,searchMs,checked,memoryBytes:memories[name].memory.buffer.byteLength};
  }
  postMessage({id:input.id,geometryMs,results});
 }catch(e){postMessage({error:e.stack||String(e)});}};
 postMessage({ready:true,isolated:crossOriginIsolated});
 }catch(e){postMessage({error:e.stack||String(e)});}`;
 // Parse the generated module's async body before launching Chromium.
 new (Object.getPrototypeOf(async function(){}).constructor)(worker);
 const root=path.resolve('.'),server=createServer(async(req,res)=>{try{
  const p=new URL(req.url,'http://localhost').pathname;
  if(p==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Visible-T worker diagnostic</title>');return;}
  if(p==='/worker.js'){res.setHeader('Content-Type','text/javascript');res.end(worker);return;}
  assert(['/src/','/vendor/kiwi-v1/',...Object.values(packages).map(p=>'/'+p+'/')].some(prefix=>p.startsWith(prefix)));
  const file=path.resolve('.'+p);assert(file.startsWith(root+path.sep));
  res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.json')?'application/json':'text/javascript');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const rows=[];
 try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>new Promise((resolve,reject)=>{
   window.worker=new Worker('/worker.js',{type:'module'});
   const timer=setTimeout(()=>reject(Error('Worker init watchdog')),30000);
   worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};
   worker.onmessage=e=>{clearTimeout(timer);e.data.ready&&!e.data.isolated?resolve():reject(Error(JSON.stringify(e.data)));};
  }));
  for(let round=0;round<3;round++)for(const [i,input] of inputs.entries()){
   const row=await page.evaluate(data=>new Promise((resolve,reject)=>{
    let ticks=0,last=performance.now(),maxGapMs=0;
    const beat=setInterval(()=>{const now=performance.now();maxGapMs=Math.max(maxGapMs,now-last);last=now;ticks++;},50);
    const clean=()=>{clearInterval(beat);clearTimeout(timer);};
    const timer=setTimeout(()=>{clean();worker.terminate();reject(Error('Technical watchdog 60s/request'));},60000);
    worker.onerror=e=>{clean();reject(Error(e.message));};
    worker.onmessage=e=>{clean();resolve({...e.data,heartbeat:{ticks,maxGapMs}});};worker.postMessage(data);
   }),{input,order:(i+round)%2?['candidate','baseline']:['baseline','candidate']});
   row.round=round;rows.push(row);await writeFile(`${out}/rows.json`,JSON.stringify(rows));assert(!row.error,row.error);
   assert.equal(native[i].id,input.id);assert.equal(baseline[i].id,input.id);
   assert.deepEqual(row.results.candidate.report,(harnessOnly?baseline:native)[i].report,'WASM differs from verified reference');
   assert.deepEqual(row.results.baseline.report,baseline[i].report,'accepted WASM changed in Worker');
   for(const r of Object.values(row.results)){assert(r.report.nodes<=200000);assert.equal(r.report.node_budget,200000);assert.equal(r.report.bag_knowledge,'unknown');assert.equal(r.report.unknown_tail,'finite_visible');}
   assert(row.heartbeat.ticks>0,'UI heartbeat did not run during Worker request');
  }
  const quantile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.ceil(a.length*p)-1];
  const perState=inputs.map(input=>{const r=rows.filter(r=>r.id===input.id&&r.round>0),mean=name=>r.reduce((a,r)=>a+r.results[name].searchMs,0)/r.length;
   return {id:input.id,candidateMs:mean('candidate'),baselineMs:mean('baseline'),ratio:mean('candidate')/mean('baseline')};});
  const medianRatio=quantile(perState.map(r=>r.ratio),.5),worstRatio=Math.max(...perState.map(r=>r.ratio));
  const summary={correctnessPassed:!harnessOnly,harnessOnly,fullReportChecks:rows.length*2,mismatches:0,requests:8,rounds:3,browser:browser.version(),worker:true,crossOriginIsolated:false,
   performanceScreenPassed:medianRatio<=1.25&&worstRatio<=1.5,thresholds:{medianRatio:1.25,worstStateRatio:1.5},medianRatio,worstRatio,perState,
   latency:Object.fromEntries(['candidate','baseline'].map(name=>{const a=rows.filter(r=>r.round>0).map(r=>r.results[name].searchMs);return [name,{medianMs:quantile(a,.5),p95Ms:quantile(a,.95),maxMs:Math.max(...a),maxMemoryBytes:Math.max(...rows.map(r=>r.results[name].memoryBytes))}];})),
   heartbeatMaxGapMs:Math.max(...rows.map(r=>r.heartbeat.maxGapMs)),
   limitations:'One hosted Chromium runner, one initial pass + two warm passes; comparative regression screen, not user-device latency certification, production Worker integration, PWA offline test, physical timing or KO strength. No automatic promotion.'};
  await writeFile(`${out}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 }catch(e){await writeFile(`${out}/failure.json`,JSON.stringify({error:e.stack,completedPairs:rows.length}));throw e;}
 finally{await browser?.close();await new Promise(r=>server.close(r));}
}
