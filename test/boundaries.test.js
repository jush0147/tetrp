import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.js';
import { ruleset } from '../src/rules.js';
import { createBoard, pushLine } from '../src/board.js';
import { createAttack, resolveAttack } from '../src/attack.js';
import { createHoles } from '../src/random.js';

test('late multiplier growth preserves start-of-frame boundary', () => {
  const e = new Engine(); e.state.frame=10800;
  e.step(); assert.equal(e.state.attack.multiplier,1);
  e.step(); assert.equal(e.state.attack.multiplier,1+.008/60);
});
test('strict waiting targets do not catch up missed entries', () => {
  const e = new Engine(); e.schedule(0,'incoming-attack-hit',{cid:999}); e.step();
  assert.equal(e.state.waiting.length,1);
});
test('ARE spawn resolves IRS before first blockout; direct spawn checks before IRS', () => {
  const setup = () => {
    const e=new Engine(); e.state.board.rows[18][3]='gb'; e.state.initial.irs=1; return e;
  };
  const direct=setup(); direct.spawn('t',false); assert.equal(direct.state.playing,false);
  const delayed=setup(); delayed.spawn('t',true); assert.equal(delayed.state.playing,true); assert.equal(delayed.state.piece.r,1);
});
test('lockout remains distinct from nolockout and garbage blockout reason', () => {
  const e = new Engine({rules:{nolockout:false}}); e.lock(); assert.equal(e.state.reason,'lockout');
  const allowed = new Engine(); allowed.lock(); assert.notEqual(allowed.state.reason,'lockout');
  const smash=new Engine(); smash.state.board.rows[18].fill('gb'); smash.state.board.lastWasAttack=true; smash.spawn('o');
  assert.equal(smash.state.reason,'garbagesmash');
});
test('garbage insertion locations preserve permanent material boundaries', () => {
  for(const position of ['aboveStack','aboveUnclearable','abovePerma']) {
    const b=createBoard(); b.rows[30].fill('gbd'); b.rows[25][0]='t';
    pushLine(b,2,{position});
    const row=position==='aboveStack' ? 24 : 29;
    assert.equal(b.rows[row][2],null); assert.equal(b.rows[row][0],'gb'); assert.equal(b.rows.length,40);
  }
});
test('none blocking sends directly while limited blocking cancels without blocking', () => {
  for(const blocking of ['none','limited blocking']) {
    const s=createAttack(); s.pending.push({amt:8,active:true,status:'spawn',column:null});
    const result=resolveAttack(s,{lines:4,spin:'none'},ruleset('tl',{garbageblocking:blocking}),createHoles(1));
    assert.equal(result.blocked,false);
    assert.equal(result.normal.sent,blocking==='none' ? 4 : 0);
    assert.equal(result.normal.cancelled,blocking==='none' ? 0 : 8);
  }
});
test('malformed input/checkpoint and unsupported options fail explicitly', () => {
  const e=new Engine();
  for(const data of [{frame:0,key:'wat',type:'keydown',subframe:0},{frame:1,key:'hold',type:'keydown',subframe:0},{frame:0,key:'hold',type:'keydown',subframe:1}]) assert.throws(()=>e.step([data]),TypeError);
  for(const mutate of [s=>s.schema='other',s=>s.g=null,s=>s.bag.rng.seed=0,s=>s.piece.type='i5',s=>s.board.rows.pop(),s=>s.waiting.push({type:'callback',target:1})]) {
    const s=JSON.parse(e.serialize()); mutate(s); assert.throws(()=>Engine.restore(JSON.stringify(s)),TypeError);
  }
  assert.throws(()=>new Engine({rules:{garbagequeue:true}}),/Unsupported/);
  assert.throws(()=>new Engine({rules:{lineclear_are:10}}),/Unknown/);
  assert.throws(()=>new Engine({rules:{madeUp:1}}),/Unknown/);
  assert.throws(()=>new Engine({seed:0}),RangeError);
});
test('canonical bytes disregard object property order and restore has no shared references', () => {
  const e=new Engine(), s=JSON.parse(e.serialize());
  const shuffled=Object.fromEntries(Object.entries(s).reverse());
  const restored=Engine.restore(JSON.stringify(shuffled)); assert.equal(restored.serialize(),e.serialize());
  restored.state.board.rows[39][0]='t'; assert.equal(e.state.board.rows[39][0],null);
});
