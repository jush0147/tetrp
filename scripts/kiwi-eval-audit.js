import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
const mode=process.argv[2],out='.cache/cc2-eval-results',fixture='docs/audits/cc2-alignment/eval-public-inputs.json';
const hash=s=>createHash('sha256').update(s).digest('hex');
if(mode==='prepare'){
 const corpus=await readFile('docs/audits/cc2-alignment/perf-snapshots.json','utf8');
 const all=JSON.parse(corpus),rows=[];
 for(const index of [1,4,7,10]){const row=all[index],p=prepareKiwi(row.snapshot);
  rows.push({id:row.id,source:row.source,corpusSha256:hash(corpus),snapshot:row.snapshot,request:p.request});}
 await writeFile(fixture,JSON.stringify(rows)+'\n');console.log(`Prepared ${rows.length} public inputs at 200k nodes each.`);
}else if(mode==='baseline'){
 await mkdir(out,{recursive:true});
 const pkg=resolve(process.argv[3]??'.cache/cc2-landing-run-36387270053/cc2-wasm-results/pkg');
 const wasm=await readFile(`${pkg}/cold_clear_2_bg.wasm`);
 assert.equal(hash(wasm),'ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767');
 assert.equal(hash(await readFile(`${pkg}/cold_clear_2.js`)),'728881d30d20e6751b321fa4279fb63bd2aaace6161b485f3479f18967eca691');
 const kernel=await import(pathToFileURL(`${pkg}/cold_clear_2.js`).href);await kernel.default({module_or_path:wasm});
 const rows=JSON.parse(await readFile(fixture,'utf8')),reports=[];
 for(const row of rows){const p=prepareKiwi(row.snapshot);assert.deepEqual(p.request,row.request);
  const report=JSON.parse(kernel.analyze_snapshot_json(JSON.stringify(row.request)));
  normalizeTopRecommendation(row.snapshot,p,report);reports.push({id:row.id,report});}
 await writeFile(`${out}/wasm-reference.json`,JSON.stringify(reports));console.log('Accepted WASM reports captured; top-1 geometry validated.');
}else if(mode==='gate'){
 const read=async name=>JSON.parse(await readFile(`${out}/${name}.json`,'utf8'));
 const [baseline,observed,wasm]=await Promise.all(['native-reference','observed','wasm-reference'].map(read));
 assert.equal(baseline.length,4);assert.equal(observed.length,4);assert.equal(wasm.length,4);
 for(let i=0;i<4;i++){
  assert.equal(observed[i].id,baseline[i].id);assert.equal(wasm[i].id,baseline[i].id);
  assert.deepEqual(observed[i].report,baseline[i].report,'observer altered complete report');
  assert.deepEqual(baseline[i].report,wasm[i].report,'native/accepted WASM report mismatch; do not infer artifact behavior');
  assert(observed[i].diagnostic.evaluations>0);assert(observed[i].diagnostic.rows.length>0);
  for(const row of observed[i].diagnostic.rows){
   assert.equal(row.stages.length,12);assert(row.stages.every(s=>Number.isFinite(s.eval)&&Number.isFinite(s.reward)));
   assert(row.cutouts.length<=row.cutoutAllowance);
  }
 }
 const summary={status:'passed',requests:4,nodeBudget:200000,fullReportParityChecks:8,mismatches:0,
  inputSha256:hash(await readFile(fixture)),rows:observed.map(x=>({id:x.id,...Object.fromEntries(['evaluations','withSlot','boardRewritten'].map(k=>[k,x.diagnostic[k]])),samples:x.diagnostic.rows.length})),
  limitations:'Bounded local evaluation witnesses; not full continuation/root attribution, latency benchmark or strength evidence.'};
 await writeFile(`${out}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}else if(mode==='notify'){
 let summary=null;try{summary=JSON.parse(await readFile(`${out}/summary.json`,'utf8'));}catch{}
 const ok=process.env.AUDIT_JOB_STATUS==='success'&&summary?.status==='passed';
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=ok?'Kiwi evaluator diagnostic ready: 4 public snapshots, exact full-report parity with accepted WASM and observer-off native. T-slot and score-stage witnesses collected. No tuning or arena.':'Kiwi evaluator diagnostic incomplete or parity failed; inspect artifacts. No tuning or arena.';
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n'+url+'\n');
 const r=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi evaluator audit ready':'Kiwi evaluator audit needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
 assert(r.ok);assert((await r.json()).id);if(!ok)process.exitCode=1;
}else throw Error('prepare | baseline | gate | notify');
