import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {probeFrontier} from '../scripts/kiwi-frontier-probe.js';

for(const frame of [1032,1056])test('one-step reveal probe preserves information boundary and authority parity: '+frame,async()=>{
  const input=JSON.parse(await readFile(new URL(`../docs/audits/kiwi-ft7-35765171232/g3-f${frame}.json`,import.meta.url),'utf8'));
  // Offline actual outcomes and original decision metadata must not influence the probe.
  for(const key of ['observed','originalTop1'])Object.defineProperty(input,key,{get(){throw new Error('Private/offline metadata accessed');}});
  const result=probeFrontier(input),top=result.branches.find(b=>b.label==='rank-0'),hold=result.branches.find(b=>b.label==='rank-1');
  assert.ok(Math.abs(top.baselineScore+32.8)<1e-8);
  assert.ok(Math.abs(top.extendedScore+33.2)<1e-8);
  assert.ok(result.authorityChecks>0);
  for(const b of result.branches)for(const r of b.results){
    assert.equal(r.weight,.1);assert.ok(r.knownQueue.length>=1);
    if(!r.extension)continue;
    assert.equal(r.extension.authority.passed,true);
    assert.equal(r.extension.best.score,Math.max(...r.extension.successors.map(s=>s.score)));
    assert.equal(r.extension.maximumCancelled,0,'No invented incoming after first packet tank');
    assert.equal(r.extension.legalPlacements,r.extension.successors.length);
  }
  if(frame===1032){
    assert.equal(hold.rootAction.action.kind,'hold');
    assert.ok(Math.abs(hold.extendedScore+30.05)<1e-8);
    assert.ok(hold.extendedScore>top.extendedScore);
    for(const r of hold.results){
      assert.equal(r.extension.best.piece,'t');assert.equal(r.extension.best.spin,'none');
      assert.equal(r.extension.best.clear.lines,2);assert.equal(r.extension.best.generated,1);
      assert.equal(r.extension.best.sent,1);assert.equal(r.extension.best.btbAfter,0);
    }
  }else{
    assert.ok(Math.abs(hold.extendedScore+35.25)<1e-8);
    assert.ok(top.extendedScore>hold.extendedScore);
    for(const b of result.branches)for(const r of b.results)assert.equal(r.extension.maximumGenerated,0);
  }
});
