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
  const engine=new Engine({mode:'tl',seed:67020,rules:{g:0}});
  engine.state.hold.locked=true; // Focus this test on placement selection.
  const v=visibleState(engine.state);
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

// Global attack reward ablation must be opt-in and may not silently alter the
// default ranking; it cannot depend on hidden future pieces or RNG.
test('offense weight preserves baseline and rejects invalid values',()=>{
  const e=new Engine({mode:'tl',seed:67023,rules:{g:0}});
  e.state.hold.locked=true;
  const v=visibleState(e.state);
  const cfg={depth:3,beamWidth:12,maxNodes:1200,maxStates:450,
    spinForecast:false,futureReachableProbes:2};
  const original=chooseMove(v,cfg);
  assert.deepEqual(chooseMove(v,{...cfg,offenseWeight:4.8}),original);
  const varied=chooseMove(v,{...cfg,offenseWeight:7.2});
  assert.equal(varied.diagnostics.offenseWeight,7.2);
  assert.equal(original.diagnostics.offenseWeight,4.8);
  for(const bad of [-1,25,Infinity,NaN]){
    assert.throws(()=>chooseMove(v,{...cfg,offenseWeight:bad}),
      /invalid search budget/);
  }
});
