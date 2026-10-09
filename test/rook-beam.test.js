import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove} from '../src/analysis/rook.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';

const cfg={depth:4,beamWidth:24,maxNodes:3000,maxStates:600,maxSteps:42,
  spinForecast:false,futureReachableProbes:3,includeRanked:true,
  traceRootSurvival:true};

test('focused beam spends slots on alternatives within promising roots without changing baseline',()=>{
  const v=visibleState(new Engine({mode:'tl',seed:67020,rules:{g:0}}).state);
  const original=structuredClone(v);
  const baseline=chooseMove(v,cfg);
  const explicit=chooseMove(v,{...cfg,beamRootReserve:null});
  assert.deepEqual(explicit,baseline);
  const focused=chooseMove(v,{...cfg,beamRootReserve:8});
  assert.equal(focused.diagnostics.beamRootReserve,8);
  assert.ok(focused.ranked.length>0);
  assert.ok(focused.rootSurvival.length>0);
  assert.equal(focused.kind,'place');
  assert.ok(validatePlacement(v,{action:{kind:'place'},move:focused.move,
    execution:focused.execution}));
  assert.deepEqual(v,original);
  const maxRoots=Math.max(...focused.rootSurvival.map(s=>s.roots.length));
  assert.ok(maxRoots<=cfg.beamWidth);
  assert.ok(focused.diagnostics.evaluated<=cfg.maxNodes);
});

test('invalid reserve cannot silently overwrite beam width',()=>{
  const v=visibleState(new Engine({mode:'tl',seed:9,rules:{g:0}}).state);
  assert.throws(()=>chooseMove(v,{...cfg,beamRootReserve:0}),/invalid search budget/);
  assert.throws(()=>chooseMove(v,{...cfg,beamRootReserve:25}),/invalid search budget/);
});
