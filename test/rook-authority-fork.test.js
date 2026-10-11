import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';

const makeDemo=()=>new BotDemo(new Engine({
  mode:'tl',seed:67920,rules:{g:0,gincrease:0,b2bcharge_base:3},
  handling:{arr:0,das:1,dcd:0,sdf:20,safelock:false,
    cancel:false,may20g:true,irs:'off',ihs:'off'}
}),{placementMode:'atomic'});

test('authority fork keeps exact private futures without initializing new RNG',()=>{
  const parent=makeDemo();
  const original=parent.engine.serialize();
  const a=parent.fork(),b=parent.fork();
  assert.deepEqual(a.engine.serialize(),original);
  assert.deepEqual(b.engine.serialize(),original);
  assert.deepEqual(a.view().visible,parent.view().visible);
  assert.notStrictEqual(a.engine,parent.engine);
  assert.notStrictEqual(a.engine.state.bag,parent.engine.state.bag);
  assert.notStrictEqual(a.engine.state.holes,parent.engine.state.holes);
  assert.equal(a.history.length,1);
  const before=a.view();
  a.prepare({action:{kind:'hold',mode:'empty'}},before.revision);
  assert.throws(()=>a.fork(),/prepared/);
  a.commit(before.revision);
  assert.deepEqual(parent.engine.serialize(),original);
  assert.deepEqual(b.engine.serialize(),original);
  assert.notDeepEqual(a.engine.serialize(),original);
  assert.deepEqual(a.view().visible.hold.piece,
    before.visible.current.type);
});

test('each fork has its own history, revision and pending action',()=>{
  const parent=makeDemo(),child=parent.fork();
  assert.equal(child.index,0);
  assert.equal(child.revision,0);
  assert.equal(child.pending,null);
  assert.equal(child.placementMode,'atomic');
  const v=child.view();
  child.prepare({action:{kind:'hold',mode:'empty'}},v.revision);
  child.commit(v.revision);
  assert.equal(child.revision,1);
  assert.equal(parent.revision,0);
  assert.equal(parent.pending,null);
  assert.equal(parent.view().visible.hold.piece,null);
});
