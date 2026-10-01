import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
const root='.cache/movegen-cache-results',hash=x=>createHash('sha256').update(x).digest('hex');
const mode=process.argv[2];
if(mode==='notify'){
 let result;try{result=JSON.parse(await readFile(`${root}/summary.json`));}catch{}
 const ok=process.env.AUDIT_JOB_STATUS==='success'&&result?.policies?.length===2;
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=ok?result.policies.map(p=>`${p.policy}: full parity passed; request reduction ${(p.reduction*100).toFixed(1)}%; ${p.meetsThreshold?'meets':'below'} 10% gate`).join('\n'):'Cache experiment incomplete or failed. Inspect artifacts; no arena or production change.';
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi cache experiment complete':'Kiwi cache experiment needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
 assert.ok(response.ok);assert.ok((await response.json()).id);
}else if(mode==='bench'){
 await mkdir(root,{recursive:true});
 const raw=await readFile('docs/audits/cc2-alignment/perf-snapshots.json');
 assert.equal(hash(raw),'348c09730248410adb8b2e4dd96749afe809c21187bfd82399c6c9379be17261');
 const samples=JSON.parse(raw),policies=[];
 const frozen={accepted:['.cache/eval-artifact/cc2-wasm-results/pkg','ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767'],'visible-t':['.cache/visible-t-artifact/pkg','8f476d2dcfb34c3df30f9a6bce95dd98b8cf7dd88e00b493db2539a9edf1c7f0']};
 async function load(path,expected){const bytes=await readFile(`${path}/cold_clear_2_bg.wasm`);if(expected)assert.equal(hash(bytes),expected);
  const kernel=await import(pathToFileURL(resolve(path,'cold_clear_2.js')).href);await kernel.default({module_or_path:bytes});return {kernel,hash:hash(bytes)};}
 function run(k,s){
  const before=JSON.stringify(s),t=performance.now(),prepared=prepareKiwi(s);prepared.request.node_budget=200000;
  const report=JSON.parse(k.analyze_snapshot_json(JSON.stringify(prepared.request)));
  assert.equal(report.bag_knowledge,'unknown');assert.equal(report.unknown_tail,'finite_visible');assert.ok(report.nodes<=200000);
  const action=normalizeTopRecommendation(s,prepared,report),proof=action.action.kind==='place'?validatePlacement(s,action):null;
  const ms=performance.now()-t;assert.equal(JSON.stringify(s),before);
  return {value:{request:prepared.request,warnings:prepared.warnings,report,action,proof},ms};
 }
 for(const policy of ['accepted','visible-t']){
  const builds={frozen:await load(...frozen[policy])};
  for(const kind of ['off','on','verify'])builds[kind]=await load(`${root}/${policy}-${kind}`);
  const references=[],stats=[],measurements=[];
  for(const sample of samples){
   const expected=run(builds.frozen.kernel,sample.snapshot).value;
   for(const kind of ['off','on','verify'])assert.deepEqual(run(builds[kind].kernel,sample.snapshot).value,expected,`${policy}/${sample.id}/${kind}`);
   const v=JSON.parse(builds.verify.kernel.movegen_cache_stats_json());
   assert.equal(v[0],v[1]+v[2]);assert.ok(v[4]<=512);
   stats.push({id:sample.id,calls:v[0],hits:v[1],misses:v[2],evictions:v[3],peakEntries:v[4],peakPayloadBytes:v[5]});references.push(expected);
  }
  // Already warmed all builds. Paired order alternates; no instrumentation in timed builds.
  for(let pass=0;pass<3;pass++)for(const [i,sample] of samples.entries()){
   const ms={};for(const kind of (pass+i)%2?['on','off']:['off','on']){
    const r=run(builds[kind].kernel,sample.snapshot);assert.deepEqual(r.value,references[i],`${policy}/${sample.id}/${kind}/${pass}`);ms[kind]=r.ms;
   }
   measurements.push({id:sample.id,pass,...ms});
  }
  const sum=kind=>measurements.reduce((s,r)=>s+r[kind],0),reduction=1-sum('on')/sum('off');
  const result={policy,hashes:Object.fromEntries(Object.entries(builds).map(([k,v])=>[k,v.hash])),samples:samples.length,fullReportComparisons:samples.length*9,capacity:512,eviction:'FIFO',stats,measurements,reduction,meetsThreshold:reduction>=.1,
   memoryNote:'Payload bytes count stored placement/cost elements; excludes BTreeMap nodes, keys, Vec headers, FIFO and allocator overhead. Entries bounded at 512; WASM memory is not claimed to shrink after requests.'};
  policies.push(result);await writeFile(`${root}/${policy}.json`,JSON.stringify(result,null,2));
  await writeFile(`${root}/${policy}-reports.json`,JSON.stringify(references));console.log(JSON.stringify({policy,reduction,meetsThreshold:result.meetsThreshold}));
 }
 await writeFile(`${root}/summary.json`,JSON.stringify({corpusSha256:hash(raw),node:process.version,policies,scope:'Fixed public corpus; full prepare/search/normalize/certificate requests. No arena, no Hold transition execution, no strength claim. Threshold is engineering gate only.'},null,2));
}else throw Error('bench | notify');
