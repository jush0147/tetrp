import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from '../scripts/kiwi-b2b-leaf-off-prepare.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine} from '../src/analysis/placement-authority.js';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
test('leaf override is the sole source mutation and rejects missing/ambiguous anchors',()=>{
 const anchor='        config.freestyle_weights.pending_safety = 1.0;';
 const source=`before\n${anchor}\nafter`;
 const delta='\n        if cfg!(b2b_leaf_off) { config.freestyle_weights.has_back_to_back = 0.0; }';
 assert.equal(transform(source).replace(delta,''),source);
 assert.throws(()=>transform('missing'));assert.throws(()=>transform(source+source));
});
test('all fixed public gate inputs restore exactly without replay futures',()=>{
 const samples=[...read('docs/audits/cc2-alignment/perf-snapshots.json'),...read('docs/audits/cc2-alignment/WASTED_T_ACTIVATION_INPUTS.json').samples];
 assert.equal(samples.length,67);
 for(const {snapshot:v} of samples){
  const e=new PlacementArenaEngine({rules:v.rules}),s=e.state;
  s.board=structuredClone(v.board);s.piece=structuredClone(v.current);s.hold=structuredClone(v.hold);
  s.bag.queue=[...v.next,'i','o','t','s','z','j','l'];s.frame=v.frame;s.subframe=v.subframe;
  s.stats.pieces=v.piecesPlaced;Object.assign(s.attack,structuredClone(v.attack));s.attack.pieces=v.piecesPlaced;
  s.garbageLockedUntil=v.garbageLockedUntil;assert.deepEqual(visibleState(s),v);
 }
});
