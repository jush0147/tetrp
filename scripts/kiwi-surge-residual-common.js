import {VARIANT,candidateConfig} from './kiwi-surge-variant.js';
import assert from 'node:assert/strict';
import {verifyReuse,CONTROL} from './kiwi-wasted-reuse.js';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {openSync,writeSync,closeSync,createReadStream,createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {nativeClient} from './kiwi-native-client.js';
import initLegacy,{analyze_snapshot_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';
import {prepareKiwi,normalizeTopRecommendation,NODE_BUDGET} from '../src/analysis/kiwi.js';
import {match} from './kiwi-arena-core.js';
import {runMatchPool} from './kiwi-match-pool.js';
import {PLAN,settings,auditGame,summarize} from './kiwi-surge-residual-plan.js';
const root='.cache/surge-residual-common',read=async p=>JSON.parse(await readFile(p,'utf8'));
const json=(p,v)=>writeFile(p,JSON.stringify(v,null,2)),hash=b=>createHash('sha256').update(b).digest('hex');
const planHash=hash(JSON.stringify(PLAN));
async function identities(){
 const manifest=await read('.cache/surge-residual-build/manifest.json'),gate=await read('.cache/surge-residual-build/gate.json');
 assert.equal(gate.complete,true);assert.deepEqual(manifest,gate.manifest);assert.equal(manifest.candidate,'surge-residual');assert.deepEqual(manifest.variant,VARIANT);
 assert.equal(manifest.baselineNative,PLAN.native.accepted);assert.match(manifest.candidateNative,/^[a-f0-9]{64}$/);
 const on=await read('.cache/surge-residual-build/accepted-config.json'),off=await read('.cache/surge-residual-build/surge-residual-config.json');
 assert.equal(on.freestyle_weights.pending_safety,1);assert.equal(on.freestyle_weights.h9_cavity_excavation,-0.5);
 assert.deepEqual(on,(await read('docs/audits/cc2-alignment/ACTIVE_PARAMETERS_2026-09-28.json')).config);
 assert.equal(manifest.nativeRun,Number(process.env.GITHUB_RUN_ID));assert.equal(gate.sampleCount,20);assert.equal(gate.placements,20);assert.equal(gate.baselineReports,20);assert.ok((VARIANT.clearOff?gate.changedTop1:gate.chargedChangedTop1)>0);
 const expected=candidateConfig(on);assert.deepEqual(off,expected);
 for(const p of ['accepted','surge-residual'])assert.equal(hash(await readFile(`.cache/surge-residual-build/snapshot-${p}`)),p==='accepted'?PLAN.native.accepted:manifest.candidateNative);
 const legacy=await read('vendor/kiwi-v1/artifact-lock.json');
 assert.equal(legacy.productVersion,'kiwi-v1-snapshot-v3.2');assert.equal(legacy.defaultNodeBudget,PLAN.nodeBudget);
 for(const f of ['pkg/cold_clear_2.js','pkg/cold_clear_2_bg.wasm'])assert.equal(hash(await readFile('vendor/kiwi-v1/'+f)),legacy.files[f]);
 return {manifest,legacy,planHash};
}
if(process.argv[2]==='game'){
 const s=settings(Number(process.env.SURGE_RESIDUAL_BLOCK),Number(process.env.SURGE_RESIDUAL_LEG),Number(process.env.SURGE_RESIDUAL_ATTEMPT));
 const dir=`${root}/games/block-${s.block}/attempt-${s.attempt}/leg-${s.leg}`;await mkdir(dir,{recursive:true});
 const g={setting:s,planHash,commit:process.env.GITHUB_SHA,complete:false,nodeBudget:NODE_BUDGET,nativeHash:PLAN.native[s.policy],
  counts:{requests:[0,0],placements:[0,0],holds:[0,0],reanalyses:[0,0],terminalHolds:[0,0]},pendingSnapshots:[0,0]};
 const save=()=>json(`${dir}/result.json`,g);await save();let client;
 const files=['events','reports'].map(n=>openSync(`${dir}/${n}.jsonl`,'w'));
 const start=performance.now(),holdExpected=[null,null],queues=[[],[]];
 try{
  g.identities=await identities();g.nativeHash=s.policy==='accepted'?PLAN.native.accepted:g.identities.manifest.candidateNative;assert.equal(NODE_BUDGET,PLAN.nodeBudget);
  client=nativeClient(resolve(`.cache/surge-residual-build/snapshot-${s.policy}`));
  await initLegacy({module_or_path:await readFile('vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm')});
  const bots=[0,1].map(seat=>async snapshot=>{
   const p=prepareKiwi(snapshot);assert.equal(p.request.node_budget,PLAN.nodeBudget);
   const raw=JSON.stringify(p.request);
   const r=seat===s.seat?await client.request(raw):JSON.parse(analyze_snapshot_json(raw));
   assert.equal(r.bag_knowledge,'unknown');assert.equal(r.unknown_tail,'finite_visible');
   assert.equal(r.node_budget,PLAN.nodeBudget);assert.ok(r.nodes<=PLAN.nodeBudget);
   const action=normalizeTopRecommendation(snapshot,p,r);
   queues[seat].push({seat,snapshot,request:p.request,report:r,action});g.counts.requests[seat]++;
   g.pendingSnapshots[seat]+=Number([...snapshot.attack.pending,...snapshot.attack.are].some(p=>p.amt>0));return action;
  });
  const record=e=>{
   writeSync(files[0],JSON.stringify(e)+'\n');
   if(e.type==='decision'){
    const report=queues[e.seat].shift();assert.ok(report);assert.deepEqual(report.action,e.selected);
    writeSync(files[1],JSON.stringify(report)+'\n');assert.equal(e.snapshot.next.length,5);assert.equal(e.selected.candidateIndex,0);
    if(holdExpected[e.seat]){
     for(const f of ['current','hold','next','frame'])assert.deepEqual(e.snapshot[f],holdExpected[e.seat][f]);
     assert.equal(e.snapshot.hold.locked,true);assert.equal(e.selected.action.kind,'place');
     g.counts.reanalyses[e.seat]++;holdExpected[e.seat]=null;
    }
   }
   if(e.type==='parity'&&e.kind==='hold'){
    g.counts.holds[e.seat]++;holdExpected[e.seat]=e.actual;
    if(!e.actual.playing)g.counts.terminalHolds[e.seat]++;
   }
   if(e.type==='parity'&&e.kind==='placement')g.counts.placements[e.seat]++;
  };
  g.result=await match(bots,{seeds:[s.seed,s.seed],holeSeeds:[s.seed+1,s.seed+2],framesPerPiece:24,maxFrames:null,
   watchdogFrames:PLAN.watchdogFrames,parallelDecisions:true,record,
   onProgress:async p=>{g.progress=p;g.wallMs=performance.now()-start;await save();console.log(JSON.stringify({type:'progress',...s,...p,wallSeconds:g.wallMs/1000}));}});
  // Keep the full authority failure/mismatch dump before any gate throws.
  delete g.result.latencies;await save();g.complete=true;
  g.score=auditGame(g,s.block,s.leg,s.attempt);
 }catch(e){g.complete=false;g.error={message:e.message,stack:e.stack,details:e.details};throw e;}
 finally{
  g.wallMs=performance.now()-start;await save();for(const fd of files)closeSync(fd);if(client)await client.close();
  for(const n of ['events','reports']){const path=`${dir}/${n}.jsonl`;await pipeline(createReadStream(path),createGzip({level:1}),createWriteStream(path+'.gz'));await unlink(path);}
 }
}else if(process.argv[2]==='block'){
 const block=Number(process.env.SURGE_RESIDUAL_BLOCK);settings(block,0);const reused=await verifyReuse();await mkdir(`${root}/summaries`,{recursive:true});
 const b={block,planHash,commit:process.env.GITHUB_SHA,complete:false,attempts:[]};const save=()=>json(`${root}/summaries/block-${block}.json`,b);
 try{
  for(let attempt=0;attempt<PLAN.maxAttempts;attempt++){
   const legs=attempt===0?[2,3]:[0,1,2,3];
   const computed=await runMatchPool(legs,2,async leg=>{
    await new Promise((res,rej)=>{const child=spawn(process.execPath,['scripts/kiwi-surge-residual-common.js','game'],{
     env:{...process.env,SURGE_RESIDUAL_LEG:String(leg),SURGE_RESIDUAL_ATTEMPT:String(attempt)},stdio:'inherit',windowsHide:true});
     child.on('error',rej);child.on('exit',(code,signal)=>code===0?res():rej(Error(`block ${block} leg ${leg}: ${code}/${signal}`)));});
    return read(`${root}/games/block-${block}/attempt-${attempt}/leg-${leg}/result.json`);
   });
   const games=attempt===0?[...reused.blocks.find(b=>b.block===block).attempts[0].games.slice(0,2),...computed]:computed;
   b.attempts.push({attempt,games});await save();
   if(games.every((g,l)=>attempt===0&&l<2?g.score.scored:auditGame(g,block,l,attempt).scored)){b.attempt=attempt;b.complete=true;break;}
   console.log(JSON.stringify({type:'whole-block-simultaneous-KO-retry',block,attempt}));
  }
  assert.equal(b.complete,true,'simultaneous-KO retry limit reached');
 }catch(e){b.error={message:e.message,stack:e.stack};throw e;}finally{await save();}
}else if(process.argv[2]==='aggregate'){
 await mkdir(`${root}/aggregate`,{recursive:true});const r={plan:PLAN,planHash,complete:false,blocks:[],errors:[]};
 try{
  const expectedIdentity=await identities(),reused=await verifyReuse();
  for(let i=0;i<PLAN.blocks;i++){
   const b=await read(`.cache/surge-residual-common-downloads/surge-residual-common-summary-${i}/block-${i}.json`);
   assert.equal(b.block,i);assert.equal(b.planHash,planHash);assert.equal(b.commit,process.env.GITHUB_SHA);
   for(const a of b.attempts)for(const [l,g] of a.games.entries()){
    if(a.attempt===0&&l<2){assert.deepEqual(g,reused.blocks.find(x=>x.block===i).attempts[0].games[l]);}
    else {assert.equal(g.planHash,planHash);assert.equal(g.commit,process.env.GITHUB_SHA);assert.deepEqual(g.identities,expectedIdentity);}
   }
   r.blocks.push(b);
  }
  assert.equal(process.env.BLOCKS_STATUS,'success');r.statistics=summarize(r.blocks);r.complete=true;
 }catch(e){r.errors.push({message:e.message,stack:e.stack});process.exitCode=1;}
 await json(`${root}/aggregate/result.json`,r);
}else if(process.argv[2]==='notify'){
 let r;try{r=await read(`${root}/aggregate/result.json`);}catch{}
 const ok=process.env.AGGREGATE_STATUS==='success'&&r?.complete;
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const text=ok?`Reused accepted vs Legacy ${r.statistics.acceptedScore.join('-')}; ${VARIANT.name} vs Legacy ${r.statistics.candidateScore.join('-')}. Candidate-minus-accepted ${(r.statistics.candidateMinusAccepted*100).toFixed(1)}pp; paired approx 95% CI ${r.statistics.pairedApprox95CI.map(x=>(x*100).toFixed(1)).join(' to ')}pp. Correctness passed; no automatic promotion.`:'Evaluator reused-control batch incomplete or failed correctness. No strength verdict; no automatic retry.';
 if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,text+'\n'+url+'\n');
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Surge residual reused-control results ready':'Surge residual reused-control needs review',message:VARIANT.name+': '+text+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
 assert.ok(response.ok);assert.ok((await response.json()).id);
}else throw Error('game | block | aggregate | notify');
