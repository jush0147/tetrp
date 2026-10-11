import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove,rookBoardKey} from '../src/analysis/rook.js';
import {publicPlanStillApplicable,proveForecastPlacement,plannedHold}
  from '../src/analysis/rook-plan.js';

const opts={depth:4,beamWidth:12,maxNodes:1900,maxStates:650,maxSteps:42,
  spinForecast:false,futureReachableProbes:3};

test('selected public plan does not change the default policy and has a certified first move',()=>{
  const e=new Engine({mode:'tl',seed:67027,rules:{g:0}});
  e.state.hold.locked=true;
  const visible=visibleState(e.state),frozen=structuredClone(visible);
  const baseline=chooseMove(visible,opts);
  const enriched=chooseMove(visible,{...opts,includeForecastPlan:true});
  const {forecastPlan,...policy}=enriched;
  assert.deepEqual(policy,baseline);
  assert.deepEqual(visible,frozen);
  assert.ok(forecastPlan.length>0&&forecastPlan.length<=4);
  assert.equal(forecastPlan[0].useHold,false);
  assert.equal(forecastPlan[0].preCurrent,visible.current.type);
  assert.ok(publicPlanStillApplicable(visible,forecastPlan[0]));
  const valid=proveForecastPlacement(visible,forecastPlan[0]);
  assert.ok(valid);
  assert.deepEqual(valid.move.cells.slice().sort(),baseline.move.cells.slice().sort());
  assert.equal(valid.execution.spin,baseline.execution.spin);
  assert.equal(publicPlanStillApplicable({...visible,hiddenHole:9},forecastPlan[0]),true);
  const invalid=structuredClone(visible);
  invalid.board.rows.at(-1)[0]='gb';
  assert.equal(publicPlanStillApplicable(invalid,forecastPlan[0]),false);
  assert.equal(proveForecastPlacement(invalid,forecastPlan[0]),null);
});

test('a predicted Hold requires the right public piece and unlocked Hold',()=>{
  const e=new Engine({mode:'tl',seed:67027,rules:{g:0}});
  const v=visibleState(e.state);
  const plan={preBoardKey:rookBoardKey(v.board),preCurrent:v.current.type,
    preHold:v.hold.piece,prePending:0,preBtb:0,preCombo:0,
    useHold:true,piece:v.next[0]};
  assert.deepEqual(plannedHold(v,plan),{action:{kind:'hold',mode:'empty'}});
  const wrong={...plan,piece:'unknown'};
  assert.equal(plannedHold(v,wrong),null);
  assert.equal(plannedHold({...v,hold:{...v.hold,locked:true}},plan),null);
});
