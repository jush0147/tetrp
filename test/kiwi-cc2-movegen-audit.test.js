import test from 'node:test';
import assert from 'node:assert/strict';
import {PlacementArenaEngine} from '../src/analysis/placement-authority.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {enumerateAuthority,compareSets,cellsKey} from '../scripts/kiwi-cc2-movegen-audit.js';
test('spawn O has nine certified cell landings, no speculative spin',()=>{
  const e=new PlacementArenaEngine();e.spawn('o');
  const r=enumerateAuthority(visibleState(e.state));
  assert.equal(r.moves.length,9);assert.equal(r.complete,true);
  assert.ok(r.moves.every(m=>m.action.execution.spin==='none'));
});
test('state budget exhaustion is a technical failure, not an empty landing set',()=>{
  const e=new PlacementArenaEngine();assert.throws(()=>enumerateAuthority(visibleState(e.state),1),/budget/);
});
test('cells equivalent rotations collapse, but spin differences stay visible',()=>{
  const cells=[[0,39],[1,39],[0,38],[1,38]],key=cellsKey(cells);
  const c={id:'test',authority:{moves:[{key:key+':mini',action:'witness'}]}};
  const move={cells:cells.map(([x,y])=>[x,39-y]),placement:{spin:'none'}};
  const r=compareSets(c,{id:'test',moves:[move,move]});
  assert.equal(r.cc2Count,1);assert.deepEqual(r.authorityOnly,[key+':mini']);
  assert.deepEqual(r.cc2Only,[key+':none']);assert.deepEqual(r.cc2OnlyCells,[]);
  assert.deepEqual(r.authorityOnlyCells,[]);
  assert.throws(()=>compareSets(c,{id:'other',moves:[]}));
});
