// Runtime-equivalence audit, or an explicitly configured frozen-policy batch leg.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {openSync,closeSync,writeSync,createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {nativeClient} from './kiwi-native-client.js';
import {match} from './kiwi-arena-core.js';
import {prepareKiwi,normalizeTopRecommendation,NODE_BUDGET} from '../src/analysis/kiwi.js';
import {config as batchConfig,legSettings} from './kiwi-visible-t-200-config.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const parallelAudit=process.argv.includes('--parallel');
const single=process.argv.includes('--single');
const batchLeg=process.argv.includes('--batch-leg');
assert.ok(!batchLeg||single&&parallelAudit);
assert.ok(!single||parallelAudit,'Single execution is restricted to native parallel validation');
const candidate=parallelAudit?'parallel':'native',control=parallelAudit?'serial':'wasm';
const artifactPrefix=parallelAudit?'kiwi-parallel-arena':'kiwi-native-arena';
const root=process.env.NATIVE_ARENA_OUT??(parallelAudit?'.cache/parallel-arena-results':'.cache/native-arena-results'),leg=Number(process.env.NATIVE_ARENA_LEG);
const profiles={
 accepted:{pkg:'.cache/eval-artifact/cc2-wasm-results/pkg',wasm:'ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767',native:'386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb'},
 'visible-t':{pkg:'.cache/visible-t-artifact/pkg',wasm:'8f476d2dcfb34c3df30f9a6bce95dd98b8cf7dd88e00b493db2539a9edf1c7f0',native:'38d541f37b40f296c306053bee7521e755b33ed256a942f449ffcdbeb27db820'},
};
const candidatePolicy=batchLeg?batchConfig.candidate:'visible-t';
if(batchLeg){
 delete profiles['visible-t'];
 profiles[candidatePolicy]={native:batchConfig.candidateNative};
 assert.equal(profiles.accepted.native,batchConfig.baselineNative);
}
if(process.argv[2]==='notify'){
 const results=[];for(const i of [0,1])try{results.push(JSON.parse(await readFile(`.cache/native-arena-legs/${artifactPrefix}-leg-${i}/result.json`)));}catch{}
 const ok=process.env.ARENA_JOB_STATUS==='success'&&results.length===2&&results.every(r=>r.complete);
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=ok?results.map(r=>`seat leg ${r.leg}: ${r.reportComparisons} exact reports; identical authority event stream; ${candidate} vs ${control} wall reduction ${(r.reduction*100).toFixed(1)}%`).join('\n'):'Arena integration failed/incomplete. Inspect mismatch and technical-failure dumps. No strength result or promotion.';
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:`Kiwi ${parallelAudit?'parallel':'native'} arena ${ok?'parity complete':'needs review'}`,message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});assert.ok(response.ok);assert.ok((await response.json()).id);
 if(!ok)process.exitCode=1;
}else if(process.argv[2]==='run'){
 const batch=batchLeg?legSettings(leg,Number(process.env.KIWI_BATCH_ATTEMPT??0)):null;
 assert.ok(batchLeg||leg===0||leg===1);assert.equal(NODE_BUDGET,200000);
 await mkdir(root,{recursive:true});
 const summary={leg,seed:batch?.seed??2026093001,nodeBudget:NODE_BUDGET,framesPerPiece:24,complete:false,runs:{},candidate,control,strengthEvidence:batchLeg,hashes:profiles,...(batch?{batch}: {})};
 const save=()=>writeFile(`${root}/result.json`,JSON.stringify(summary,null,2));await save();
 const seatNames=leg%2===0?[candidatePolicy,'accepted']:['accepted',candidatePolicy];
 try{
  for(const [name,p] of Object.entries(profiles)){
   if(!single){assert.equal(hash(await readFile(`${p.pkg}/cold_clear_2_bg.wasm`)),p.wasm);
   assert.equal(hash(await readFile(`${p.pkg}/cold_clear_2.js`)),'728881d30d20e6751b321fa4279fb63bd2aaace6161b485f3479f18967eca691');}
   assert.equal(hash(await readFile(`.cache/native-artifact/snapshot-${name}`)),p.native);
  }
  for(const runtime of single?[candidate]:leg===0?[candidate,control]:[control,candidate]){
   const closers=[],calls={};
   const reportFd=openSync(`${root}/${runtime}-reports.jsonl`,'w'),traceFd=openSync(`${root}/${runtime}-events.jsonl`,'w');
   const pending=[null,null],reportQueues=[[],[]],counts={requests:[0,0],placements:[0,0],holds:[0,0],reanalyses:[0,0],receives:[0,0],spins:{}};
   try{
    for(const [name,p] of Object.entries(profiles)){
     if(parallelAudit||runtime==='native'){const c=nativeClient(resolve(`.cache/native-artifact/snapshot-${name}`));closers.push(()=>c.close());calls[name]=text=>c.request(text);}
     else {const k=await import(pathToFileURL(resolve(p.pkg,'cold_clear_2.js')).href);await k.default({module_or_path:await readFile(`${p.pkg}/cold_clear_2_bg.wasm`)});calls[name]=text=>JSON.parse(k.analyze_snapshot_json(text));}
    }
    const bots=seatNames.map((name,seat)=>async snapshot=>{
     const p=prepareKiwi(snapshot),r=await calls[name](JSON.stringify(p.request));
     assert.equal(r.bag_knowledge,'unknown');assert.equal(r.unknown_tail,'finite_visible');assert.equal(r.node_budget,NODE_BUDGET);assert.ok(r.nodes<=NODE_BUDGET);
     const action=normalizeTopRecommendation(snapshot,p,r);
     reportQueues[seat].push({seat,name,snapshot,request:p.request,warnings:p.warnings,report:r,action});counts.requests[seat]++;return action;
    });
    const record=e=>{
     writeSync(traceFd,JSON.stringify(e)+'\n');
     if(e.type==='decision'){
      const report=reportQueues[e.seat].shift();assert.ok(report);assert.deepEqual(report.action,e.selected);writeSync(reportFd,JSON.stringify(report)+'\n');
      assert.equal(e.snapshot.next.length,5);assert.equal(e.selected.candidateIndex,0);
      if(pending[e.seat]){const actual=pending[e.seat];for(const field of ['current','hold','next','frame'])assert.deepEqual(e.snapshot[field],actual[field]);assert.equal(e.snapshot.hold.locked,true);assert.equal(e.selected.action.kind,'place');counts.reanalyses[e.seat]++;pending[e.seat]=null;}
     }
     if(e.type==='receive')counts.receives[e.seat]++;
     if(e.type==='parity'&&e.kind==='hold'){counts.holds[e.seat]++;pending[e.seat]=e.actual;}
     if(e.type==='parity'&&e.kind==='placement'){counts.placements[e.seat]++;const spin=e.actual.locks[0].spin;counts.spins[spin]=(counts.spins[spin]??0)+1;}
    };
    const start=performance.now(),result=await match(bots,{seeds:[summary.seed,summary.seed],holeSeeds:[summary.seed+1,summary.seed+2],framesPerPiece:24,maxFrames:null,watchdogFrames:360000,record,parallelDecisions:runtime==='parallel'});
    summary.runs[runtime]={wallMs:performance.now()-start,counts,result};await save();
    assert.equal(result.reason,'topout','watchdog/technical failure is not KO');assert.ok(result.failures.every(x=>x===null));assert.ok(result.parity.every(p=>p.mismatches===0));
    assert.ok(result.transportStats.every(s=>s.fallbackRequests===0&&s.rejectedCandidates===0&&s.maxSelectedRank===0));
    for(let seat=0;seat<2;seat++){assert.equal(result.parity[seat].placements,counts.placements[seat]);assert.equal(result.parity[seat].holds,counts.holds[seat]);assert.equal(counts.holds[seat],counts.reanalyses[seat]+(pending[seat]?.playing===false?1:0));if(!batchLeg){assert.ok(counts.placements[seat]>=24);assert.ok(counts.reanalyses[seat]>0);assert.ok(counts.receives[seat]>0);}}
   }finally{closeSync(reportFd);closeSync(traceFd);for(const close of closers)await close();}
  }
  async function compare(kind){
   const sa=createReadStream(`${root}/${candidate}-${kind}.jsonl`),sb=createReadStream(`${root}/${control}-${kind}.jsonl`);
   const a=createInterface({input:sa}),b=createInterface({input:sb}),it=b[Symbol.asyncIterator]();let n=0;
   try{for await(const line of a){const next=await it.next(),expected=next.done?null:JSON.parse(next.value),actual=JSON.parse(line);try{assert.deepEqual(actual,expected);}catch(e){await writeFile(`${root}/mismatch.json`,JSON.stringify({kind,index:n,actual,expected},null,2));throw e;}n++;}const extra=await it.next();if(!extra.done){await writeFile(`${root}/mismatch.json`,JSON.stringify({kind,index:n,actual:null,expected:JSON.parse(extra.value)},null,2));throw Error('extra WASM records');}}finally{a.close();b.close();sa.destroy();sb.destroy();}return n;
  }
  const deterministic=r=>{const {latencies,...rest}=r;return rest;};
  if(batchLeg){
   summary.batchValidated=true;
  }else if(single){
   // Offline oracle only after the complete match; never fed to policy.
   const reference=JSON.parse(await readFile('docs/audits/cc2-alignment/PARALLEL_ARENA_RESULT_36859147183.json')).legs.find(r=>r.leg===leg);
   summary.referenceRun=36859147183;summary.traceHashes={};
   for(const kind of ['reports','events']){const bytes=await readFile(`${root}/${candidate}-${kind}.jsonl`);summary.traceHashes[kind]=hash(bytes);assert.equal(summary.traceHashes[kind],reference.traceHashes[kind],`${kind} differs from validated single-match execution`);}
   assert.deepEqual(deterministic(summary.runs[candidate].result),reference.runs.parallel.result);
   assert.deepEqual(summary.runs[candidate].counts,reference.runs.parallel.counts);
   summary.reportComparisons=reference.reportComparisons;summary.eventComparisons=reference.eventComparisons;
  }else{
   summary.reportComparisons=await compare('reports');summary.eventComparisons=await compare('events');
   assert.deepEqual(deterministic(summary.runs[candidate].result),deterministic(summary.runs[control].result));
   summary.reduction=1-summary.runs[candidate].wallMs/summary.runs[control].wallMs;
  }
  summary.complete=true;await save();
 }catch(e){summary.error={message:e.message,stack:e.stack};await save();throw e;}
}else throw Error('run | notify');
