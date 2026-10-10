import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove,reservePublicOptionFrontier} from '../src/analysis/rook.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';

const node=(root,value,{realCombat=0,quadReadiness=0,spinReadiness=0}={})=>({
  rootAction:{kind:'place',move:{piece:'i',cells:[[root,0]]}},
  evalScore:value,beamScore:value,unresolvedGarbage:false,
  optionSignals:{realCombat,quadReadiness,spinReadiness}
});
test('frontier reserves bounded scored survivors from weaker tail',()=>{
  const a=node(0,100),b=node(1,99),c=node(2,98),d=node(3,97);
  const x=node(4,96,{realCombat:5});
  const y=node(5,95,{quadReadiness:4});
  const z=node(6,94,{spinReadiness:3});
  const all=[a,b,c,d,x,y,z],base=all.slice(0,4);
  const off=reservePublicOptionFrontier(all,base,{slots:0});
  assert.deepEqual(off.beam,base);
  assert.equal(off.details.inserted,0);
  const picked=reservePublicOptionFrontier(all,base,{slots:2,maxScoreGap:8});
  assert.equal(picked.beam.length,4);
  assert.equal(picked.details.inserted,2);
  assert.equal(picked.details.modes.combat,1);
  assert.equal(picked.details.modes.quad,1);
  assert.ok(picked.beam.includes(x));
  assert.ok(picked.beam.includes(y));
  assert.ok(picked.beam.includes(a));
  assert.ok(picked.beam.includes(b));
  assert.equal(new Set(picked.beam).size,4);
  assert.deepEqual(base,[a,b,c,d],'input beam is never mutated');
});
test('frontier rejects unaffordable, unknown-hole, and invalid budgets',()=>{
  const a=node(0,100),b=node(1,98);
  const x=node(2,70,{realCombat:7}),y=node(3,97,{realCombat:9});
  y.unresolvedGarbage=true;
  const picked=reservePublicOptionFrontier([a,b,x,y],[a,b],{
    slots:1,maxScoreGap:10});
  assert.equal(picked.details.inserted,0);
  for(const opts of [{slots:-1},{slots:1.5},{maxScoreGap:-1},
    {maxScoreGap:Infinity},{slots:129}]){
    assert.throws(()=>reservePublicOptionFrontier([a,b],[a,b],opts),
      /Invalid option-frontier/);
  }
});
test('frontier strategy is opt-in, public-only and authority-reachable',()=>{
  const engine=new Engine({mode:'tl',seed:67020,rules:{g:0}});
  engine.state.hold.locked=true;
  const v=visibleState(engine.state),unchanged=structuredClone(v);
  const opts={depth:4,beamWidth:14,maxNodes:1600,maxStates:500,
    maxSteps:42,spinForecast:false,futureReachableProbes:2,
    includeRanked:true};
  const normal=chooseMove(v,opts);
  const explicitlyOff=chooseMove(v,{...opts,optionFrontierSlots:0});
  assert.deepEqual(explicitlyOff,normal);
  const newPolicy=chooseMove(v,{...opts,optionFrontierSlots:3,
    optionFrontierMaxScoreGap:70});
  assert.equal(newPolicy.diagnostics.optionFrontierSlots,3);
  assert.ok(newPolicy.diagnostics.optionFrontierStats.considered>=0);
  assert.ok(newPolicy.diagnostics.optionFrontierStats.inserted>=0);
  assert.ok(newPolicy.diagnostics.optionFrontierStats.inserted<=3*3);
  assert.ok(['hold','place'].includes(newPolicy.kind));
  if(newPolicy.kind==='place')
    assert.ok(validatePlacement(v,{action:{kind:'place'},
      move:newPolicy.move,execution:newPolicy.execution}));
  assert.deepEqual(v,unchanged);
  const contaminated={...structuredClone(v),privateBag:['t','t'],
    hiddenGarbageHole:6,opponentFuturePiece:'i'};
  const likewise=chooseMove(contaminated,{...opts,optionFrontierSlots:3,
    optionFrontierMaxScoreGap:70});
  assert.deepEqual(likewise,newPolicy);
  assert.throws(()=>chooseMove(v,{...opts,optionFrontierSlots:14}),
    /invalid search budget/);
});

test('frontier active evaluator diagnostics preserve scored board reconstruction',()=>{
  const e=new Engine({mode:'tl',seed:67310,rules:{g:0}});
  const v=visibleState(e.state);
  const config={depth:4,beamWidth:12,maxNodes:1600,
    maxStates:480,maxSteps:42,spinForecast:false,
    futureReachableProbes:2,includeRanked:true,traceRootScores:true};
  const normal=chooseMove(v,config);
  const active=chooseMove(v,{...config,optionFrontierSlots:3});
  // Structural readiness only changes which nodes SURVIVE, not the value
  // computed for a surviving state. Every selected leaf still uses the
  // original Tetrp-combat reward and evaluator with zero reconstruction error.
  for(const report of [normal,active]){
    assert.ok(report.rootScores.length>0);
    for(const root of report.rootScores){
      assert.ok(Math.abs(root.leaf.valueReconstructionError)<1e-8);
      assert.ok(Math.abs(root.leaf.board.reconstructionError)<1e-8);
      assert.ok(Number.isFinite(root.leaf.total));
    }
  }
  assert.equal(active.diagnostics.offenseWeight,normal.diagnostics.offenseWeight);
  assert.equal(active.diagnostics.intermediateHoleRelief,
    normal.diagnostics.intermediateHoleRelief);
});

test('opt-in danger gate restores ordinary ROOK under publicly high stack',()=>{
  const e=new Engine({mode:'tl',seed:67313,rules:{g:0}});
  // A legitimate-looking, physically occupiable 12-cell-high surface.
  // No hidden hole / NEXT6 is introduced, and the root spawn remains legal.
  for(let y=e.state.board.rows.length-12;y<e.state.board.rows.length;y++)
    e.state.board.rows[y][0]='i';
  const v=visibleState(e.state),unchanged=structuredClone(v);
  const config={depth:3,beamWidth:12,maxNodes:1200,maxStates:420,
    maxSteps:42,spinForecast:false,futureReachableProbes:2,
    includeRanked:true};
  const baseline=chooseMove(v,config);
  const guarded=chooseMove(v,{...config,optionFrontierSlots:3,
    optionFrontierRiskGuard:true});
  assert.equal(guarded.diagnostics.optionFrontierRiskGuard,true);
  assert.equal(guarded.diagnostics.frontierSuppressed,true);
  assert.equal(guarded.diagnostics.effectiveFrontierSlots,0);
  assert.equal(guarded.diagnostics.optionFrontierStats.inserted,0);
  assert.equal(guarded.kind,baseline.kind);
  if(baseline.kind==='place'){
    assert.deepEqual(guarded.move,baseline.move);
    assert.deepEqual(guarded.execution,baseline.execution);
  }else assert.equal(guarded.mode,baseline.mode);
  assert.equal(guarded.diagnostics.value,baseline.diagnostics.value);
  assert.deepEqual(v,unchanged);
});
test('safe public boards retain full frontier under optional danger guard',()=>{
  const v=visibleState(new Engine({mode:'tl',seed:67310,
    rules:{g:0}}).state);
  const config={depth:3,beamWidth:12,maxNodes:1200,maxStates:420,
    maxSteps:42,spinForecast:false,futureReachableProbes:2};
  const exposed=chooseMove(v,{...config,optionFrontierSlots:3,
    optionFrontierRiskGuard:false});
  const guarded=chooseMove(v,{...config,optionFrontierSlots:3,
    optionFrontierRiskGuard:true});
  assert.equal(guarded.diagnostics.frontierSuppressed,false);
  assert.equal(guarded.diagnostics.effectiveFrontierSlots,3);
  // Apart from explicit guard diagnostics, safe policies are identical.
  assert.equal(guarded.kind,exposed.kind);
  assert.equal(guarded.diagnostics.value,exposed.diagnostics.value);
  assert.deepEqual(guarded.diagnostics.optionFrontierStats,
    exposed.diagnostics.optionFrontierStats);
  assert.throws(()=>chooseMove(v,{...config,optionFrontierRiskGuard:1}),
    /invalid search budget/);
});
