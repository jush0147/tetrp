import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {createHash} from 'node:crypto';
const out='.cache/cc2-wasm-results';await mkdir(out,{recursive:true});
const dense=process.argv.includes('--dense');
const smoke=process.argv.includes('--smoke'),budgets=smoke?[2000]:dense?[200000]:[2000,20000,200000],rounds=smoke?1:dense?3:2;
const cases=JSON.parse(await readFile(dense?'docs/audits/cc2-alignment/perf-snapshots.json':'.cache/cc2-trace-results/cases.json'));
// Every starting condition, both Hold states. No offline future enters the worker.
const inputs=dense?cases.map(c=>({id:c.id,snapshot:c.snapshot})):cases.filter(c=>c.id.endsWith('/holdfalse')).map(c=>({id:c.id,snapshot:c.initial}));
assert.equal(inputs.length,12);
const reference=dense?'/.cache/cc2-dense-reference/pkg':'/vendor/kiwi-v1/pkg';
if(dense){
 const hash=v=>createHash('sha256').update(v).digest('hex');
 const referenceWasm=hash(await readFile('.'+reference+'/cold_clear_2_bg.wasm'));
 const referenceJs=hash(await readFile('.'+reference+'/cold_clear_2.js'));
 assert.equal(referenceWasm,'892a6cbea43ae280bb09fc9d993a7e9d51307e39881aff9b92fb5c37177063fa');
 assert.equal(referenceJs,'728881d30d20e6751b321fa4279fb63bd2aaace6161b485f3479f18967eca691');
 await writeFile(`${out}/comparison.json`,JSON.stringify({referenceRun:36323060219,referenceWasm,referenceJs,
  candidateWasm:hash(await readFile(`${out}/pkg/cold_clear_2_bg.wasm`)),corpus:hash(await readFile('docs/audits/cc2-alignment/perf-snapshots.json'))},null,2));
}
await writeFile(`${out}/inputs.json`,JSON.stringify(inputs));
const worker=`
try {
const {default:initCandidate,analyze_snapshot_json:candidate}=await import('/.cache/cc2-wasm-results/pkg/cold_clear_2.js');
const {default:initLegacy,analyze_snapshot_json:legacy}=await import('${reference}/cold_clear_2.js');
const {prepareKiwi,normalizeTopRecommendation}=await import('/src/analysis/kiwi.js');
const {validatePlacement,PlacementArenaEngine,commitHold}=await import('/src/analysis/placement-authority.js');
const candidateModule=await initCandidate(),legacyModule=await initLegacy();
function check(s,p,r){
 const action=normalizeTopRecommendation(s,p,r);
 if(action.action.kind==='place')return {kind:'place',certificate:validatePlacement(s,action)};
 const e=new PlacementArenaEngine({rules:s.rules}),v=e.state;
 Object.assign(v,{board:structuredClone(s.board),piece:structuredClone(s.current),hold:{...s.hold},frame:s.frame,subframe:s.subframe,
 playing:s.playing,garbageLockedUntil:s.garbageLockedUntil});v.bag.queue=[...s.next];v.stats.pieces=s.piecesPlaced;
 Object.assign(v.attack,structuredClone(s.attack));v.attack.pieces=s.piecesPlaced;v.lastClear=v.attack.combo>0;
 commitHold(e,s,action);return {kind:'hold',playing:v.playing,locked:v.hold.locked};
}
self.onmessage=({data:{input,budget,order,round}})=>{
 try{
  const started=performance.now(),prepared=prepareKiwi(input.snapshot),geometryMs=performance.now()-started;
  prepared.request.node_budget=budget;const request=JSON.stringify(prepared.request),results={};
  for(const name of order){
   const t=performance.now(),report=JSON.parse(({candidate,legacy}[name])(request)),searchMs=performance.now()-t;
   if(report.nodes>budget||report.bag_knowledge!=='unknown'||report.unknown_tail!=='finite_visible')throw Error('Information/budget contract');
   const checked=check(input.snapshot,prepared,report);
   results[name]={searchMs,wasmMemoryBytes:({candidate:candidateModule,legacy:legacyModule}[name]).memory.buffer.byteLength,checked,report};
  }
  postMessage({id:input.id,budget,round,order,geometryMs,results});
 }catch(e){postMessage({error:String(e.stack||e),id:input.id,budget,round});}
};
postMessage({ready:true});
} catch(e) {postMessage({error:String(e.stack||e)});}`;
const root=path.resolve('.');
const server=createServer(async(req,res)=>{
 try{
  const p=new URL(req.url,'http://localhost').pathname;
  if(p==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>CC2 Worker budget audit</title>');return;}
  if(p==='/worker.js'){res.setHeader('Content-Type','text/javascript');res.end(worker);return;}
  if(!['/src/','/vendor/kiwi-v1/','/.cache/cc2-wasm-results/pkg/','/.cache/cc2-dense-reference/pkg/'].some(a=>p.startsWith(a))){res.writeHead(404);res.end();return;}
  const file=path.resolve('.'+p);assert.ok(file.startsWith(root+path.sep));
  res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.json')?'application/json':'text/javascript');res.end(await readFile(file));
 }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const rows=[];
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage();
 page.on('console',m=>{if(m.type()==='error')console.error('Browser:',m.text());});
 page.on('requestfailed',r=>console.error('Request failed:',r.url(),r.failure()));
 page.on('response',r=>{if(r.status()>=400)console.error('HTTP:',r.status(),r.url());});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>new Promise((resolve,reject)=>{
  window.auditWorker=new Worker('/worker.js',{type:'module'});
  const timer=setTimeout(()=>reject(Error('Worker init timeout')),30000);
  auditWorker.onmessage=e=>{clearTimeout(timer);e.data.ready?resolve():reject(Error(JSON.stringify(e.data)));};
  auditWorker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};
 }));
 // Persistent worker retains the air cache. Round 0 includes first-use costs;
 // round 1 is warm. No wall-clock cutoff decides gameplay or truncates search.
 for(const budget of budgets)for(let round=0;round<rounds;round++)for(const [i,input]of inputs.entries()){
  const row=await page.evaluate(data=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{auditWorker.terminate();reject(Error('Technical watchdog: 120s/request'));},120000);
   auditWorker.onmessage=e=>{clearTimeout(timer);resolve(e.data);};
   auditWorker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};auditWorker.postMessage(data);
  }),{input,budget,round,order:(i+round)%2?['candidate','legacy']:['legacy','candidate']});
  rows.push(row);await writeFile(`${out}/rows.json`,JSON.stringify(rows));
  assert.ok(!row.error,JSON.stringify(row));
  if(dense)assert.deepEqual(row.results.candidate.report,row.results.legacy.report,`Full recommendation mismatch: ${row.id}, round ${round}`);
 }
 const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.ceil(a.length*p)-1];
 const timings=budgets.map(budget=>({budget,...Object.fromEntries(['candidate','legacy'].map(name=>{
  const xs=rows.filter(r=>r.budget===budget&&r.round===rounds-1).map(r=>r.results[name].searchMs);
  return [name,{medianMs:percentile(xs,.5),p95Ms:percentile(xs,.95),maxMs:Math.max(...xs)}];
 }))}));
 const summary={status:'browser-smoke-passed',smokeOnly:smoke,checks:rows.length*2,mismatches:0,browser:browser.version(),worker:true,
  timings,placements:rows.flatMap(r=>Object.values(r.results)).filter(r=>r.checked.kind==='place').length,
  holds:rows.flatMap(r=>Object.values(r.results)).filter(r=>r.checked.kind==='hold').length,
  note:'Top-1 geometry/Hold validation and cost only; no candidate fallback. Latency is reported, not an automatic performance or strength promotion.'};
 if(dense){
  const perState=inputs.map(input=>{
   const rs=rows.filter(r=>r.id===input.id&&(smoke||r.round>0));
   const mean=name=>rs.reduce((sum,r)=>sum+r.results[name].searchMs,0)/rs.length;
   const candidateMs=mean('candidate'),referenceMs=mean('legacy');
   return {id:input.id,candidateMs,referenceMs,reduction:1-candidateMs/referenceMs};
  });
  const medianReduction=percentile(perState.map(r=>r.reduction),.5);
  const performancePassed=!smoke&&medianReduction>=.10&&perState.every(r=>r.reduction>=-.10);
  Object.assign(summary,{status:'dense-report-parity-passed',referenceName:'accepted corrected Kiwi (not vendored Legacy)',
   fullReportPairs:rows.length,perState,medianReduction,performancePassed,
   note:'Storage-only experiment: exact full-report parity required. Performance pass: >=10% median paired reduction and no state >10% slower. No strength promotion.'});
 }
 await writeFile(`${out}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}catch(e){await writeFile(`${out}/failure.json`,JSON.stringify({error:e.stack,completedPairs:rows.length}));throw e;}
finally{await browser?.close();await new Promise(r=>server.close(r));}
