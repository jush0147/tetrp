import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove} from '../src/analysis/rook.js';

test('configured maxNodes is a strict bound, not an off-by-one reporting counter',()=>{
  const e=new Engine({mode:'tl',seed:67020,rules:{g:0}});
  const visible=visibleState(e.state);
  for(const limit of [20,100,600]){
    const result=chooseMove(visible,{depth:4,beamWidth:24,maxNodes:limit,
      maxStates:650,maxSteps:42,reverseOnlyOpen:true});
    assert.ok(result.diagnostics.evaluated<=limit,
      'ROOK evaluated more than '+limit+' placements');
  }
});

test('more evaluations do not change the current/hold/NEXT5 contract',()=>{
  const e=new Engine({mode:'tl',seed:67023,rules:{g:0}});
  const state=visibleState(e.state);
  const before=structuredClone(state);
  for(const maxNodes of [600,1200]){
    const result=chooseMove(state,{maxNodes,depth:4,beamWidth:12,
      maxStates:650,maxSteps:42,reverseOnlyOpen:true});
    assert.ok(result.kind==='place'||result.kind==='hold');
    assert.ok(result.diagnostics.evaluated<=maxNodes);
  }
  assert.deepEqual(state,before);
});
