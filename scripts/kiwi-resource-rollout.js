// Offline public-only continuation pilot. Private synthetic environment never goes to policy.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {PlacementArenaEngine,validatePlacement,commitPlacement,commitHold} from '../src/analysis/placement-authority.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {pack,features} from '../src/analysis/native/board.js';
import {profile} from './kiwi-profiles.js';
export const PROTOCOL={slots:8,cadence:24,seeds:[41001,41002],continuations:['legacy','native-one'],futureIncoming:'none',tail:'IID uniform; no bag inference'};
export function syntheticTail(seed,count=64){
  let x=seed;return Array.from({length:count},()=>{x=x*16807%2147483647;return 'zlosijt'[Math.floor((x-1)/2147483646*7)];});
}
export function environment(snapshot,seed){
  assert.equal(snapshot.next.length,5);assert.equal(snapshot.attack.pending.length,0);assert.equal(snapshot.attack.are.length,0);
  assert.equal(snapshot.subframe,0);assert.equal(snapshot.playing,true);
  const e=new PlacementArenaEngine({rules:snapshot.rules}),s=e.state;
  s.board=structuredClone(snapshot.board);s.piece=structuredClone(snapshot.current);s.hold=structuredClone(snapshot.hold);
  s.bag.queue=[...snapshot.next,...syntheticTail(seed)];
  // Guard against accidentally exhausting the synthetic stream and using Engine bag RNG.
  Object.defineProperty(s.bag,'rng',{get(){throw new Error('Synthetic stream exhausted');}});
  s.frame=snapshot.frame;s.subframe=0;s.stats.pieces=snapshot.piecesPlaced;
  Object.assign(s.attack,structuredClone(snapshot.attack));s.attack.pieces=snapshot.piecesPlaced;
  s.lastClear=s.attack.combo>0;s.garbageLockedUntil=snapshot.garbageLockedUntil;
  assert.deepEqual(visibleState(s),snapshot);return e;
}
export const actionKey=a=>a.action.kind==='hold'?'hold':JSON.stringify([a.move.piece,a.execution.spin,a.move.cells.map(c=>c.join(',')).sort()]);
const top=r=>r?.candidates?r.candidates[Symbol.iterator]().next().value:r;
export async function rollout(snapshot,root,decide,seed,{slots=PROTOCOL.slots}={}){
  assert.ok(Number.isInteger(slots)&&slots>=1&&slots<=8);
  const e=environment(snapshot,seed),s=e.state,trace=[],started=performance.now();
  let placements=0,holds=0,requests=0,firstAttackSlot=null,currentRequest=null,proof=null;
  try{
    for(let slot=0;slot<slots&&s.playing;slot++){
      const slotFrame=s.frame;
      for(let attempt=0;attempt<2;attempt++){
        const pub=visibleState(s);assert.equal(pub.next.length,5);requests++;
        const start=performance.now();
        const action=structuredClone(slot===0&&attempt===0?root:top(await decide(structuredClone(pub))));
        currentRequest={slot,attempt,snapshot:pub,action,ms:performance.now()-start};trace.push(currentRequest);
        if(action.candidateIndex!==undefined)assert.equal(action.candidateIndex,0);
        if(action.action.kind==='hold'){
          assert.equal(attempt,0,'Repeated Hold');currentRequest.actual=commitHold(e,pub,action);holds++;
          if(!s.playing)break;continue;
        }
        assert.equal(action.action.kind,'place');proof=validatePlacement(pub,action);
        const before={...s.attack.totals},lockFrame=slotFrame+23;
        while(s.frame<lockFrame)e.step();e.beginFrame([]);e.advanceSegment(.5);
        currentRequest.actual=commitPlacement(e,proof,lockFrame);e.finishFrame();placements++;
        currentRequest.transaction=Object.fromEntries(['generated','cancelled','sent','tanked'].map(k=>[k,s.attack.totals[k]-before[k]]));
        if(currentRequest.transaction.generated>0&&firstAttackSlot===null)firstAttackSlot=slot+1;
        currentRequest.after=visibleState(s);break;
      }
      assert.ok(requests<=2*(slot+1));
    }
  }catch(error){error.details={request:currentRequest,proof,actual:visibleState(s),trace};throw error;}
  const f=features(pack(s.board),0);
  return {seed,slots,placements,holds,requests,alive:s.playing,death:s.reason,firstAttackSlot,
    totals:structuredClone(s.attack.totals),end:visibleState(s),endFeatures:f,ms:performance.now()-started,
    parity:{placements,holds,mismatches:0},trace};
}
export function dominates(a,b){
  assert.equal(a.length,b.length);let strict=false;
  for(let i=0;i<a.length;i++){
    assert.equal(a[i].seed,b[i].seed);assert.equal(a[i].slots,b[i].slots);
    const pairs=[[a[i].placements,b[i].placements],[+a[i].alive,+b[i].alive],
      [a[i].totals.generated,b[i].totals.generated],[a[i].totals.sent,b[i].totals.sent]];
    if(a[i].alive&&b[i].alive)pairs.push([-a[i].endFeatures.maxHeight,-b[i].endFeatures.maxHeight],[-a[i].endFeatures.coveredEmpty,-b[i].endFeatures.coveredEmpty]);
    for(const [x,y] of pairs){if(x<y)return false;if(x>y)strict=true;}
  }
  return strict;
}
export function summarize(records,inputs){
  assert.equal(records.length,inputs.length*8);let placements=0,holds=0;
  for(const r of records){assert.equal(r.result.parity.mismatches,0);placements+=r.result.parity.placements;holds+=r.result.parity.holds;}
  const cases=inputs.map(input=>{
    const policies=PROTOCOL.continuations.map(policy=>{
      const pair=['native','legacy'].map(root=>PROTOCOL.seeds.map(seed=>{
        const match=records.filter(r=>r.id===input.id&&r.policy===policy&&r.root===root&&r.seed===seed);assert.equal(match.length,1);return match[0].result;
      }));
      const preference=dominates(pair[0],pair[1])?'native':dominates(pair[1],pair[0])?'legacy':'incomparable-or-equal';
      return {policy,preference,roots:pair.map(xs=>xs.map(r=>({seed:r.seed,alive:r.alive,placements:r.placements,
        generated:r.totals.generated,sent:r.totals.sent,firstAttackSlot:r.firstAttackSlot,endFeatures:r.endFeatures,ms:r.ms})))};
    });
    return {id:input.id,group:input.group,sameRoot:actionKey(input.roots.native)===actionKey(input.roots.legacy),policies};
  });
  const f48=cases.find(c=>c.id==='g1-f48');
  const gates={correctness:true,f48LegacyBoth:f48.policies.every(p=>p.preference==='legacy'),
    validationAgreement:cases.filter(c=>c.group==='validation'&&!c.sameRoot&&c.policies[0].preference!=='incomparable-or-equal'&&c.policies[0].preference===c.policies[1].preference).length>=2};
  return {complete:true,proceedToDesign:Object.values(gates).every(Boolean),gates,parity:{placements,holds,mismatches:0},cases};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const directory=process.argv[2]??'.cache/resource-rollout';await mkdir(directory,{recursive:true});
  const inputs=JSON.parse(await readFile('docs/audits/kiwi-resource-rollout/inputs.json','utf8'));
  const policies={legacy:await profile('legacy'), 'native-one':await profile('native',{horizon:1,geometryBudget:100000})};
  const files=['scripts/kiwi-resource-rollout.js','scripts/kiwi-profiles.js','src/analysis/placement-authority.js','src/engine.js','src/attack.js','src/analysis/native/search.js','docs/audits/kiwi-resource-rollout/inputs.json'];
  const sourceHashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
  const manifest={git:process.env.GITHUB_SHA??null,protocol:PROTOCOL,sourceHashes,started:new Date().toISOString(),profiles:Object.fromEntries(Object.entries(policies).map(([k,p])=>[k,{version:p.version,config:p.config}]))};
  await writeFile(`${directory}/manifest.json`,JSON.stringify(manifest,null,2));const records=[];
  try{
    for(const input of inputs)for(const policy of PROTOCOL.continuations)for(const seed of PROTOCOL.seeds)for(const root of ['native','legacy']){
      const result=await rollout(input.snapshot,input.roots[root],policies[policy].decide,seed);
      const record={id:input.id,policy,seed,root,result};records.push(record);
      await writeFile(`${directory}/${input.id}-${policy}-${seed}-${root}.json`,JSON.stringify(record));
      console.log(JSON.stringify({id:input.id,policy,seed,root,alive:result.alive,generated:result.totals.generated,sent:result.totals.sent,placements:result.placements}));
    }
    const summary=summarize(records,inputs);await writeFile(`${directory}/result.json`,JSON.stringify(summary,null,2));
    console.log(JSON.stringify({complete:true,proceedToDesign:summary.proceedToDesign,gates:summary.gates,parity:summary.parity}));
  }catch(error){await writeFile(`${directory}/result.json`,JSON.stringify({complete:false,error:error.stack,details:error.details,completedTrajectories:records.length},null,2));throw error;}
}
