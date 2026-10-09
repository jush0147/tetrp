import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove} from '../src/analysis/rook.js';
import {visibleCombat} from '../src/analysis/rook-combat.js';
import {evaluatePublicTankBelief} from '../src/analysis/rook-belief.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';

function attacked(){
  const e=new Engine({mode:'tl',seed:12,rules:{g:0}});
  e.state.hold.locked=true;
  const cid=e.receive({from:'P2',iid:1,amt:3});
  e.confirm(cid);
  return e;
}

test('belief aggregates all holes, not just whichever gives the highest score',()=>{
  const e=attacked(),v=visibleState(e.state),combat=visibleCombat(v);
  combat.pending[0].active=true;
  const uniform=e.state.board.width;
  const neutral=evaluatePublicTankBelief(v.board,combat,v.rules,{
    riskWeight:0,score:outcome=>outcome.holes[0]});
  const conservative=evaluatePublicTankBelief(v.board,combat,v.rules,{
    riskWeight:.4,score:outcome=>outcome.holes[0]});
  assert.equal(neutral.outcomes,uniform);
  assert.ok(Math.abs(neutral.expected-(uniform-1)/2)<1e-9);
  assert.equal(neutral.worst,0);
  assert.ok(Math.abs(neutral.value-(uniform-1)/2)<1e-9);
  assert.ok(Math.abs(conservative.value-.6*(uniform-1)/2)<1e-9);
  assert.ok(Math.abs(conservative.weightSum-1)<1e-9);
  assert.equal(v.attack.pending[0].active,false);
  assert.throws(()=>evaluatePublicTankBelief(v.board,combat,v.rules,{
    maxOutcomes:5,score:()=>0}),/scenario limit/);
});

test('opt-in conditional NEXT evaluation uses public packets and is deterministic',()=>{
  const e=attacked(),v=visibleState(e.state),original=e.serialize();
  const cfg={depth:2,beamWidth:5,maxNodes:280,maxStates:350,
    futureReachable:false,spinForecast:false,tsdTacticalProbes:0,
    garbageBelief:true,beliefProbes:2,beliefMaxOutcomes:10,
    beliefReachableStates:85};
  const before=chooseMove(v,{...cfg,garbageBelief:false});
  const after=chooseMove(v,cfg);
  assert.equal(before.diagnostics.beliefEvaluations,0);
  assert.ok(after.diagnostics.beliefEvaluations>0);
  assert.ok(after.diagnostics.beliefEvaluations<=cfg.beliefProbes);
  assert.equal(after.diagnostics.beliefOutcomes,
    after.diagnostics.beliefEvaluations*v.board.width);
  assert.equal(after.kind,'place');
  assert.ok(validatePlacement(v,{action:{kind:'place'},move:after.move,
    execution:after.execution}));
  const poisoned={...structuredClone(v),hiddenHole:7,
    futureBag:['t','t'],opponent:{futureAttack:100}};
  assert.deepEqual(chooseMove(poisoned,cfg),after);
  assert.equal(e.serialize(),original);
});

test('belief evaluator rejects invalid probability policy and never accepts hidden RNG',()=>{
  const e=attacked(),v=visibleState(e.state),combat=visibleCombat(v);
  assert.throws(()=>evaluatePublicTankBelief(v.board,combat,v.rules,{
    riskWeight:-.1,score:()=>0}),/invalid public belief evaluator/);
  assert.throws(()=>evaluatePublicTankBelief(v.board,combat,v.rules,{
    score:()=>Number.NaN}),/non-finite belief value/);
});
