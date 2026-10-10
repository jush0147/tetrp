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
  assert.equal(picked.details.modes.delivered,1);
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
