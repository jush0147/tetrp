import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {createAttack,resolveAttack} from '../src/attack.js';
import {createHoles} from '../src/random.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {advanceCombatClock,forecastPublicTank,projectCombat,visibleCombat} from '../src/analysis/rook-combat.js';
import {chooseMove} from '../src/analysis/rook.js';

const lockClear={lines:2,spin:'full',allClear:false,garbageRows:0};

test('public clock matches 24 real engine frames, including timed packet activation and multiplier',()=>{
  const e=new Engine({mode:'tl',seed:42,rules:{g:0,garbagemargin_frames:8,
    garbageincrease_per_second:.6}});
  const cid=e.receive({from:'P2',iid:1,amt:7});
  e.confirm(cid);
  const visible=visibleState(e.state),initial=visibleCombat(visible);
  assert.equal(initial.pending[0].active,false);
  const predicted=advanceCombatClock(initial,visible.frame,24,e.state.rules);
  for(let i=0;i<24;i++)e.step([]);
  assert.equal(e.state.frame,24);
  assert.equal(predicted.multiplier,e.state.attack.multiplier);
  assert.equal(predicted.pending[0].active,true);
  assert.equal(predicted.pending[0].active,e.state.attack.pending[0].active);
  assert.equal(initial.pending[0].active,false,'public source must remain unmodified');
  assert.equal(visible.attack.pending[0].active,false);
});

test('clock-advanced TSD attack, cancellation and blocking match authoritative attack',()=>{
  const e=new Engine({mode:'tl',seed:44,rules:{g:0,garbagemargin_frames:5,
    garbageincrease_per_second:1.2,b2bcharge_base:3}});
  const cid=e.receive({from:'P2',iid:1,amt:8});
  e.confirm(cid);
  const before=visibleState(e.state);
  const ahead=advanceCombatClock(visibleCombat(before),before.frame,24,e.state.rules);
  for(let i=0;i<24;i++)e.step([]);
  const projected=projectCombat(ahead,lockClear,e.state.rules);
  const actual=resolveAttack(e.state.attack,lockClear,e.state.rules,e.state.holes);
  assert.equal(projected.blocked,actual.blocked);
  assert.equal(projected.offensive,
    [...actual.surge,actual.normal,actual.all_clear].filter(Boolean).reduce((v,p)=>v+p.sent,0));
  assert.equal(projected.combat.multiplier,e.state.attack.multiplier);
  assert.equal(projected.combat.btb,e.state.attack.btb);
  assert.equal(projected.pending,e.state.attack.pending.reduce((n,p)=>n+p.amt,0));
  assert.equal(forecastPublicTank(projected.combat,projected.blocked,e.state.rules).amount,0,
    'combo blocking defers incoming even if cancellation did not consume all');
});

test('a public packet tank forecast respects activation, shields and cap without hole inference',()=>{
  const e=new Engine({mode:'tl',seed:45,rules:{g:0,garbagecap:4,garbagecapmax:8}});
  const s={...createAttack(),live:true};
  s.pending=[
    {amt:3,active:true,status:'spawn',shielded:false,hardened:true},
    {amt:8,active:true,status:'spawn',shielded:false,hardened:false},
    {amt:10,active:true,status:'spawn',shielded:true,hardened:false}
  ];
  assert.deepEqual(forecastPublicTank(s,false,e.state.rules),
    {amount:4,unknownHole:true});
  assert.equal(forecastPublicTank(s,true,e.state.rules).amount,0);
  s.pending[0].active=false;
  assert.equal(forecastPublicTank(s,false,e.state.rules).amount,4);
  s.pending[1].active=false;
  assert.equal(forecastPublicTank(s,false,e.state.rules).amount,0);
});

test('search halts uncertain future board after a public garbage arrival',()=>{
  const e=new Engine({mode:'tl',seed:12,rules:{g:0}});
  e.state.hold.locked=true;
  const cid=e.receive({from:'P2',iid:1,amt:3});
  e.confirm(cid);
  const visible=visibleState(e.state);
  const options={depth:3,beamWidth:6,maxNodes:700,maxStates:450,
    futureReachable:false,spinForecast:false,tsdTacticalProbes:0};
  const result=chooseMove(visible,options);
  assert.equal(result.kind,'place');
  assert.equal(result.diagnostics.selectedUnresolvedGarbage,true);
  assert.equal(result.diagnostics.selectedForecastTank,3);
  assert.equal(result.diagnostics.selectedFrame,24);
  assert.ok(result.diagnostics.unresolvedTankNodes>0);
  const poisoned={...structuredClone(visible),hiddenGarbageHole:4,
    nextAfterFive:['t','t','t'],opponent:{futureAttack:99}};
  assert.deepEqual(chooseMove(poisoned,options),result);
});
