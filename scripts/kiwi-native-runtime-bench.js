import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {cpus} from 'node:os';
import {nativeClient} from './kiwi-native-client.js';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
const root='.cache/native-runtime-results',hash=x=>createHash('sha256').update(x).digest('hex');
if(process.argv[2]==='notify'){
 let s;try{s=JSON.parse(await readFile(`${root}/summary.json`));}catch{}
 const ok=process.env.AUDIT_JOB_STATUS==='success'&&s?.policies?.length===2;
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=ok?s.policies.map(p=>`${p.policy}: full report parity passed; native complete-request reduction ${(p.reduction*100).toFixed(1)}% (${p.speedup.toFixed(2)}x).`).join('\n'):'Native/WASM experiment incomplete or parity failed. Inspect artifacts; no arena migration.';
 const r=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi native runtime comparison complete':'Kiwi native runtime needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});assert.ok(r.ok);assert.ok((await r.json()).id);
}else if(process.argv[2]==='bench'){
 await mkdir(root,{recursive:true});
 const raw=await readFile('docs/audits/cc2-alignment/perf-snapshots.json');
 assert.equal(hash(raw),'348c09730248410adb8b2e4dd96749afe809c21187bfd82399c6c9379be17261');
 const samples=JSON.parse(raw),policies=[];
 const frozen={accepted:['.cache/eval-artifact/cc2-wasm-results/pkg','ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767'],'visible-t':['.cache/visible-t-artifact/pkg','8f476d2dcfb34c3df30f9a6bce95dd98b8cf7dd88e00b493db2539a9edf1c7f0']};
 async function run(call,snapshot){
  const before=JSON.stringify(snapshot),t=performance.now(),prepared=prepareKiwi(snapshot);prepared.request.node_budget=200000;
  const t1=performance.now(),report=await call(JSON.stringify(prepared.request)),t2=performance.now();
  assert.equal(report.bag_knowledge,'unknown');assert.equal(report.unknown_tail,'finite_visible');assert.ok(report.nodes<=200000);
  const action=normalizeTopRecommendation(snapshot,prepared,report),proof=action.action.kind==='place'?validatePlacement(snapshot,action):null;
  const end=performance.now();assert.equal(JSON.stringify(snapshot),before);
  return {value:{request:prepared.request,warnings:prepared.warnings,report,action,proof},ms:{total:end-t,prepare:t1-t,searchAndTransport:t2-t1,normalizeAndCertificate:end-t2}};
 }
 for(const policy of ['accepted','visible-t']){
  const [pkg,expectedHash]=frozen[policy],wasm=await readFile(`${pkg}/cold_clear_2_bg.wasm`);assert.equal(hash(wasm),expectedHash);
  assert.equal(hash(await readFile(`${pkg}/cold_clear_2.js`)),'728881d30d20e6751b321fa4279fb63bd2aaace6161b485f3479f18967eca691');
  const kernel=await import(pathToFileURL(resolve(pkg,'cold_clear_2.js')).href);await kernel.default({module_or_path:wasm});
  const exe=resolve(root,`snapshot-${policy}`),client=nativeClient(exe);
  const call={wasm:text=>JSON.parse(kernel.analyze_snapshot_json(text)),native:text=>client.request(text)},references=[],measurements=[];
  let checks=0;
  async function parity(actual,expected,label){try{assert.deepEqual(actual,expected,label);checks++;}catch(e){await writeFile(`${root}/${policy}-mismatch.json`,JSON.stringify({label,actual,expected},null,2));throw e;}}
  try{
   // First calls include cold startup; excluded from steady-state measurements.
   for(const s of samples){const expected=(await run(call.wasm,s.snapshot)).value;references.push(expected);await parity((await run(call.native,s.snapshot)).value,expected,`${s.id}/warmup`);}
   // Error response must not kill or desynchronize the persistent process.
   await assert.rejects(client.request('invalid'),/native request rejected/);
   for(let pass=0;pass<3;pass++)for(const [i,s] of samples.entries()){
    const ms={};for(const kind of (pass+i)%2?['native','wasm']:['wasm','native']){
     const result=await run(call[kind],s.snapshot);await parity(result.value,references[i],`${s.id}/${pass}/${kind}`);ms[kind]=result.ms;
    }measurements.push({id:s.id,pass,...ms});
   }
  }finally{await client.close();}
  // Fresh OS process must produce the same report, not just the same persistent instance.
  const restarted=nativeClient(exe);try{await parity((await run(text=>restarted.request(text),samples[0].snapshot)).value,references[0],'process restart');}finally{await restarted.close();}
  const total=kind=>measurements.reduce((n,r)=>n+r[kind].total,0),reduction=1-total('native')/total('wasm');
  const result={policy,wasmSha256:hash(wasm),nativeSha256:hash(await readFile(exe)),samples:samples.length,checks,measurements,reduction,speedup:total('wasm')/total('native'),meetsEngineeringGate:reduction>=.1};
  policies.push(result);await writeFile(`${root}/${policy}.json`,JSON.stringify(result,null,2));await writeFile(`${root}/${policy}-reports.json`,JSON.stringify(references));console.log(JSON.stringify({policy,checks,reduction,speedup:result.speedup}));
 }
 await writeFile(`${root}/summary.json`,JSON.stringify({corpusSha256:hash(raw),node:process.version,cpu:cpus()[0]?.model,policies,scope:'Same 200k-node snapshot API; persistent native stdio transport included. Process startup excluded. Full reports exact, no score tolerance. Fixed corpus is not arena or browser evidence; no automatic migration.'},null,2));
}else throw Error('bench | notify');
