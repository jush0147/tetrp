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
 const msg=ok?`Tail-value offline preflight: ${r.changedTop1}/${r.rows.length} changed top-1, ${r.published} published probes, ${r.probeTransitions} charged transitions. No arena or strength verdict. Full semantic/browser-cost gate still required.`:'Tail-value offline preflight failed/incomplete. No arena launched. Inspect artifact.';
 if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,msg+'\n'+url+'\n');
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:'Kiwi tail-value preflight',message:msg+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
 assert.ok(response.ok);assert.ok((await response.json()).id);
}else if(process.argv[2]==='audit'){
 await mkdir(root,{recursive:true});const clients=[],r={complete:false,scope:'offline activation/cost and authority root parity; no KO claim',rows:[],baselineReports:0,changedTop1:0,published:0,probeTransitions:0,placements:0,holds:0};
 const save=()=>writeFile(`${root}/audit.json`,JSON.stringify(r,null,2));
 try{
  assert.equal(sha(await readFile('.cache/native-artifact/snapshot-accepted')),'386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb');
  for(const path of ['.cache/native-artifact/snapshot-accepted',`${root}/snapshot-control`,`${root}/snapshot-candidate`])clients.push(nativeClient(resolve(path)));
  r.hashes=await Promise.all(['.cache/native-artifact/snapshot-accepted',`${root}/snapshot-control`,`${root}/snapshot-candidate`].map(async p=>sha(await readFile(p))));
  const samples=[...await read('docs/audits/cc2-alignment/perf-snapshots.json'),...(await read('docs/audits/cc2-alignment/SURGE_PUBLIC_INPUTS.json')).samples];
  function restore(v){const e=new PlacementArenaEngine({rules:v.rules}),s=e.state;s.board=structuredClone(v.board);s.piece=structuredClone(v.current);s.hold=structuredClone(v.hold);s.bag.queue=[...v.next,'i','o','t','s','z','j','l'];s.frame=v.frame;s.subframe=v.subframe;s.stats.pieces=v.piecesPlaced;Object.assign(s.attack,structuredClone(v.attack));s.attack.pieces=v.piecesPlaced;s.garbageLockedUntil=v.garbageLockedUntil;return e;}
  async function analyze(client,v){
   const p=prepareKiwi(v),t=performance.now(),report=await client.request(JSON.stringify(p.request)),ms=performance.now()-t;
   assert.equal(v.next.length,5);assert.equal(report.bag_knowledge,'unknown');assert.equal(report.unknown_tail,'finite_visible');assert.equal(report.node_budget,200000);assert.ok(report.nodes>0&&report.nodes<=200000);
   if(report._tailProbe)assert.ok(report._tailProbe.transitions<=report.nodes);
   return {report,ms,action:normalizeTopRecommendation(v,p,report)};
  }
  for(const sample of samples){
   if(sample.snapshotHash)assert.equal(sha(JSON.stringify(sample.snapshot)),sample.snapshotHash);
   const a=await analyze(clients[0],sample.snapshot),b=await analyze(clients[1],sample.snapshot);
   const {value_model,_tailProbe,...plain}=b.report;assert.equal(value_model,'accepted');assert.equal(_tailProbe.calls,0);assert.deepEqual(plain,a.report);r.baselineReports++;
   const e=restore(sample.snapshot);let v=visibleState(e.state);assert.deepEqual(v,sample.snapshot);let c=await analyze(clients[2],v);
   assert.equal(c.report.value_model,'experimental-iid-one-step-frontier');
   const row={id:sample.id,snapshot:v,accepted:a,controlMs:b.ms,candidate:c};r.rows.push(row);
   r.changedTop1+=Number(JSON.stringify(a.action.policyIntent)!==JSON.stringify(c.action.policyIntent));
   r.published+=c.report._tailProbe.published;r.probeTransitions+=c.report._tailProbe.transitions;await save();
   if(c.action.action.kind==='hold'){commitHold(e,v,c.action);r.holds++;assert.equal(e.state.playing,true);v=visibleState(e.state);c=await analyze(clients[2],v);row.afterHold={snapshot:v,...c};}
   assert.equal(c.action.action.kind,'place');const proof=validatePlacement(v,c.action),frame=e.state.frame+23;
   row.proof=proof;await save();while(e.state.frame<frame)e.step();e.beginFrame([]);e.advanceSegment(.5);row.actual=commitPlacement(e,proof,frame);e.finishFrame();r.placements++;
  }
  r.complete=true;
 }catch(e){r.error={message:e.message,stack:e.stack,details:e.details};throw e;}
 finally{await save();for(const c of clients)await c.close();}
}else throw Error('audit | notify');
