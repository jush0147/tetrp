import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove,enumerateReachable} from '../src/analysis/rook.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';

const search={depth:3,beamWidth:6,maxNodes:800,maxStates:400,
  futureReachableStates:400,futureReachableProbes:6,
  spinForecast:false,tsdTacticalProbes:0};

test('future SRS+ probes can be distributed beyond NEXT1 without private previews',()=>{
  const engine=new Engine({mode:'tl',seed:67,rules:{g:0,spinbonuses:'all-mini+'}});
  engine.state.hold.locked=true;
  const visible=visibleState(engine.state);
  const r=chooseMove(visible,{...search,includeRanked:true});
  assert.equal(r.kind,'place');
  assert.ok(r.diagnostics.futureProbes>0);
  assert.ok(r.diagnostics.futureMoves>0);
  assert.ok(r.diagnostics.futureReachableByPly[1]>0);
  assert.equal(r.diagnostics.tsdProbes,0);
  assert.ok(r.diagnostics.futureProbes<=search.futureReachableProbes);
  assert.ok(r.diagnostics.evaluated<=search.maxNodes);
  assert.ok(validatePlacement(visible,{action:{kind:'place'},move:r.move,
    execution:r.execution}).intent);
});

test('disabling future SRS+ search is an explicit reproducible ablation',()=>{
  const visible=visibleState(new Engine({mode:'tl',seed:69,rules:{g:0}}).state);
  const off=chooseMove(visible,{...search,futureReachable:false});
  const on=chooseMove(visible,search);
  assert.equal(off.diagnostics.futureProbes,0);
  assert.equal(off.diagnostics.futureMoves,0);
  assert.ok(on.diagnostics.futureProbes>0);
});

test('unknown future pieces and invalid BFS budgets are rejected',()=>{
  const v=visibleState(new Engine({seed:78,rules:{g:0}}).state);
  assert.throws(()=>chooseMove({...v,next:[...v.next,'t']},search),
    /exactly five publicly visible NEXT/);
  assert.throws(()=>chooseMove(v,{...search,futureReachableStates:0}),
    /invalid search budget/);
  const reached=enumerateReachable(v.board,v.current,v.rules,{maxStates:350});
  assert.ok(reached.some(m=>m.path.at(-1)==='hardDrop'));
});
