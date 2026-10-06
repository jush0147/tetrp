import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {nativeClient} from './kiwi-native-client.js';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine,validatePlacement,commitPlacement,commitHold} from '../src/analysis/placement-authority.js';
const root='.cache/residual-value-results',read=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
async function samples(){
 const raw=await readFile('docs/audits/cc2-alignment/perf-snapshots.json');
 assert.equal(hash(raw),'348c09730248410adb8b2e4dd96749afe809c21187bfd82399c6c9379be17261');
 const rows=[...JSON.parse(raw),...(await read('docs/audits/cc2-alignment/SURGE_PUBLIC_INPUTS.json')).samples];
 assert.equal(rows.length,20);for(const r of rows)if(r.snapshotHash)assert.equal(hash(JSON.stringify(r.snapshot)),r.snapshotHash);
 return rows;
}
function restore(v){const e=new PlacementArenaEngine({rules:v.rules}),s=e.state;s.board=structuredClone(v.board);s.piece=structuredClone(v.current);s.hold=structuredClone(v.hold);s.bag.queue=[...v.next,'i','o','t','s','z','j','l'];s.frame=v.frame;s.subframe=v.subframe;s.stats.pieces=v.piecesPlaced;Object.assign(s.attack,structuredClone(v.attack));s.attack.pieces=v.piecesPlaced;s.garbageLockedUntil=v.garbageLockedUntil;return e;}
if(process.argv[2]==='prepare'){
 await mkdir(root,{recursive:true});await writeFile(`${root}/inputs.json`,JSON.stringify((await samples()).map(s=>({id:s.id,request:prepareKiwi(s.snapshot).request}))));
}else if(process.argv[2]==='notify'){
 let r;try{r=await read(`${root}/summary.json`);}catch{}
 const ok=process.env.AUDIT_JOB_STATUS==='success'&&r?.complete;
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=ok?`Residual value offline gate complete. Top-1 changed ${r.changedTop1}/20; cost gate ${r.costGate}; activation ${r.witnesses} witnesses. No arena or promotion.`:'Residual value offline gate failed/incomplete. Inspect artifact; no arena.';
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:'Kiwi residual value preflight',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});assert.ok(response.ok);assert.ok((await response.json()).id);
}else if(process.argv[2]==='audit'){
 const r={sourceSha:process.env.GITHUB_SHA,complete:false,changedTop1:0,witnesses:0,placements:0,holds:0,rows:[],measurements:[]};
 const save=()=>writeFile(`${root}/summary.json`,JSON.stringify(r,null,2));
 const clients={};
 async function run(kind,v){
  const t=performance.now(),p=prepareKiwi(v),report=await clients[kind].request(JSON.stringify(p.request));
  assert.equal(report.node_budget,200000);assert.ok(report.nodes>0&&report.nodes<=200000);
  assert.equal(report.bag_knowledge,'unknown');assert.equal(report.unknown_tail,'finite_visible');
  const action=normalizeTopRecommendation(v,p,report);assert.equal(action.candidateIndex,0);
  const proof=action.action.kind==='place'?validatePlacement(v,action):null;
  return {report,action,proof,ms:performance.now()-t};
 }
 try{
  assert.equal(hash(await readFile('.cache/native-artifact/snapshot-accepted')),'386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb');
  for(const [k,p] of Object.entries({accepted:'.cache/native-artifact/snapshot-accepted',off:`${root}/snapshot-off`,on:`${root}/snapshot-on`}))clients[k]=nativeClient(resolve(p));
  const trace=await read(`${root}/trace.json`),rows=await samples();assert.equal(trace.length,20);
  for(const [i,s] of rows.entries()){
   const a=await run('accepted',s.snapshot),off=await run('off',s.snapshot),on=await run('on',s.snapshot);
   r.rows.push({id:s.id,snapshot:s.snapshot,accepted:a,off,on,trace:trace[i]});await save();
   assert.deepEqual(off.report,a.report,'off changed accepted report');
   assert.equal(trace[i].id,s.id);assert.deepEqual(trace[i].report,on.report,'trace altered candidate search');
   r.changedTop1+=Number(JSON.stringify(a.action.policyIntent)!==JSON.stringify(on.action.policyIntent));
   for(const w of trace[i].witnesses){
    assert.ok(w.delay>=1&&w.discount>0&&w.discount<=1&&w.asset>0);
    const d=w.reserve==='T'?1:(w.supply[0]||w.supply[1]+7);
    assert.equal(w.delay,d);
    const g=1/(d*(1+w.due/Math.max(1,20-w.height)));
    assert.ok(Math.abs(g-w.discount)<1e-6);
    assert.ok(Math.abs(Math.max(0,w.slotBonus+w.after-w.base)-w.asset)<.0002);
    assert.ok(Math.abs(w.base+g*w.asset-w.value)<.0002);r.witnesses++;
   }
   const e=restore(s.snapshot);assert.deepEqual(visibleState(e.state),s.snapshot);
   // Hidden suffix changes must not alter the request before revelation.
   e.state.bag.queue.splice(5,7,'z','z','z','z','z','z','z');
   assert.deepEqual(prepareKiwi(visibleState(e.state)).request,prepareKiwi(s.snapshot).request);
   e.state.bag.queue=[...s.snapshot.next,'i','o','t','s','z','j','l'];
   let decision=on,v=s.snapshot;const parity={};r.rows[i].parity=parity;
   if(decision.action.action.kind==='hold'){
    parity.hold=commitHold(e,v,decision.action);r.holds++;assert.equal(e.state.playing,true);
    v=visibleState(e.state);decision=await run('on',v);parity.afterHold={snapshot:v,...decision};
   }
   assert.equal(decision.action.action.kind,'place');const proof=validatePlacement(v,decision.action),frame=e.state.frame+23;
   parity.proof=proof;await save();while(e.state.frame<frame)e.step();e.beginFrame([]);e.advanceSegment(.5);
   parity.actual=commitPlacement(e,proof,frame);e.finishFrame();r.placements++;await save();
  }
  for(let pass=0;pass<3;pass++)for(const [i,s] of rows.entries()){
   const m={pass,id:s.id};
   for(const kind of (pass+i)%2?['on','off']:['off','on']){
    const result=await run(kind,s.snapshot);assert.deepEqual(result.report,r.rows[i][kind].report,'nondeterministic report');m[kind]=result.ms;
   }
   r.measurements.push(m);await save();
  }
  const stats=kind=>{const a=r.measurements.map(m=>m[kind]).sort((a,b)=>a-b);return {total:a.reduce((n,x)=>n+x,0),median:(a[29]+a[30])/2,p95:a[Math.ceil(a.length*.95)-1]};};
  r.cost={off:stats('off'),on:stats('on')};r.costGate=['total','median','p95'].every(k=>r.cost.on[k]<=r.cost.off[k])?'passed':'not met';
  r.activationGate=r.witnesses>0&&r.changedTop1>0?'passed':'not met';
  r.complete=true;r.scope='20 offline public snapshots; Linux complete-request latency including prepare, normalize and placement certificate; no cold start. No browser evidence or KO claim. Cost or activation gate miss stops this candidate.';
 }catch(e){r.error={message:e.message,stack:e.stack,details:e.details};throw e;}
 finally{await save();for(const c of Object.values(clients))await c.close();}
 console.log(JSON.stringify({complete:r.complete,changedTop1:r.changedTop1,cost:r.cost,costGate:r.costGate,activationGate:r.activationGate,placements:r.placements,holds:r.holds}));
}else throw Error('prepare | audit | notify');
