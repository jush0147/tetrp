import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';
import {schedulePlacement} from '../src/analysis/placement-transport.js';
import {BotDemo} from '../src/analysis/demo.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/transport/legacy-t-spin.json',import.meta.url)));
function setup(){
  const v=fixture.snapshot,e=new Engine({rules:v.rules}),s=e.state;
  s.board=structuredClone(v.board);s.piece=structuredClone(v.current);s.hold={...v.hold};
  s.bag.queue=[...v.next,'i','o'];s.frame=v.frame;
  Object.assign(s.attack,structuredClone(v.attack));s.stats.pieces=v.piecesPlaced;
  return e;
}
const cells=x=>x.map(([x,y])=>[x,Math.ceil(y)]).sort().toString();
test('Legacy T-spin regression: actual SDF 6 input events reach the first-choice spin, without changing handling',()=>{
  const e=setup(),before=e.serialize(),start=e.state.frame,end=start+23,locks=[];
  const inputs=schedulePlacement(e,fixture.action,end);
  assert.equal(e.serialize(),before,'planning must not mutate authority');
  const emit=e.emit;e.emit=function(t,d){if(t==='lock')locks.push({cells:B.cells(this.state.piece),spin:this.state.piece.spin,frame:this.state.frame,subframe:this.state.subframe});emit.call(this,t,d);};
  for(let f=start;f<=end;f++)e.step(inputs.filter(x=>x.frame===f));
  assert.equal(e.state.handling.sdf,6);assert.equal(locks.length,1);
  assert.equal(cells(locks[0].cells),cells(fixture.action.move.cells));
  assert.equal(locks[0].spin,'full');assert.equal(locks[0].frame,end);assert.equal(locks[0].subframe,.5);
  assert.equal(e.state.stats.lines,1);assert.equal(e.state.attack.totals.sent,2);
});
test('Bot Mode executes the same Legacy first-choice spin',()=>{
  const demo=new BotDemo(setup());demo.prepare(fixture.action,0);demo.commit(0);
  assert.equal(demo.view().lastPlacement.spin,'full');assert.equal(demo.view().lastPlacement.lines,1);
});
test('real event replay preserves the target across gravity and fractional spawn positions',()=>{
  for(const gravity of [.02,.1,.5,1,2])for(const offset of [0,.2,-.2]){
    const e=setup();e.state.g=gravity;e.state.piece.y+=offset;
    const start=e.state.frame,end=start+23,locks=[];
    const inputs=schedulePlacement(e,fixture.action,end);
    e.emit=function(t){if(t==='lock')locks.push({cells:B.cells(this.state.piece),spin:this.state.piece.spin,frame:this.state.frame});};
    for(let f=start;f<=end;f++)e.step(inputs.filter(x=>x.frame===f));
    assert.equal(locks.length,1);assert.equal(locks[0].frame,end);
    assert.equal(cells(locks[0].cells),cells(fixture.action.move.cells));assert.equal(locks[0].spin,'full');
  }
});
test('transport fails closed when cadence cannot accommodate descent',()=>{
  const e=setup(),before=e.serialize();
  assert.throws(()=>schedulePlacement(e,fixture.action,e.state.frame),/No authority-verified/);
  assert.equal(e.serialize(),before);
});
test('grounded reset-heavy paths lock exactly once at the scheduled instant',()=>{
  const e=new Engine({seed:779,rules:{g:0,gincrease:0},handling:{safelock:false}});
  e.slam();const expected=B.cells(e.state.piece);
  const action={move:{cells:expected},execution:{spin:'none',moves:[...Array.from({length:16},(_,i)=>i%2?'moveRight':'moveLeft'),'hardDrop']}};
  const inputs=schedulePlacement(e,action,23);
  for(let f=0;f<24;f++)e.step(inputs.filter(x=>x.frame===f));
  const locks=e.trace.filter(x=>x.type==='lock');
  assert.equal(locks.length,1);assert.equal(locks[0].frame,23);assert.equal(locks[0].subframe,.5);
});
