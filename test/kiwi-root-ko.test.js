import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {match} from '../scripts/kiwi-arena-core.js';
import {profile} from '../scripts/kiwi-profiles.js';
import {branchCheckpoint,playRoot,normalized,summarizeCase,batchProtocol,KO_BATCHES} from '../scripts/kiwi-root-ko.js';
import {experimentStatus} from '../scripts/kiwi-root-ko-status.js';
import {visibleState} from '../src/analysis/visible-state.js';
const inputs=JSON.parse(readFileSync(new URL('../docs/audits/kiwi-root-ko/inputs.json',import.meta.url)));
test('boundary resume preserves uninterrupted gameplay with existing authority',async()=>{
  const p=await profile('native',{horizon:1}),bot=p.decide;let checkpoint;
  const uninterrupted=await match([bot,bot],{maxFrames:96,onBoundary:c=>{if(c.frame===24)checkpoint=c;}});
  assert.ok(checkpoint);const resumed=await match([bot,bot],{maxFrames:72,startCheckpoint:checkpoint});
  for(const k of ['winner','reason','frames','pieces','totals','ko','deathReasons'])assert.deepEqual(resumed[k],uninterrupted[k]);
  assert.equal(resumed.startFrame,24);assert.deepEqual(resumed.parity.map(p=>p.placements),[3,3]);
  const invalid=structuredClone(checkpoint);invalid.states[0].frame++;
  await assert.rejects(match([bot,bot],{startCheckpoint:invalid,maxFrames:24}),/boundary/);
});
test('synthetic future replacement and mirroring preserve all initial public information',()=>{
  for(const input of inputs){
    const a=branchCheckpoint(input,51001),b=branchCheckpoint(input,51002),mirror=branchCheckpoint(input,51001,true);
    assert.deepEqual(a.states.map(visibleState),input.public);assert.deepEqual(b.states.map(visibleState),input.public);
    assert.deepEqual(mirror.states,[...a.states].reverse());
    assert.notDeepEqual(a.states[0].bag.queue.slice(5),b.states[0].bag.queue.slice(5));
    assert.notDeepEqual(a.states[0].holes,b.states[0].holes);
    assert.equal(input.checkpoint.states[0].bag.queue.length,5);
  }
});
test('both frozen roots execute with strict parity from all three checkpoints and mirror identically',async()=>{
  const p=await profile('native',{horizon:1});
  const decide=s=>{assert.equal(s.next.length,5);for(const k of ['bag','holes','checkpoint','opponent','history'])assert.equal(k in s,false);return p.decide(s);};
  for(const input of inputs)for(const root of ['A','B']){
    const normal=await playRoot(input,{seed:51001,root,decide,maxFrames:48});
    const mirror=await playRoot(input,{seed:51001,root,decide,mirrored:true,maxFrames:48});
    assert.ok(normal.game.failures.every(x=>!x));assert.ok(mirror.game.failures.every(x=>!x));
    assert.deepEqual(normalized(normal),normalized(mirror));
    for(const g of [normal.game,mirror.game])for(const p of g.parity)assert.equal(p.mismatches,0);
  }
});
test('paired summary counts independent futures once, excludes double KO, and rejects mirror mismatch',()=>{
  const records=[];
  for(const seed of [51001,51002])for(const mirrored of [false,true])for(const root of ['A','B']){
    const focal=mirrored?1:0,winner=seed===51002?null:root==='A'?focal:1-focal;
    records.push({seed,mirrored,root,focal,game:{reason:'topout',winner,frames:240,startFrame:48,
      ko:[0,1].map(i=>winner===null||i!==winner),deathReasons:[0,1].map(i=>winner===null||i!==winner?'topout':null),
      pieces:[10,10],totals:[{},{}],failures:[null,null],
      parity:[0,1].map(()=>({placements:8,holds:0,mismatches:0})),
      transportStats:[0,1].map(()=>({fallbackRequests:0,rejectedCandidates:0,maxSelectedRank:0}))}});
  }
  const summary=summarizeCase(inputs[0],records);
  assert.equal(summary.independentScenarios,2);assert.equal(summary.AOnlyWins,1);assert.equal(summary.BOnlyWins,0);
  assert.equal(summary.pairs[1].scored,false);
  const seeds=batchProtocol('validation-1').scenarioSeeds;
  const replacement=structuredClone(records);
  for(const r of replacement)r.seed=seeds[r.seed===51001?0:1];
  const replicated=summarizeCase(inputs[0],replacement,seeds);
  assert.equal(replicated.AOnlyWins,1);assert.equal(replicated.independentScenarios,2);
  assert.throws(()=>summarizeCase(inputs[0],replacement.slice(1),seeds));
  replacement[0]=structuredClone(replacement[1]);
  assert.throws(()=>summarizeCase(inputs[0],replacement,seeds));
  records[2].game.frames++;
  assert.throws(()=>summarizeCase(inputs[0],records),/mirror gameplay mismatch/);
});

test('replication seeds are frozen, disjoint and cannot change the pilot protocol',()=>{
  const seeds=Object.values(KO_BATCHES).flat();assert.equal(new Set(seeds).size,6);
  const changed=batchProtocol('validation-1');changed.scenarioSeeds[0]=1;
  assert.equal(batchProtocol('validation-1').scenarioSeeds[0],730201);
  assert.deepEqual(batchProtocol().scenarioSeeds,[51001,51002]);
  assert.throws(()=>batchProtocol('unregistered'));
});

test('notification requires all six distinct shards and clean correctness',()=>{
  const results=inputs.flatMap(({id})=>['validation-1','validation-2'].map(batch=>({
    id,batch,complete:true,seatParity:true,technicalFailures:0,silentFallback:0,parity:{mismatches:0},
    independentScenarios:2,AOnlyWins:1,BOnlyWins:0,
    pairs:KO_BATCHES[batch].map((seed,i)=>({seed,comparison:i?'concordant':'A-only-win'}))
  })));
  assert.equal(experimentStatus(results,'success','replication').ok,true);
  assert.equal(experimentStatus(results,'failure','replication').ok,false);
  assert.equal(experimentStatus(results.slice(1),'success','replication').ok,false);
  for(const mutate of [r=>{r[0]=r[1];},r=>{r[0].silentFallback=1;},r=>{r[0].parity.mismatches=1;},
    r=>{r[0].pairs[0].seed=51001;},r=>{r[0].AOnlyWins=2;}]){
    const bad=structuredClone(results);mutate(bad);
    assert.equal(experimentStatus(bad,'success','replication').ok,false);
  }
});
