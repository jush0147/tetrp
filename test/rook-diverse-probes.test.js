import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove} from '../src/analysis/rook.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';

const cfg={depth:4,beamWidth:24,maxNodes:4000,maxStates:600,maxSteps:42,
  futureReachableProbes:9,spinForecast:false};

test('root-diverse SRS probes preserve public policy boundary and finite CPU budget',()=>{
  const engine=new Engine({mode:'tl',seed:67020,rules:{g:0}});
  const visible=visibleState(engine.state),before=structuredClone(visible);
  const baseline=chooseMove(visible,cfg);
  assert.deepEqual(baseline,chooseMove(visible,{...cfg,futureProofSpread:'legacy'}));
  const experiment=chooseMove(visible,{...cfg,futureProofSpread:'root-diverse'});
  assert.equal(experiment.diagnostics.futureProofSpread,'root-diverse');
  assert.ok(experiment.diagnostics.futureProbes<=9);
  const groups=experiment.diagnostics.futureProofNodeIndices;
  assert.equal(groups.length,5);
  assert.equal(groups.flat().length,experiment.diagnostics.futureProbes);
  for(const items of groups){
    assert.equal(new Set(items).size,items.length);
    if(items.length>=3)assert.ok(items[2]>items[1]);
  }
  if(experiment.kind==='place')assert.ok(validatePlacement(visible,
    {action:{kind:'place'},move:experiment.move,execution:experiment.execution}));
  assert.deepEqual(visible,before);
  assert.deepEqual(chooseMove({...structuredClone(visible),hiddenHole:5,
    futureBag:['t','t']},{...cfg,futureProofSpread:'root-diverse'}),experiment);
});

test('unknown future proof scheduling policy is invalid',()=>{
  const view=visibleState(new Engine({mode:'tl',seed:23,rules:{g:0}}).state);
  assert.throws(()=>chooseMove(view,{...cfg,futureProofSpread:'random'}),/invalid search budget/);
});
