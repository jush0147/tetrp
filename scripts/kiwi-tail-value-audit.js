import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {nativeClient} from './kiwi-native-client.js';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine,validatePlacement,commitPlacement,commitHold} from '../src/analysis/placement-authority.js';
const root='.cache/tail-value-build',read=async p=>JSON.parse(await readFile(p,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
if(process.argv[2]==='notify'){
 let r;try{r=await read(`${root}/audit.json`);}catch{}
 const ok=process.env.AUDIT_STATUS==='success'&&r?.complete;
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const msg=ok?`Tail-value bounded v2 offline preflight: candidate vs accepted ${r.changedTop1}/${r.rows.length}, shadow vs accepted ${r.shadowChangedTop1}/${r.rows.length}, candidate vs shadow ${r.candidateVsShadow}/${r.rows.length} changed top-1. Budget/publication and authority root gates passed. No arena or strength verdict; full semantic/browser gates remain.`:'Tail-value offline preflight failed/incomplete. No arena launched. Inspect artifact.';
 if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,msg+'\n'+url+'\n');
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:'Kiwi tail-value preflight',message:msg+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
 assert.ok(response.ok);assert.ok((await response.json()).id);
}else if(process.argv[2]==='audit'){
 await mkdir(root,{recursive:true});const clients=[],r={version:2,complete:false,scope:'offline activation/cost and authority root parity; no KO claim; shadow uses identical admission policy but adaptive search trajectories can diverge',rows:[],baselineReports:0,changedTop1:0,shadowChangedTop1:0,candidateVsShadow:0,published:0,probeTransitions:0,placements:0,holds:0};
 const save=()=>writeFile(`${root}/audit.json`,JSON.stringify(r,null,2));
 try{
  assert.equal(sha(await readFile('.cache/native-artifact/snapshot-accepted')),'386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb');
  const paths=['.cache/native-artifact/snapshot-accepted',`${root}/snapshot-control`,`${root}/snapshot-candidate`,`${root}/snapshot-shadow`];
  for(const path of paths)clients.push(nativeClient(resolve(path)));
  r.hashes=await Promise.all(paths.map(async p=>sha(await readFile(p))));
  const samples=[...await read('docs/audits/cc2-alignment/perf-snapshots.json'),...(await read('docs/audits/cc2-alignment/SURGE_PUBLIC_INPUTS.json')).samples];
  function restore(v){const e=new PlacementArenaEngine({rules:v.rules}),s=e.state;s.board=structuredClone(v.board);s.piece=structuredClone(v.current);s.hold=structuredClone(v.hold);s.bag.queue=[...v.next,'i','o','t','s','z','j','l'];s.frame=v.frame;s.subframe=v.subframe;s.stats.pieces=v.piecesPlaced;Object.assign(s.attack,structuredClone(v.attack));s.attack.pieces=v.piecesPlaced;s.garbageLockedUntil=v.garbageLockedUntil;return e;}
  async function analyze(client,v){
   const p=prepareKiwi(v),t=performance.now(),report=await client.request(JSON.stringify(p.request)),ms=performance.now()-t;
   assert.equal(v.next.length,5);assert.equal(report.bag_knowledge,'unknown');assert.equal(report.unknown_tail,'finite_visible');assert.equal(report.node_budget,200000);assert.ok(report.nodes>0&&report.nodes<=200000);
   if(report._tailProbe){
    const t=report._tailProbe;assert.equal(t.version,2);assert.ok(t.transitions<=report.nodes&&t.transitions<=40000);
    assert.equal(t.completed,t.published,'completed probe discarded');assert.equal(t.calls,t.completed+t.incomplete);
    assert.ok(t.allocations.length>0);assert.equal(t.allocations.reduce((s,q)=>s+q.spent,0),t.transitions);
    assert.ok(t.allocations.reduce((s,q)=>s+q.budget,0)<=200000);
    for(const q of t.allocations){assert.equal(q.quota,Math.floor(q.budget/5));assert.ok(q.spent>=0&&q.spent<=q.quota);}
   }
   return {report,ms,action:normalizeTopRecommendation(v,p,report)};
  }
  for(const sample of samples){
   if(sample.snapshotHash)assert.equal(sha(JSON.stringify(sample.snapshot)),sample.snapshotHash);
   const a=await analyze(clients[0],sample.snapshot),b=await analyze(clients[1],sample.snapshot);
   const {value_model,_tailProbe,...plain}=b.report;assert.equal(value_model,'accepted');assert.equal(_tailProbe.calls,0);assert.deepEqual(plain,a.report);r.baselineReports++;
   const c=await analyze(clients[2],sample.snapshot),d=await analyze(clients[3],sample.snapshot);
   assert.equal(c.report.value_model,'experimental-iid-one-step-frontier-bounded-v2');assert.equal(d.report.value_model,'experimental-iid-one-step-shadow-bounded-v2');
   const row={id:sample.id,snapshot:sample.snapshot,accepted:a,controlMs:b.ms,candidate:c,shadow:d};r.rows.push(row);
   r.changedTop1+=Number(JSON.stringify(a.action.policyIntent)!==JSON.stringify(c.action.policyIntent));
   r.shadowChangedTop1+=Number(JSON.stringify(a.action.policyIntent)!==JSON.stringify(d.action.policyIntent));
   r.candidateVsShadow+=Number(JSON.stringify(c.action.policyIntent)!==JSON.stringify(d.action.policyIntent));
   r.published+=c.report._tailProbe.published;r.probeTransitions+=c.report._tailProbe.transitions;await save();
   for(const [mode,initial,index] of [['candidate',c,2],['shadow',d,3]]){
    const e=restore(sample.snapshot);let v=visibleState(e.state),decision=initial;assert.deepEqual(v,sample.snapshot);
    const parity=row[`${mode}Parity`]={};
    if(decision.action.action.kind==='hold'){parity.hold=commitHold(e,v,decision.action);r.holds++;assert.equal(e.state.playing,true);v=visibleState(e.state);decision=await analyze(clients[index],v);parity.afterHold={snapshot:v,...decision};}
    assert.equal(decision.action.action.kind,'place');const proof=validatePlacement(v,decision.action),frame=e.state.frame+23;
    parity.proof=proof;await save();while(e.state.frame<frame)e.step();e.beginFrame([]);e.advanceSegment(.5);parity.actual=commitPlacement(e,proof,frame);e.finishFrame();r.placements++;
   }
  }
  r.complete=true;
 }catch(e){r.error={message:e.message,stack:e.stack,details:e.details};throw e;}
 finally{await save();for(const c of clients)await c.close();}
}else throw Error('audit | notify');
