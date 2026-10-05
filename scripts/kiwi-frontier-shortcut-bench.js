import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {cpus} from 'node:os';
import {nativeClient} from './kiwi-native-client.js';
import {prepareKiwi} from '../src/analysis/kiwi.js';
const root='.cache/frontier-shortcut-results',hash=x=>createHash('sha256').update(x).digest('hex');
if(process.argv[2]==='notify'){
 let s;try{s=JSON.parse(await readFile(`${root}/summary.json`));}catch{}
 const ok=process.env.AUDIT_JOB_STATUS==='success'&&s?.parity==='passed';
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=ok?`Full report parity passed. Native request time reduction ${(100*s.reduction).toFixed(2)}%. Gate: ${s.engineeringGate}. No arena or promotion.`:'Shortcut benchmark failed or incomplete; inspect artifacts. No arena or promotion.';
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:'Kiwi frontier shortcut result',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
 assert.ok(response.ok);assert.ok((await response.json()).id);
}else if(process.argv[2]==='bench'){
 await mkdir(root,{recursive:true});
 const raw=await readFile('docs/audits/cc2-alignment/perf-snapshots.json');
 assert.equal(hash(raw),'348c09730248410adb8b2e4dd96749afe809c21187bfd82399c6c9379be17261');
 const samples=JSON.parse(raw);assert.equal(samples.length,12);
 const pkg=resolve('.cache/eval-artifact/cc2-wasm-results/pkg');
 const wasm=await readFile(`${pkg}/cold_clear_2_bg.wasm`);
 assert.equal(hash(wasm),'ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767');
 assert.equal(hash(await readFile(`${pkg}/cold_clear_2.js`)),'728881d30d20e6751b321fa4279fb63bd2aaace6161b485f3479f18967eca691');
 const kernel=await import(pathToFileURL(`${pkg}/cold_clear_2.js`).href);await kernel.default({module_or_path:wasm});
 const clients=Object.fromEntries(['accepted','candidate'].map(k=>[k,nativeClient(resolve(root,`snapshot-${k}`))]));
 const references=[],measurements=[];let checks=0;
 async function check(actual,expected,label){
  try{assert.deepEqual(actual,expected,label);checks++;}catch(error){await writeFile(`${root}/mismatch.json`,JSON.stringify({label,actual,expected}));throw error;}
 }
 async function run(kind,sample){
  const start=performance.now(),request=prepareKiwi(sample.snapshot).request;request.node_budget=200000;
  const report=await clients[kind].request(JSON.stringify(request));
  return {report,ms:performance.now()-start};
 }
 try{
  for(const sample of samples){
   const request=prepareKiwi(sample.snapshot).request;request.node_budget=200000;
   const report=JSON.parse(kernel.analyze_snapshot_json(JSON.stringify(request)));
   assert.equal(report.bag_knowledge,'unknown');assert.equal(report.unknown_tail,'finite_visible');assert.ok(report.nodes<=200000);
   references.push({id:sample.id,report});
   for(const kind of ['accepted','candidate'])await check((await run(kind,sample)).report,report,`${sample.id}/warmup/${kind}`);
  }
  for(let pass=0;pass<3;pass++)for(const [i,sample] of samples.entries()){
   const row={id:sample.id,pass};
   for(const kind of (pass+i)%2?['candidate','accepted']:['accepted','candidate']){
    const result=await run(kind,sample);row[kind]=result.ms;
    await check(result.report,references[i].report,`${sample.id}/${pass}/${kind}`);
   }
   measurements.push(row);await writeFile(`${root}/measurements.json`,JSON.stringify(measurements));
  }
 }finally{for(const client of Object.values(clients))await client.close();}
 const total=kind=>measurements.reduce((sum,row)=>sum+row[kind],0);
 const reduction=1-total('candidate')/total('accepted');
 const passes=[0,1,2].map(pass=>{const rows=measurements.filter(r=>r.pass===pass);return 1-rows.reduce((n,r)=>n+r.candidate,0)/rows.reduce((n,r)=>n+r.accepted,0);});
 const summary={parity:'passed',checks,samples:12,passes,reduction,engineeringGate:reduction>=.05&&passes.every(x=>x>0)?'passed':'not met',nodeBudget:200000,corpusSha256:hash(raw),cpu:cpus()[0]?.model,node:process.version,sourceSha:process.env.GITHUB_SHA,scope:'Linux persistent executable request latency including prepare/stdio, excluding cold start. Not browser latency or strength evidence. No automatic promotion.'};
 await writeFile(`${root}/reports.json`,JSON.stringify(references));
 await writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}else throw Error('bench | notify');
