import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove} from '../src/analysis/rook.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
const config={depth:4,beamWidth:10,maxNodes:1200,maxStates:300,
  maxSteps:42,futureReachable:false,spinForecast:false,traceRootScores:true};

test('exact fifth-piece SRS extension is opt-in, public-only, and leaves original input unchanged',()=>{
  const engine=new Engine({mode:'tl',seed:67109,rules:{g:0}});
  engine.state.hold.locked=true;
  const v=visibleState(engine.state),before=structuredClone(v);
  const baseline=chooseMove(v,config);
  assert.deepEqual(baseline,chooseMove(v,{...config,exactLeafExtension:false}));
  const options={...config,exactLeafExtension:true,leafExtensionBudget:2500,
    leafExtensionStates:400};
  const extended=chooseMove(v,options);
  assert.equal(extended.diagnostics.exactLeafExtension,true);
  assert.ok(extended.diagnostics.leafExtensionEvaluated<=2500);
  assert.ok(extended.diagnostics.evaluated<=1200);
  assert.deepEqual(v,before);
  assert.ok(validatePlacement(v,{action:{kind:'place'},move:extended.move,
    execution:extended.execution}));
  const contaminated={...structuredClone(v),privateHole:1,
    futureBag:['t','t'],opponent:{upcomingGarbage:100}};
  assert.deepEqual(chooseMove(contaminated,options),extended);
  if(extended.diagnostics.leafExtensionApplied){
    assert.equal(extended.diagnostics.leafExtensionAbort,null);
    assert.ok(extended.diagnostics.leafExtensionWitnesses>0);
    assert.ok(extended.rootScores.every(row=>
      Number.isFinite(row.leaf.exactExtendedScore)));
  }
});

test('partially explored fifth-ply leaves cannot re-rank finalist roots',()=>{
  const engine=new Engine({mode:'tl',seed:67109,rules:{g:0}});
  engine.state.hold.locked=true;
  const v=visibleState(engine.state);
  const original=chooseMove(v,config);
  const limited=chooseMove(v,{...config,exactLeafExtension:true,
    leafExtensionBudget:1,leafExtensionStates:100});
  assert.equal(limited.diagnostics.leafExtensionApplied,false);
  assert.equal(limited.diagnostics.leafExtensionAbort,'budget-exhausted');
  assert.equal(limited.diagnostics.leafExtensionEvaluated,1);
  assert.equal(limited.kind,original.kind);
  assert.deepEqual(limited.move,original.move);
  assert.deepEqual(limited.execution,original.execution);
});

test('fifth-ply extension validates budgets and cannot use private sixth future',()=>{
  const engine=new Engine({mode:'tl',seed:1,rules:{g:0}});
  engine.state.hold.locked=true;
  const v=visibleState(engine.state);
  assert.throws(()=>chooseMove(v,{...config,leafExtensionBudget:0}),
    /invalid search budget/);
  assert.throws(()=>chooseMove(v,{...config,leafExtensionStates:0}),
    /invalid search budget/);
  const out=chooseMove(v,{...config,depth:5,exactLeafExtension:true});
  assert.equal(out.diagnostics.leafExtensionApplied,false);
  assert.equal(out.diagnostics.leafExtensionAbort,'depth-not-four');
});
