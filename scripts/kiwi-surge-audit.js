import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {nativeClient} from './kiwi-native-client.js';
import {prepareKiwi,normalizeRecommendation} from '../src/analysis/kiwi.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine,validatePlacement,commitPlacement} from '../src/analysis/placement-authority.js';
const dir='.cache/surge-audit',read=async p=>JSON.parse(await readFile(p,'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
export function restore(v){
 const e=new PlacementArenaEngine({rules:v.rules}),s=e.state;
 s.board=structuredClone(v.board);s.piece=structuredClone(v.current);s.hold=structuredClone(v.hold);
 s.bag.queue=[...v.next,'i','o','t','s','z','j','l'];s.frame=v.frame;s.subframe=v.subframe;
 s.stats.pieces=v.piecesPlaced;Object.assign(s.attack,structuredClone(v.attack));s.attack.pieces=v.piecesPlaced;
 s.garbageLockedUntil=v.garbageLockedUntil;assert.deepEqual(visibleState(s),v);return e;
}
export function rootPlacements(v,p,report){
 // Independent hypothetical root branches, never candidate fallback in an arena.
 return report.candidates.map((c,rank)=>{
  if(c.action.kind==='hold')return {rank,action:c.action,score:c.mean_score,requiresReanalysis:true};
  const action=normalizeRecommendation(v,p,{...report,action:c.action}),proof=validatePlacement(v,action),e=restore(v),lockFrame=v.frame+23;
  while(e.state.frame<lockFrame)e.step();e.beginFrame([]);e.advanceSegment(.5);
  const before=structuredClone(e.state.attack.totals),actual=commitPlacement(e,proof,lockFrame);
  const after=e.state.attack;
  return {rank,action:c.action,score:c.mean_score,worstScore:c.worst_score,clear:actual.clear,lock:actual.locks[0],
   btbBefore:v.attack.btb,btbAfter:after.btb,released:after.btb===0&&v.attack.btb>v.rules.b2bcharge_at,
   generated:after.totals.generated-before.generated,cancelled:after.totals.cancelled-before.cancelled,sent:after.totals.sent-before.sent,
   multiplierAtLock:after.multiplier,playing:e.state.playing};
 });
}
if(process.argv[2]==='audit'){
 await mkdir(dir,{recursive:true});const result={complete:false,samples:[],errors:[]};
 const clients=[];try{
  assert.equal(sha(await readFile('.cache/native-artifact/snapshot-accepted')),'386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb');
  const base=nativeClient(resolve('.cache/native-artifact/snapshot-accepted')),obs=nativeClient(resolve('.cache/cc2-wasm-source/target/release/snapshot_surge'));clients.push(base,obs);
  const input=await read('docs/audits/cc2-alignment/SURGE_PUBLIC_INPUTS.json');
  for(const s of input.samples){
   assert.equal(sha(JSON.stringify(s.snapshot)),s.snapshotHash);const p=prepareKiwi(s.snapshot),raw=JSON.stringify(p.request);
   const reference=await base.request(raw),observed=await obs.request(raw),diagnostic=observed._surgeObserver;delete observed._surgeObserver;
   assert.deepEqual(observed,reference,'Observer changed accepted report');assert.ok(diagnostic.evaluations>0);
   assert.equal(observed.node_budget,200000);assert.equal(observed.bag_knowledge,'unknown');assert.equal(observed.unknown_tail,'finite_visible');
   const roots=rootPlacements(s.snapshot,p,observed);
   result.samples.push({id:s.id,snapshot:s.snapshot,request:p.request,report:reference,roots,diagnostic,
    bestRelease:roots.find(x=>x.released)??null,bestKeep:roots.find(x=>x.btbAfter>0)??null});
   await writeFile(`${dir}/result.json`,JSON.stringify(result));
   console.log(JSON.stringify({id:s.id,rootCandidates:roots.length,releaseRank:roots.find(x=>x.released)?.rank??null,observerEvaluations:diagnostic.evaluations}));
  }
  result.complete=true;
 }catch(e){result.errors.push({message:e.message,stack:e.stack,details:e.details});process.exitCode=1;}
 finally{for(const c of clients)await c.close();await writeFile(`${dir}/result.json`,JSON.stringify(result));}
}else if(process.argv[2]==='notify'){
 let r;try{r=await read(`${dir}/result.json`);}catch{}
 const ok=r?.complete&&process.env.AUDIT_STATUS==='success',url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi Surge diagnostic ready':'Kiwi Surge diagnostic needs review',message:(ok?'8 charged PublicSnapshots audited; observer preserved accepted reports. No weights changed or arena launched.':'Diagnostic incomplete; no strength verdict or arena launched.')+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
 assert.ok(response.ok);assert.ok((await response.json()).id);
}
