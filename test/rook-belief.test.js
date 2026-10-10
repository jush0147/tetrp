import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove,revalueBeliefCandidate} from '../src/analysis/rook.js';
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

test('public-garbage belief value actually changes beam rank, preserving intermediate-only shaping',()=>{
  const control={evalScore:20,beamScore:23};
  const other={evalScore:15,beamScore:15};
  assert.ok(control.beamScore>other.beamScore);
  assert.equal(revalueBeliefCandidate(control,-5),control);
  assert.equal(control.evalScore,-5);
  assert.equal(control.beamScore,-2,'keep +3 shaping, not stale +23 rank');
  assert.ok(control.beamScore<other.beamScore);
  const noShaping={evalScore:2,beamScore:2};
  revalueBeliefCandidate(noShaping,9);
  assert.deepEqual(noShaping,{evalScore:9,beamScore:9});
  const fallback={evalScore:7};
  revalueBeliefCandidate(fallback,11);
  assert.deepEqual(fallback,{evalScore:11,beamScore:11});
  assert.throws(()=>revalueBeliefCandidate(control,Infinity),/invalid belief revaluation/);
});


test('common-horizon belief is opt-in, budget bounded and public-only',()=>{
  const e=attacked(),v=visibleState(e.state),before=structuredClone(v);
  const cfg={depth:3,beamWidth:5,maxNodes:320,maxStates:180,
    futureReachable:false,spinForecast:false,tsdTacticalProbes:0,
    garbageBelief:true,beliefProbes:2,beliefMaxOutcomes:10,
    beliefReachableStates:90};
  const legacy=chooseMove(v,cfg);
  const explicitLegacy=chooseMove(v,{...cfg,beliefCommonHorizon:false});
  assert.deepEqual(legacy,explicitLegacy);
  const experimental=chooseMove(v,{...cfg,beliefCommonHorizon:true,
    beliefHorizonNodes:120,beliefHorizonBeam:2});
  assert.equal(experimental.diagnostics.beliefCommonHorizon,true);
  assert.ok(experimental.diagnostics.beliefHorizonEvaluated<=
    cfg.beliefProbes*v.board.width*120);
  assert.ok(experimental.diagnostics.beliefHorizonAborted>=0);
  assert.ok(experimental.diagnostics.evaluated<=cfg.maxNodes);
  assert.deepEqual(v,before);
  assert.deepEqual(chooseMove({...v,privateHole:3,futureBag:['t']},
    {...cfg,beliefCommonHorizon:true,beliefHorizonNodes:120,beliefHorizonBeam:2}),
    experimental);
});

test('common-horizon rejects invalid budgets before planning',()=>{
  const v=visibleState(attacked().state);
  const base={depth:2,beamWidth:4,maxNodes:180};
  assert.throws(()=>chooseMove(v,{...base,beliefCommonHorizon:'yes'}),
    /invalid search budget/);
  assert.throws(()=>chooseMove(v,{...base,beliefHorizonNodes:0}),
    /invalid search budget/);
  assert.throws(()=>chooseMove(v,{...base,beliefHorizonBeam:0}),
    /invalid search budget/);
});


test('aborted same-horizon scenarios count their CPU work and do not become beliefs',()=>{
  const v=visibleState(attacked().state);
  const cfg={depth:3,beamWidth:5,maxNodes:320,maxStates:180,
    futureReachable:false,spinForecast:false,garbageBelief:true,
    beliefProbes:2,beliefMaxOutcomes:10,beliefReachableStates:90,
    beliefCommonHorizon:true,beliefHorizonNodes:1,beliefHorizonBeam:2};
  const out=chooseMove(v,cfg);
  assert.ok(out.diagnostics.beliefAttempts>0);
  assert.ok(out.diagnostics.beliefHorizonAborted>0);
  assert.ok(out.diagnostics.beliefHorizonEvaluated>0,
    'discarded conditional rollouts still consume compute');
  assert.ok(out.diagnostics.beliefHorizonEvaluated<=
    out.diagnostics.beliefAttempts*v.board.width);
  assert.equal(out.diagnostics.beliefEvaluations,0,
    'partial-depth outcome must not be used to re-rank a root');
  assert.ok(out.diagnostics.evaluated<=cfg.maxNodes);
});
