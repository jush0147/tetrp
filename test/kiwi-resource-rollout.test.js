import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {environment,syntheticTail,rollout,dominates} from '../scripts/kiwi-resource-rollout.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {profile} from '../scripts/kiwi-profiles.js';
const inputs=JSON.parse(readFileSync(new URL('../docs/audits/kiwi-resource-rollout/inputs.json',import.meta.url)));
test('synthetic future is reproducible, private, independent of history and absent from initial snapshot',()=>{
  const s=structuredClone(inputs[0].snapshot);
  Object.defineProperty(s,'history',{get(){throw new Error('Forbidden history');}});
  assert.deepEqual(visibleState(environment(s,41001).state),visibleState(environment(s,41002).state));
  assert.deepEqual(syntheticTail(41001),syntheticTail(41001));assert.notDeepEqual(syntheticTail(41001),syntheticTail(41002));
  assert.equal(visibleState(environment(s,41001).state).next.length,5);
});
test('root Hold is committed and revealed before fresh policy request; all slots use authority',async()=>{
  const input=inputs.find(i=>i.id==='g3-f216'),p=await profile('native',{horizon:1});let calls=0;
  const r=await rollout(input.snapshot,input.roots.native,s=>{
    calls++;assert.equal(s.next.length,5);for(const k of ['bag','history','checkpoint','events'])assert.equal(k in s,false);
    return p.decide(s);
  },41001,{slots:3});
  assert.ok(calls>0);assert.equal(r.trace[0].action.action.kind,'hold');
  assert.deepEqual(r.trace[1].snapshot.hold,r.trace[0].actual.hold);
  assert.equal(r.parity.mismatches,0);assert.equal(r.placements,3);
  const locks=r.trace.filter(t=>t.action.action.kind==='place');
  locks.forEach((t,i)=>assert.equal(t.actual.locks[0].frame,input.snapshot.frame+24*i+23));
});
test('Legacy continuation smoke uses frozen placement root without candidate fallback',async()=>{
  const p=await profile('legacy'),r=await rollout(inputs[1].snapshot,inputs[1].roots.legacy,p.decide,41002,{slots:2});
  assert.equal(r.parity.mismatches,0);assert.equal(r.placements,2);
});
test('one committed placement reveals exactly the next synthetic piece, never the entire tail',async()=>{
  const input=inputs[0];
  const r=await rollout(input.snapshot,input.roots.native,()=>{throw new Error('Root placement needs no policy call');},41001,{slots:1});
  assert.deepEqual(r.end.next,[...input.snapshot.next.slice(1),syntheticTail(41001)[0]]);
  assert.equal(r.trace[0].snapshot.next.length,5);assert.equal('bag' in r.end,false);
});
test('measured dominance rejects tradeoffs and requires paired scenarios',()=>{
  const r={seed:1,slots:8,placements:8,alive:true,totals:{generated:2,sent:2},endFeatures:{maxHeight:4,coveredEmpty:0}};
  const better=structuredClone(r);better.totals.sent=3;better.totals.generated=3;
  assert.equal(dominates([r],[r]),false);assert.equal(dominates([better],[r]),true);
  better.endFeatures.maxHeight=5;assert.equal(dominates([better],[r]),false);
  assert.throws(()=>dominates([r],[{...r,seed:2}]));
});
