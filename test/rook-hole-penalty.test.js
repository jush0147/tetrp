import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove,explainBoardEvaluation} from '../src/analysis/rook.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';

const options={depth:3,beamWidth:12,maxNodes:1400,
  maxStates:500,maxSteps:42,traceRootScores:true,includeRanked:true,
  spinForecast:false,futureReachable:false};

test('hole ablation changes ONLY actual holes penalty, not b2b or real attack',()=>{
  const e=new Engine({mode:'tl',seed:67510,rules:{g:0}});
  const b=e.state.board;
  // Occupancy with one buried empty cell in a column; no illegal hard garbage.
  const H=b.rows.length;
  b.rows[H-3][4]='i';
  b.rows[H-1][4]='i';
  const ctx={pending:3,btb:2,combo:1,recoveryActive:false};
  const old=explainBoardEvaluation(b,{...ctx,holePenaltyScale:1});
  const discounted=explainBoardEvaluation(b,{...ctx,holePenaltyScale:.5});
  assert.ok(old.features.holes>0);
  assert.ok(Math.abs((discounted.boardValue-old.boardValue)-
    old.features.holes*8.6*old.features.danger*.5)<1e-9);
  for(const term of Object.keys(old.terms))
    if(term!=='holes')
      assert.equal(discounted.terms[term],old.terms[term],term);
  assert.ok(Math.abs(old.reconstructionError)<1e-9);
  assert.ok(Math.abs(discounted.reconstructionError)<1e-9);
});
test('default ROOK equals explicit scale 1, and public-only alternative is legal',()=>{
  const v=visibleState(new Engine({mode:'tl',seed:67511,
    rules:{g:0}}).state),before=structuredClone(v);
  const ordinary=chooseMove(v,options);
  const explicit=chooseMove(v,{...options,holePenaltyScale:1});
  assert.deepEqual(explicit,ordinary,'no default strategy or diagnostic changes');
  const modified=chooseMove(v,{...options,holePenaltyScale:.5});
  assert.equal(modified.diagnostics.holePenaltyScale,.5);
  assert.ok(['place','hold'].includes(modified.kind));
  if(modified.kind==='place')
    assert.ok(validatePlacement(v,{action:{kind:'place'},
      move:modified.move,execution:modified.execution}));
  for(const r of modified.rootScores){
    assert.ok(Number.isFinite(r.leaf.total));
    assert.ok(Math.abs(r.leaf.valueReconstructionError)<1e-8);
    assert.ok(Math.abs(r.leaf.board.reconstructionError)<1e-8);
  }
  assert.deepEqual(v,before);
  const poisoned={...structuredClone(v),hiddenFutureGarbageHole:5,
    opponentNextPiece:'t',privateBag:['i','t']};
  assert.deepEqual(chooseMove(poisoned,{...options,holePenaltyScale:.5}),
    modified,'private or imaginary future fields must be ignored');
  for(const invalid of [-.01,2.001,Infinity,NaN,'0.5'])
    assert.throws(()=>chooseMove(v,{...options,holePenaltyScale:invalid}),
      /invalid search budget/);
});
