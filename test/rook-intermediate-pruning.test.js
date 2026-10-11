import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove} from '../src/analysis/rook.js';
import {actionSignature} from '../src/analysis/rook-disagreement.js';

const config={depth:5,beamWidth:24,maxNodes:4000,maxStates:650,
  maxSteps:42,spinForecast:false,futureReachableProbes:3,
  traceRootScores:true,traceRootSurvival:true};

test('setup-survival shaping only affects optional intermediate ranking',()=>{
  const e=new Engine({mode:'tl',seed:67023,rules:{g:0}});
  const publicView=visibleState(e.state),before=structuredClone(publicView);
  const original=chooseMove(publicView,config);
  assert.deepEqual(chooseMove(publicView,{...config,intermediateHoleRelief:0}),original);
  const shaped=chooseMove(publicView,{...config,intermediateHoleRelief:.65});
  assert.equal(original.diagnostics.intermediateHoleRelief,0);
  assert.equal(shaped.diagnostics.intermediateHoleRelief,.65);
  assert.ok(shaped.diagnostics.evaluated<=config.maxNodes);
  assert.ok(shaped.rootScores.length>0);
  assert.equal(actionSignature(shaped.rootScores[0].action),actionSignature(shaped));
  // Final leaf uses original board heuristic and original cumulative reward;
  // the temporary ranking bonus must never be credited as actual attack.
  for(const row of shaped.rootScores){
    assert.ok(Math.abs(row.leaf.valueReconstructionError)<1e-8);
    assert.ok(Math.abs(row.leaf.board.reconstructionError)<1e-8);
    assert.ok(Math.abs(row.leaf.total-
      (row.leaf.cumulativeReward+row.leaf.discountedBoardValue))<1e-8);
  }
  assert.deepEqual(publicView,before);
});
test('pruning relief range is enforced independently of offensive reward',()=>{
  const v=visibleState(new Engine({mode:'tl',seed:9,rules:{g:0}}).state);
  for(const bad of [-0.1,1.1,NaN,Infinity])
    assert.throws(()=>chooseMove(v,{...config,intermediateHoleRelief:bad}),
      /invalid search budget/);
});
