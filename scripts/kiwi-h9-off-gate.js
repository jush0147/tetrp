import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {nativeClient} from './kiwi-native-client.js';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine,validatePlacement,commitPlacement,commitHold} from '../src/analysis/placement-authority.js';
const root='.cache/h9-build',read=async p=>JSON.parse(await readFile(p,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
if(process.argv[2]==='notify-failure'){
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const r=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:'Kiwi H9-off gate failed',message:'Candidate correctness/build gate failed. The 200-game batch did not start.\n'+url,click:url}),signal:AbortSignal.timeout(15000)});assert.ok(r.ok);assert.ok((await r.json()).id);
}else if(process.argv[2]==='gate'){
 await mkdir(root,{recursive:true});const summary={complete:false,checks:[],holds:0,placements:0,baselineReports:0,explicitHoldModes:[]};
 const save=()=>writeFile(`${root}/gate.json`,JSON.stringify(summary,null,2));await save();
 const clients=[];
 try{
  const plan=await read('docs/audits/cc2-alignment/H9_OFF_200.json');
  const original=(await read('docs/audits/cc2-alignment/ACTIVE_PARAMETERS_2026-09-28.json')).config;
  const accepted=await read(`${root}/accepted-config.json`),candidate=await read(`${root}/h9-off-config.json`);
  assert.deepEqual(accepted,original,'Rebuilt control configuration drift');
  const expected=structuredClone(accepted);assert.equal(expected.freestyle_weights.h9_cavity_excavation,-0.5);expected.freestyle_weights.h9_cavity_excavation=0;
  assert.deepEqual(candidate,expected,'More than one coefficient changed');summary.checks.push('exact config diff: H9 only');
  assert.equal(sha(await readFile('.cache/native-artifact/snapshot-accepted')),plan.baselineNative);
  const frozen=nativeClient(resolve('.cache/native-artifact/snapshot-accepted'));
  const rebuilt=nativeClient(resolve(root,'snapshot-control'));
  const changed=nativeClient(resolve(root,'snapshot-h9-off'));clients.push(frozen,rebuilt,changed);
  const samples=await read('docs/audits/cc2-alignment/perf-snapshots.json');
  function restore(v){
   const e=new PlacementArenaEngine({rules:v.rules}),s=e.state;
   s.board=structuredClone(v.board);s.piece=structuredClone(v.current);s.hold=structuredClone(v.hold);
   // Synthetic unrevealed suffix belongs only to the referee. No replay futures.
   s.bag.queue=[...v.next,'i','o','t','s','z','j','l'];s.frame=v.frame;s.subframe=v.subframe;
   s.stats.pieces=v.piecesPlaced;Object.assign(s.attack,structuredClone(v.attack));s.attack.pieces=v.piecesPlaced;
   s.garbageLockedUntil=v.garbageLockedUntil;return e;
  }
  async function analyze(client,v){
   const p=prepareKiwi(v),report=await client.request(JSON.stringify(p.request));
   assert.equal(v.next.length,5);assert.equal(report.bag_knowledge,'unknown');assert.equal(report.unknown_tail,'finite_visible');
   assert.equal(report.node_budget,200000);assert.ok(report.nodes>0&&report.nodes<=200000);
   const action=normalizeTopRecommendation(v,p,report);assert.equal(action.candidateIndex,0);return {report,action};
  }
  const records=[];
  for(const sample of samples){
   const a=await analyze(frozen,sample.snapshot),b=await analyze(rebuilt,sample.snapshot);
   assert.deepEqual(b,a,'Rebuilt default differs from frozen accepted');summary.baselineReports++;
   const e=restore(sample.snapshot);let v=visibleState(e.state);assert.deepEqual(v,sample.snapshot);
   summary.active={id:sample.id,snapshot:v};await save();let c=await analyze(changed,v);
   summary.active.action=c.action;await save();
   records.push({id:sample.id,snapshot:v,...c});
   if(c.action.action.kind==='hold'){
    commitHold(e,v,c.action);summary.holds++;assert.equal(e.state.playing,true);
    v=visibleState(e.state);assert.equal(v.hold.locked,true);c=await analyze(changed,v);
    records.push({id:sample.id+'/after-hold',snapshot:v,...c});
   }
   summary.active={id:sample.id,snapshot:v,action:c.action};await save();
   assert.equal(c.action.action.kind,'place');const proof=validatePlacement(v,c.action),lockFrame=e.state.frame+23;
   summary.active.proof=proof;await save();
   while(e.state.frame<lockFrame)e.step();e.beginFrame([]);e.advanceSegment(.5);
   const actual=commitPlacement(e,proof,lockFrame);summary.placements++;e.finishFrame();
   records.at(-1).validated=proof;records.at(-1).actual=actual;
   await writeFile(`${root}/gate-reports.json`,JSON.stringify(records));await save();
  }
  // Explicit legal Hold transitions cover both modes even if policy elects no Hold.
  for(const hold of [null,'o']){
   const e=new PlacementArenaEngine();e.spawn('t');e.state.hold={piece:hold,locked:false};e.state.bag.queue=['i','j','l','s','z','o'];
   const v=visibleState(e.state),mode=hold===null?'empty':'occupied';
   commitHold(e,v,{action:{kind:'hold',mode,requiresReanalysis:true,samePiece:false}});
   const next=visibleState(e.state),c=await analyze(changed,next);assert.equal(c.action.action.kind,'place');
   validatePlacement(next,c.action);summary.explicitHoldModes.push(mode);
  }
  await copyFile('.cache/native-artifact/snapshot-accepted',`${root}/snapshot-accepted`);
  const manifest={...plan,candidateNative:sha(await readFile(`${root}/snapshot-h9-off`)),nativeRun:Number(process.env.GITHUB_RUN_ID)};
  await writeFile(`${root}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
  summary.manifest=manifest;summary.checks.push('frozen accepted report parity','candidate top-1 authority lock parity','Hold and reanalysis','Rust same-state Eval/Reward delta');summary.complete=true;await save();
 }catch(e){summary.error={message:e.message,stack:e.stack,details:e.details};await save();throw e;}finally{for(const c of clients)await c.close();}
}else throw Error('gate | notify-failure');
