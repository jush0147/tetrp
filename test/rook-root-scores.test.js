import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove,explainBoardEvaluation} from '../src/analysis/rook.js';
import {actionSignature} from '../src/analysis/rook-disagreement.js';

const opts={depth:4,beamWidth:14,maxNodes:2000,maxStates:650,
  maxSteps:42,includeRanked:true,spinForecast:false,
  futureReachableProbes:3};

test('opt-in root-score explanations preserve original ROOK policy and public input',()=>{
  const engine=new Engine({mode:'tl',seed:67020,rules:{g:0}});
  engine.state.hold.locked=true;
  const publicState=visibleState(engine.state);
  const before=structuredClone(publicState);
  const baseline=chooseMove(publicState,opts);
  const explained=chooseMove(publicState,{...opts,traceRootScores:true});
  const {rootScores,...policy}=explained;
  assert.deepEqual(policy,baseline);
  assert.deepEqual(publicState,before);
  assert.ok(rootScores.length>0&&rootScores.length<=opts.beamWidth);
  assert.equal(Number(rootScores[0].leaf.total.toFixed(3)),
    explained.diagnostics.value);
  assert.equal(actionSignature(rootScores[0].action),
    actionSignature(baseline));
  for(const row of rootScores){
    const {leaf}=row;
    assert.ok(Math.abs(leaf.board.reconstructionError)<1e-8);
    assert.ok(Math.abs(leaf.valueReconstructionError)<1e-8);
    assert.ok(Math.abs(leaf.total-(leaf.cumulativeReward+
      leaf.discountedBoardValue))<1e-8);
    assert.ok(leaf.ply>=1&&leaf.ply<=opts.depth);
    assert.equal(leaf.board.features.pending>=0,true);
    assert.ok(Object.values(leaf.board.terms).every(Number.isFinite));
  }
});

test('diagnostic board decomposition reconstructs the unchanged board evaluator',()=>{
  const e=new Engine({mode:'tl',seed:9,rules:{g:0}});
  const visible=visibleState(e.state);
  const ctx={pending:0,btb:0,combo:0,recoveryActive:false};
  const report=explainBoardEvaluation(visible.board,ctx);
  assert.ok(Math.abs(report.boardValue-report.reconstructed)<1e-9);
  assert.equal(report.features.holes,0);
  assert.equal(report.features.height,0);
  assert.equal(report.terms.holes,0);
});
