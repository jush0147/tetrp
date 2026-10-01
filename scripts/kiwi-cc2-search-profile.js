import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Session} from 'node:inspector';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
const [mode,artifact='.cache/cc2-candidate',out='.cache/cc2-search-profile']=process.argv.slice(2);
const corpus='docs/audits/cc2-alignment/perf-snapshots.json';
const hash=v=>createHash('sha256').update(v).digest('hex');
if(mode==='prepare'){
 const inputs=[];
 for(const leg of [0,4,12,20]){
  const file=`.cache/cc2-batch-run-36344255039/cc2-batch-leg-${leg}/game-1.jsonl`;
  const raw=await readFile(file,'utf8');
  const decisions=raw.trim().split('\n').map(JSON.parse).filter(e=>e.type==='decision'&&e.seat===0);
  for(const fraction of [.2,.5,.8]){
   const index=Math.floor((decisions.length-1)*fraction),e=decisions[index];assert.equal(e.snapshot.next.length,5);
   inputs.push({id:`leg${leg}/request${index}`,source:{run:36344255039,leg,requestIndex:index,frame:e.frame,transcriptSha256:hash(raw)},snapshot:e.snapshot});
  }
 }
 await writeFile(corpus,JSON.stringify(inputs));console.log(`Saved ${inputs.length} detached PublicSnapshots`);
}else if(['candidate','legacy','dense','accepted','visible-t'].includes(mode)){
 await mkdir(out,{recursive:true});
 const smoke=process.argv.includes('--smoke'),budget=smoke?2000:200000;
 const all=JSON.parse(await readFile(corpus)),inputs=smoke?all.slice(0,2):all;
 const pkg=resolve(mode==='legacy'?'vendor/kiwi-v1/pkg':`${artifact}/pkg`);
 const wasm=await readFile(`${pkg}/cold_clear_2_bg.wasm`);
 assert.equal(hash(wasm),({candidate:'892a6cbea43ae280bb09fc9d993a7e9d51307e39881aff9b92fb5c37177063fa',dense:'bd21800742a8d5abd54118cb51f458fb987d8f6c4f5e6cd940b12ae4deafa6ba',legacy:'af7849aa18649ebeca5e0af411499f6dc16afcdbc35ea4e094b2abffce59fa95',accepted:'ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767','visible-t':'8f476d2dcfb34c3df30f9a6bce95dd98b8cf7dd88e00b493db2539a9edf1c7f0'})[mode]);
 if(mode!=='legacy')assert.equal(hash(await readFile(`${pkg}/cold_clear_2.js`)),'728881d30d20e6751b321fa4279fb63bd2aaace6161b485f3479f18967eca691');
 const kernel=await import(pathToFileURL(`${pkg}/cold_clear_2.js`).href);await kernel.default({module_or_path:wasm});
 const requests=inputs.map(input=>{const t=performance.now(),prepared=prepareKiwi(input.snapshot),geometryMs=performance.now()-t;
  prepared.request.node_budget=budget;return {input,prepared,geometryMs,text:JSON.stringify(prepared.request)};});
 const call=x=>{const r=JSON.parse(kernel.analyze_snapshot_json(x.text));
  assert.equal(r.bag_knowledge,'unknown');assert.equal(r.unknown_tail,'finite_visible');assert.ok(r.nodes<=budget);return r;};
 const expected=requests.map(x=>{const r=call(x);normalizeTopRecommendation(x.input.snapshot,x.prepared,r);return r;});
 const latencies=[];
 // Two unprofiled passes. Complete reports, not only top-1, must stay identical.
 for(let round=0;round<2;round++)for(const [i,x]of requests.entries()){
  const t=performance.now(),r=call(x),searchMs=performance.now()-t;assert.deepEqual(r,expected[i]);
  latencies.push({id:x.input.id,round,searchMs,nodes:r.nodes});
 }
 const session=new Session();session.connect();
 const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(e,r)=>e?reject(e):resolve(r)));
 await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:1000});await post('Profiler.start');
 function profiledSearch(){return requests.map(call);}
 let profile,observed;
 try{observed=profiledSearch();profile=(await post('Profiler.stop')).profile;}finally{session.disconnect();}
 observed.forEach((r,i)=>assert.deepEqual(r,expected[i]));
 assert.ok(profile.samples?.length>0,'CPU profile produced no samples');
 await writeFile(`${out}/${mode}.cpuprofile`,JSON.stringify(profile));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();
 for(const n of profile.nodes)for(const c of n.children??[])parents.set(c,n.id);
 const totals=new Map();let sampledUs=0,searchSamples=0;
 for(let i=0;i<profile.samples.length;i++){
  let ancestor=profile.samples[i],inSearch=false;
  while(ancestor!==undefined){if(nodes.get(ancestor)?.callFrame.functionName==='profiledSearch')inSearch=true;ancestor=parents.get(ancestor);}
  if(!inSearch)continue;searchSamples++;
  const us=profile.timeDeltas?.[i]??1000;sampledUs+=us;let id=profile.samples[i],leaf=true;const seen=new Set();
  while(id!==undefined){const n=nodes.get(id);if(!n)break;const key=n.callFrame.functionName+' @ '+n.callFrame.url;
   let v=totals.get(key);if(!v){v={name:n.callFrame.functionName,url:n.callFrame.url,selfUs:0,inclusiveUs:0};totals.set(key,v);}
   if(leaf)v.selfUs+=us;if(!seen.has(key))v.inclusiveUs+=us;seen.add(key);leaf=false;id=parents.get(id);
  }
 }
 const sorted=field=>[...totals.values()].sort((a,b)=>b[field]-a[field]).slice(0,60).map(v=>({...v,share:v[field]/sampledUs}));
 assert.ok(searchSamples>0,'No samples in profiledSearch scope');
 const summary={mode,smokeOnly:smoke,wasmSha256:hash(wasm),corpusSha256:hash(await readFile(corpus)),node:process.version,budget,
  requests:requests.length,fullReportParityChecks:requests.length*3,mismatches:0,samples:profile.samples.length,searchSamples,sampledUs,
  geometry:requests.map(x=>({id:x.input.id,geometryMs:x.geometryMs})),latencies,self:sorted('selfUs'),inclusive:sorted('inclusiveUs'),
  note:'V8 sampling on unchanged WASM. Unprofiled latency kept separate; inclusive stacks overlap and must not be summed. Release inlining may hide functions. No strength or optimization claim.'};
 await writeFile(`${out}/${mode}.json`,JSON.stringify(summary,null,2));
 await writeFile(`${out}/${mode}-reports.json`,JSON.stringify(expected));
 console.log(JSON.stringify({mode,requests:summary.requests,checks:summary.fullReportParityChecks,samples:summary.samples,top:summary.self.slice(0,10)}));
}else throw Error('prepare | candidate | legacy | dense | accepted | visible-t');
