import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove} from '../src/analysis/rook.js';

// Investigate allocation of an UNCHANGED nine genuine SRS+ proofs across
// the five public plies, not a new hidden-bag simulation or invented Spin.
const config={depth:5,beamWidth:48,maxNodes:24000,maxStates:1200,maxSteps:42,
  futureReachableProbes:9};

test('balanced future SRS+ reachability reaches last visible ply, unlike greedy ceil',()=>{
  const e=new Engine({mode:'tl',seed:67020,
    rules:{g:0,gincrease:0,b2bcharge_base:3}});
  const v=visibleState(e.state);
  const snapshot=structuredClone(v);
  const legacy=chooseMove(v,config);
  assert.deepEqual(legacy,chooseMove(v,{...config,futureProofSpread:'legacy'}));
  const balanced=chooseMove(v,{...config,futureProofSpread:'balanced'});
  const l=legacy.diagnostics,b=balanced.diagnostics;
  assert.equal(l.futureReachableByPly[4],0);
  assert.ok(b.futureReachableByPly[4]>0);
  assert.equal(b.futureReachableByPly.reduce((s,x)=>s+x,0),b.futureProbes);
  assert.ok(b.futureProbes<=config.futureReachableProbes);
  assert.ok(b.evaluated<=config.maxNodes);
  assert.equal(b.futureProofSpread,'balanced');
  assert.deepEqual(v,snapshot,'public current / hold / NEXT5 must be immutable');
});
test('invalid future proof allocation is never silently accepted',()=>{
  const v=visibleState(new Engine({mode:'tl',seed:9,rules:{g:0}}).state);
  assert.throws(()=>chooseMove(v,{...config,futureProofSpread:'unbalanced'}),
    /invalid search budget/);
});
