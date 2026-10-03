import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {selectActivation} from '../scripts/kiwi-wasted-activation-samples.js';
import {PlacementArenaEngine} from '../src/analysis/placement-authority.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {prepareKiwi} from '../src/analysis/kiwi.js';
test('activation selection uses public availability only and has a fixed bound',()=>{
 const rows=Array.from({length:80},(_,request)=>({request,snapshot:{current:{type:'t'},hold:{piece:null,locked:false}},
  get report(){throw Error('Must not inspect score');},get action(){throw Error('Must not inspect action');}}));
 const s=selectActivation(rows,0);assert.equal(s.eligible,80);assert.equal(s.samples.length,32);
 assert.equal(s.samples[0].id,'short37023218685/leg0/request0');assert.equal(s.samples.at(-1).id,'short37023218685/leg0/request79');
 assert.equal(new Set(s.samples.map(x=>x.id)).size,32);
 assert.equal(selectActivation([{request:1,snapshot:{current:{type:'i'},hold:{piece:'t',locked:true}}}],0).samples.length,0);
});
test('all 55 added inputs are exact public snapshots and adapter accepts them',()=>{
 const c=JSON.parse(readFileSync('docs/audits/cc2-alignment/WASTED_T_ACTIVATION_INPUTS.json'));
 assert.equal(c.samples.length,55);assert.equal(new Set(c.samples.map(x=>x.id)).size,55);
 for(const {snapshot:v,snapshotHash} of c.samples){
  assert.equal(createHash('sha256').update(JSON.stringify(v)).digest('hex'),snapshotHash);
  assert.ok(v.current.type==='t'||(!v.hold.locked&&v.hold.piece==='t'));
  const e=new PlacementArenaEngine({rules:v.rules}),s=e.state;
  s.board=structuredClone(v.board);s.piece=structuredClone(v.current);s.hold=structuredClone(v.hold);
  s.bag.queue=[...v.next,'i','o','t','s','z','j','l'];s.frame=v.frame;s.subframe=v.subframe;
  s.stats.pieces=v.piecesPlaced;Object.assign(s.attack,structuredClone(v.attack));s.attack.pieces=v.piecesPlaced;
  s.garbageLockedUntil=v.garbageLockedUntil;
  assert.deepEqual(visibleState(s),v);assert.equal(prepareKiwi(v).request.node_budget,200000);
 }
});
