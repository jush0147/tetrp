import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {openSync,writeSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {nativeClient} from './kiwi-native-client.js';
import {profile} from './kiwi-profiles.js';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
import {match} from './kiwi-arena-core.js';
import {shortPlan,compareScores,diagnosticOutcome} from './kiwi-h1-short-metrics.js';
const root='.cache/h1-short',read=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
if(process.argv[2]==='run'){
 const leg=Number(process.env.H1_SHORT_LEG);
 const {policy,swapped,seat,seed,frames}=shortPlan(leg);
 await mkdir(root,{recursive:true});
 const summary={leg,policy,swapped,seed,diagnosticOnly:true,promotionEligible:false,complete:false,
  requests:0,pendingSnapshots:0,changedTop1:0,changedCandidateScores:0,divergentBoundaries:0,
  nativeRequestStage:null,observations:[],witnesses:[]};
 const path=`${root}/leg-${leg}.json`,save=()=>writeFile(path,JSON.stringify(summary,null,2));
 const fd=openSync(`${root}/leg-${leg}-events.jsonl`,'w'),rf=openSync(`${root}/leg-${leg}-reports.jsonl`,'w');
 const clients=[];const begin=performance.now();
 try{
  const manifest=await read('.cache/h1-build/manifest.json'),gate=await read('.cache/h1-build/gate.json');
  assert.equal(gate.complete,true);assert.deepEqual(manifest,gate.manifest);
  assert.equal(manifest.nativeRun,37004950142);assert.equal(manifest.candidate,'h1-off');
  const candidateConfig=await read('.cache/h1-build/h1-off-config.json'),acceptedConfig=await read('.cache/h1-build/accepted-config.json');
  const expected=structuredClone(acceptedConfig);expected.freestyle_weights.pending_safety=0;
  assert.deepEqual(candidateConfig,expected);assert.equal(candidateConfig.freestyle_weights.h9_cavity_excavation,-0.5);
  for(const [name,h] of [['accepted',manifest.baselineNative],['h1-off',manifest.candidateNative]]){
   assert.equal(hash(await readFile(`.cache/h1-build/snapshot-${name}`)),h);
   clients.push(nativeClient(resolve(`.cache/h1-build/snapshot-${name}`)));
  }
  const legacyLock=await read('vendor/kiwi-v1/artifact-lock.json');
  for(const f of ['pkg/cold_clear_2.js','pkg/cold_clear_2_bg.wasm'])assert.equal(hash(await readFile('vendor/kiwi-v1/'+f)),legacyLock.files[f]);
  const legacy=await profile('legacy');summary.identities={manifest,legacy:legacy.version};
  const observe=async snapshot=>{
   summary.nativeRequestStage={stage:'prepare',frame:snapshot.frame,request:summary.requests+1};await save();
   const prepared=prepareKiwi(snapshot);assert.equal(prepared.request.node_budget,200000);
   summary.nativeRequestStage.stage='native-search';await save();const t=performance.now();
   const reports=await Promise.all(clients.map(c=>c.request(JSON.stringify(prepared.request))));
   const ms=performance.now()-t;summary.nativeRequestStage.stage='normalize';await save();
   const actions=reports.map(r=>{
    assert.equal(r.bag_knowledge,'unknown');assert.equal(r.unknown_tail,'finite_visible');
    assert.equal(r.node_budget,200000);assert.ok(r.nodes<=200000);
    return normalizeTopRecommendation(snapshot,prepared,r);
   });
   const pending=[...snapshot.attack.pending,...snapshot.attack.are].reduce((n,p)=>n+p.amt,0);
   const changedTop1=!same(actions[0].policyIntent,actions[1].policyIntent);
   const {candidateSetChanged,changedScores}=compareScores(...reports);
   summary.requests++;summary.pendingSnapshots+=Number(pending>0);summary.changedTop1+=Number(changedTop1);summary.changedCandidateScores+=Number(changedScores>0);
   const observation={request:summary.requests,frame:snapshot.frame,pieces:snapshot.piecesPlaced,pending,changedTop1,changedScores,candidateSetChanged,ms};summary.observations.push(observation);
   const row={...observation,snapshot,requestInput:prepared.request,on:{report:reports[0],action:actions[0]},off:{report:reports[1],action:actions[1]}};
   writeSync(rf,JSON.stringify(row)+'\n');
   // At most two actual search-state activation probes per leg, never drive policy.
   if(pending>0&&summary.witnesses.length===0||changedTop1&&!summary.witnesses.some(w=>w.changedTop1)){
    if(summary.witnesses.length<2)summary.witnesses.push(row);
   }
   summary.nativeRequestStage=null;await save();return actions[policy==='accepted'?0:1];
  };
  const bots=swapped?[legacy.decide,observe]:[observe,legacy.decide];
  const result=await match(bots,{seeds:[seed,seed],holeSeeds:[seed+1,seed+2],framesPerPiece:24,maxFrames:frames,watchdogFrames:360000,
   parallelDecisions:true,
   onBoundary:({states})=>{if(!same(states[0].board,states[1].board)||!same(states[0].piece,states[1].piece)||!same(states[0].hold,states[1].hold))summary.divergentBoundaries++;},
   onProgress:async p=>{summary.progress=p;await save();console.log(JSON.stringify({type:'progress',leg,policy,...p,requests:summary.requests,pendingSnapshots:summary.pendingSnapshots,changedTop1:summary.changedTop1,wallSeconds:(performance.now()-begin)/1000}));},
   record:e=>writeSync(fd,JSON.stringify(e)+'\n')});
  summary.result=result;summary.testedSeat=seat;
  assert.ok(result.failures.every(f=>f===null));assert.ok(result.parity.every(p=>p.mismatches===0));
  assert.ok(result.transportStats.every(t=>t.fallbackRequests===0&&t.rejectedCandidates===0&&t.maxSelectedRank===0));
  assert.ok(['topout','frame-cap'].includes(result.reason));assert.ok(result.pieces.every(p=>p<=100));
  summary.outcome=diagnosticOutcome(result);
  summary.complete=true;
 }catch(e){summary.error={message:e.message,stack:e.stack,details:e.details};throw e;}
 finally{summary.wallMs=performance.now()-begin;await save();closeSync(fd);closeSync(rf);for(const c of clients)await c.close();}
}else if(process.argv[2]==='aggregate'){
 await mkdir(root,{recursive:true});const result={complete:false,diagnosticOnly:true,legs:[],errors:[]};
 try{
  assert.equal(process.env.SHORT_STATUS,'success');
  for(let leg=0;leg<4;leg++){const r=await read(`.cache/h1-short-downloads/kiwi-h1-short-${leg}/leg-${leg}.json`);assert.equal(r.complete,true);assert.equal(r.leg,leg);result.legs.push(r);}
  result.complete=true;
 }catch(e){result.errors.push(e.message);process.exitCode=1;}
 await writeFile(`${root}/result.json`,JSON.stringify(result,null,2));
 const witnesses=result.legs.flatMap(l=>l.witnesses.map((w,i)=>({id:`leg${l.leg}/witness${i}`,...w})));
 await writeFile(`${root}/witnesses.json`,JSON.stringify(witnesses));
}else if(process.argv[2]==='notify'){
 let r;try{r=await read(`${root}/result.json`);}catch{}
 const ok=process.env.DIAGNOSTIC_STATUS==='success'&&r?.complete;
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=ok?r.legs.map(l=>`${l.policy}/seat${l.testedSeat}: ${l.result.pieces[l.testedSeat]} pieces, pending ${l.pendingSnapshots}/${l.requests}, changed top1 ${l.changedTop1}, changed scores ${l.changedCandidateScores}`).join('\n'):'H1 versus Legacy short diagnostic incomplete. Inspect artifacts; no strength verdict.';
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'H1 short diagnostic complete':'H1 short diagnostic needs review',message:message+'\nNo strength verdict or automatic 200-game run.\n'+url,click:url}),signal:AbortSignal.timeout(15000)});assert.ok(response.ok);assert.ok((await response.json()).id);
}else throw Error('run | aggregate | notify');
