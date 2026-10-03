import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {instrument} from '../scripts/kiwi-surge-observer-prepare.js';
import {restore} from '../scripts/kiwi-surge-audit.js';
import {visibleState} from '../src/analysis/visible-state.js';
test('observer inserts only a cfg-gated read and rejects duplicate/missing anchors',()=>{
 const anchor='                        children[next].push(ChildData {';
 const source=`before\n${anchor}\nafter`,out=instrument(source);
 assert.equal(out.replace(/                        #\[cfg\(surge_observer\)\][^\n]+\n/,''),source);
 assert.throws(()=>instrument(out));assert.throws(()=>instrument('missing'));
});
test('charged inputs are fixed, all-public and referee restores preserve the boundary',()=>{
 const input=JSON.parse(readFileSync('docs/audits/cc2-alignment/SURGE_PUBLIC_INPUTS.json'));
 assert.equal(input.samples.length,8);assert.deepEqual(input.sources.map(x=>x.charged),[69,32]);
 for(const s of input.samples){
  assert.equal(createHash('sha256').update(JSON.stringify(s.snapshot)).digest('hex'),s.snapshotHash);
  assert.ok(s.snapshot.attack.btb>s.snapshot.rules.b2bcharge_at);assert.equal(s.snapshot.next.length,5);
  const e=restore(s.snapshot);e.state.bag.queue.splice(5,7,'z','z','z');assert.deepEqual(visibleState(e.state),s.snapshot);
 }
});
