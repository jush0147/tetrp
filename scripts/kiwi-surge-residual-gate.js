import {VARIANT,candidateConfig} from './kiwi-surge-variant.js';
import assert from 'node:assert/strict';
import {compareScores} from './kiwi-h1-short-metrics.js';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {nativeClient} from './kiwi-native-client.js';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine,validatePlacement,commitPlacement,commitHold} from '../src/analysis/placement-authority.js';
const root='.cache/surge-residual-build',read=async p=>JSON.parse(await readFile(p,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
if(process.argv[2]==='notify'){
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 let g;try{g=await read(`${root}/gate.json`);}catch{}
 const message='Evaluator build/correctness/activation gate incomplete. No arena launched.';
 const r=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:'Kiwi evaluator gate result',message:VARIANT.name+': '+message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});assert.ok(r.ok);assert.ok((await r.json()).id);
}else if(process.argv[2]==='gate'){
 await mkdir(root,{recursive:true});const summary={complete:false,checks:[],holds:0,placements:0,baselineReports:0,explicitHoldModes:[],changedScores:0,changedTop1:0};
 const save=()=>writeFile(`${root}/gate.json`,JSON.stringify(summary,null,2));await save();
 const clients=[];
 try{
  const plan={variant:VARIANT,candidate:'surge-residual',baselineNative:'386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb'};
  const activation=await read('docs/audits/cc2-alignment/SURGE_PUBLIC_INPUTS.json');
  summary.activationSourceRun=activation.run;
  const original=(await read('docs/audits/cc2-alignment/ACTIVE_PARAMETERS_2026-09-28.json')).config;
  const accepted=await read(`${root}/accepted-config.json`),candidate=await read(`${root}/surge-residual-config.json`);
  assert.deepEqual(accepted,original,'Rebuilt control configuration drift');
  const expected=candidateConfig(accepted);
  assert.deepEqual(candidate,expected,'Configuration differs from fixed variant');assert.equal(candidate.freestyle_weights.h9_cavity_excavation,-0.5,'H9 must stay enabled');summary.checks.push('exact config diff: '+VARIANT.name);
  assert.equal(sha(await readFile('.cache/native-artifact/snapshot-accepted')),plan.baselineNative);
  const frozen=nativeClient(resolve('.cache/native-artifact/snapshot-accepted'));
  const rebuilt=nativeClient(resolve(root,'snapshot-control'));
  const changed=nativeClient(resolve(root,'snapshot-surge-residual'));clients.push(frozen,rebuilt,changed);
  const samples=[...await read('docs/audits/cc2-alignment/perf-snapshots.json'),...activation.samples];
  for(const sample of activation.samples)assert.equal(sha(JSON.stringify(sample.snapshot)),sample.snapshotHash);
  summary.sampleCount=samples.length;summary.chargedChangedTop1=0;summary.rootB2BHistogram={};for(const s of samples){const raw=s.snapshot.attack.btb;summary.rootB2BHistogram[raw]=(summary.rootB2BHistogram[raw]??0)+1;}
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
   summary.changedScores+=Number(compareScores(a.report,c.report).changedScores>0);
   const different=JSON.stringify(a.action.policyIntent)!==JSON.stringify(c.action.policyIntent);
   summary.changedTop1+=Number(different);summary.chargedChangedTop1+=Number(different&&v.attack.btb>v.rules.b2bcharge_at);
   records.push({id:sample.id,snapshot:v,accepted:a,...c});
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
  assert.ok(summary.changedScores>0,'No real search score activation');
  assert.ok((VARIANT.clearOff?summary.changedTop1:summary.chargedChangedTop1)>0,'No required top-1 activation; do not dispatch arena');
  await copyFile('.cache/native-artifact/snapshot-accepted',`${root}/snapshot-accepted`);
  const manifest={...plan,candidateNative:sha(await readFile(`${root}/snapshot-surge-residual`)),nativeRun:Number(process.env.GITHUB_RUN_ID)};
  await writeFile(`${root}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
  summary.manifest=manifest;summary.checks.push('frozen accepted report parity','candidate top-1 authority lock parity','Hold and reanalysis',VARIANT.clearOff?'Rust same-state clear-only Reward delta':'Rust same-state leaf-only delta');summary.complete=true;await save();
 }catch(e){summary.error={message:e.message,stack:e.stack,details:e.details};await save();throw e;}finally{for(const c of clients)await c.close();}
}else throw Error('gate | notify');
