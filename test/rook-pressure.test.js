import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove} from '../src/analysis/rook.js';

const options={depth:4,beamWidth:24,maxNodes:4500,maxStates:1200,
  spinForecast:false,tsdTacticalProbes:0,reversePlanner:true,
  reverseOnlyOpen:true,reverseOpenMaxTileNodes:1200};
const start=()=>new Engine({mode:'tl',seed:39589,
  rules:{g:0,spinbonuses:'all-mini+',b2bcharge_base:3}});

test('public pending packet invalidates a speculative five-piece TSD line',()=>{
  const e=start(),original=e.serialize();
  const clean=chooseMove(visibleState(e.state),options);
  assert.ok(clean.diagnostics.reversePlans>0);
  assert.equal(clean.diagnostics.reverseSkippedPressure,false);
  const cid=e.receive({from:'P2',iid:1,ackiid:0,amt:4});
  e.confirm(cid);
  const visible=visibleState(e.state);
  assert.equal(visible.attack.pending[0].activeFrame,visible.frame+20);
  const pressured=chooseMove(visible,options);
  const ordinary=chooseMove(visible,{...options,reversePlanner:false});
  assert.equal(pressured.diagnostics.reverseSkippedPressure,true);
  assert.equal(pressured.diagnostics.reverseThreat,4);
  assert.equal(pressured.diagnostics.reversePlans,0);
  assert.deepEqual(pressured.move,ordinary.move);
  assert.equal(pressured.diagnostics.evaluated,ordinary.diagnostics.evaluated);
  assert.notEqual(e.serialize(),original,'authority received public packet');
});
test('future activation after setup completes preserves the verified TSD',()=>{
  const e=start(),v=visibleState(e.state);
  v.attack.pending.push({amt:3,active:false,activeFrame:v.frame+500,
    hardened:false,shielded:false,status:'spawn'});
  const clear=chooseMove(v,options);
  assert.equal(clear.diagnostics.reverseSkippedPressure,false);
  assert.ok(clear.diagnostics.reversePlans>0);
  assert.equal(clear.diagnostics.reverseThreat,0);
});
test('opt-out A/B remains public-only even with private-looking injected fields',()=>{
  const e=start(),cid=e.receive({from:'P2',iid:1,ackiid:0,amt:5});
  e.confirm(cid);
  const v=visibleState(e.state),before=e.serialize();
  const ungated=chooseMove(v,{...options,reversePressureGuard:false});
  const poisoned=chooseMove({...structuredClone(v),rng:12345,
    hiddenBag:['t','t'],opponent:{futureAttack:55}},
    {...options,reversePressureGuard:false});
  assert.ok(ungated.diagnostics.reversePlans>0);
  assert.deepEqual(ungated,poisoned);
  assert.equal(e.serialize(),before);
});
