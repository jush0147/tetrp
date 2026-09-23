import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyze} from '../src/analysis/native/search.js';
import {analyzeFrontier} from '../src/analysis/native/frontier.js';
import {profile} from '../scripts/kiwi-profiles.js';
const fixture=f=>JSON.parse(readFileSync(new URL(`../docs/audits/kiwi-ft7-35765171232/g3-f${f}.json`,import.meta.url)));
for(const f of [1032,1056])test('frontier candidate matches authority-checked offline extension '+f,()=>{
  const input=fixture(f),snapshot=structuredClone(input.snapshot),base=analyze(snapshot),r=analyzeFrontier(snapshot);
  const oracle=JSON.parse(readFileSync(new URL(`../docs/audits/kiwi-frontier-probe/g3-f${f}.json`,import.meta.url)));
  assert.equal(r.frontierExtension.applied,true);
  for(const k of ['nodes','geometryStates','completedDepth','completion','ttHits'])assert.equal(r[k],base[k]);
  const key=a=>JSON.stringify([a.action,a.move,a.execution]);
  for(const c of r.candidates){
    const i=base.candidates.findIndex(b=>key(b)===key(c));assert.ok(i>=0);
    const expected=oracle.branches.find(b=>b.label==='rank-'+i);
    assert.ok(Math.abs(c.score-expected.extendedScore)<1e-8);
    assert.equal(c.frontierExtension.cancelled,0);
  }
  assert.equal(r.candidates[0].action.kind,f===1032?'hold':'place');
  assert.equal(r.frontierExtension.changedTop1,f===1032);
  assert.deepEqual(snapshot,input.snapshot);
});
test('budget exhaustion discards the entire extension ranking, including already evaluated roots',()=>{
  const s=fixture(1032).snapshot,base=analyze(s);
  for(const limits of [{geometryBudget:1000000,nodeBudget:1000},{geometryBudget:1,nodeBudget:50000}]){
    const r=analyzeFrontier(s,{},limits);
    assert.equal(r.frontierExtension.applied,false);assert.equal(r.frontierExtension.extendedRoots,0);
    if(limits.nodeBudget===1000)assert.ok(r.frontierExtension.discardedRoots>0);
    assert.deepEqual(r.candidates,base.candidates);
  }
});
test('unknown activation and multiple packets retain exact base policy',()=>{
  for(const mutate of [s=>{s.attack.pending[0].activeFrame=null;},s=>{s.attack.pending.push({...s.attack.pending[0]});}]){
    const s=fixture(1032).snapshot;mutate(s);const base=analyze(s),r=analyzeFrontier(s);
    assert.equal(r.frontierExtension.reason,'unsupported-packet-context');assert.deepEqual(r.candidates,base.candidates);
  }
});
test('arena profile extension is opt-in and exposes cumulative telemetry',async()=>{
  const off=await profile('native'),on=await profile('native',{frontierExtension:true}),s=fixture(1032).snapshot;
  assert.equal(off.decide(s).candidates[0].action.kind,'place');
  assert.equal(on.decide(s).candidates[0].action.kind,'hold');
  assert.equal(off.diagnostics.applied,0);assert.equal(on.diagnostics.applied,1);
  assert.equal(on.diagnostics.changedTop1,1);
});
test('frontier policy never accesses private snapshot extras',()=>{
  const s=fixture(1056).snapshot;
  for(const name of ['bag','holes','history','events','checkpoint','hiddenQueue','opponent'])
    Object.defineProperty(s,name,{get(){throw new Error('Private access: '+name);}});
  const r=analyzeFrontier(s);
  assert.equal(r.frontierExtension.applied,true);
});
