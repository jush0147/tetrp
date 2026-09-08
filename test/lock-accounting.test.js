import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.js';
import { legal } from '../src/board.js';

const grounded = () => {
  const e=new Engine(); e.slam(); e.trace=[];
  assert.equal(legal(e.state.board,{...e.state.piece,y:e.state.piece.y+1}),false);
  return e;
};
test('#4 interpretation: 14 grounded moves survive; fifteenth force-locks on Fall',()=>{
  const e=grounded();
  for(let i=0;i<14;i++) { assert.equal(e.move(i%2 ? 1 : -1),true); e.fall(.1); }
  assert.equal(e.state.piece.resets,14); assert.equal(e.state.stats.pieces,0);
  assert.equal(e.state.piece.rotationResets,0);
  e.move(-1); const old=e.state.piece; assert.equal(old.resets,15);
  assert.equal(e.state.stats.pieces,0); e.fall(.1);
  assert.equal(old.forceLock,true); assert.equal(e.state.stats.pieces,1);
});
test('#4 interpretation: grounded rotations reset timer but not movement quota',()=>{
  const e=grounded();
  for(let i=0;i<70;i++) {
    e.state.piece.locking=29;
    assert.equal(e.rotate(1),true); assert.equal(e.state.piece.locking,0);
    e.fall(.1);
    assert.equal(e.state.stats.pieces,0); assert.equal(e.state.piece.resets,0);
    assert.equal(e.state.piece.rotationResets,Math.min(63,i+1));
    assert.equal(e.state.piece.totalRotations,i+1);
  }
});
test('#4 interpretation: mixed actions preserve distinct counters and force-lock quota',()=>{
  const e=grounded();
  for(let i=0;i<14;i++) { e.move(i%2 ? 1 : -1); e.rotate(1); e.fall(.1); }
  assert.equal(e.state.piece.resets,14); assert.equal(e.state.piece.rotationResets,14);
  assert.equal(e.state.piece.totalRotations,14); assert.equal(e.state.stats.pieces,0);
  e.rotate(1); assert.equal(e.state.piece.resets,14);
  e.move(-1); e.fall(.1); assert.equal(e.state.stats.pieces,1);
});
test('#4 new low clears move/rotation reset counters but preserves total rotations',()=>{
  const e=new Engine(); Object.assign(e.state.piece,{y:30.96,hy:31});
  e.state.board.rows[32][4]=e.state.board.rows[32][5]='gb';
  for(let i=0;i<31;i++) e.rotate(1);
  e.move(-1); e.move(-1);
  assert.equal(e.state.piece.resets,2); assert.equal(e.state.piece.rotationResets,31);
  assert.equal(e.descend(.01),true); // Same ceil row is not a new historical low.
  assert.equal(e.state.piece.resets,2); assert.equal(e.state.piece.rotationResets,31);
  assert.equal(e.descend(1),true);
  assert.equal(e.state.piece.resets,0); assert.equal(e.state.piece.rotationResets,0);
  assert.equal(e.state.piece.totalRotations,31); assert.equal(e.state.piece.hy,32);
});
test('#4 anti-stall budget starts at rotresets 31, independent of totalRotations',()=>{
  for(const [count,expected] of [[30,17.96],[31,18.16],[35,18.96]]) {
    const e=new Engine({rules:{g:0}});
    Object.assign(e.state.piece,{rotationResets:count,totalRotations:0});
    e.fall(.4); assert.equal(e.state.piece.y,expected);
  }
  const e=new Engine({rules:{g:0}}); e.state.piece.totalRotations=63;
  e.fall(.4); assert.equal(e.state.piece.y,17.96);
});
test('#4 totalRotations kick-base switch: actual kicked rotation at 30 versus 31',()=>{
  for(const [total,y] of [[30,25.1],[31,25.96]]) {
    const e=new Engine();
    Object.assign(e.state.piece,{type:'t',x:4,y:25.96,r:0,totalRotations:total,rotationResets:0});
    e.state.board.rows[27][4]='gb';
    assert.equal(legal(e.state.board,e.state.piece),true);
    assert.equal(e.rotate(1),true); assert.equal(e.state.piece.x,3); assert.equal(e.state.piece.y,y);
    assert.equal(e.state.piece.rotationResets,1); assert.equal(e.state.piece.totalRotations,total+1);
  }
});
