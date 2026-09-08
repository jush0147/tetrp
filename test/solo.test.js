import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, UnknownBehavior } from '../src/engine.js';
import { blitzGravity } from '../src/rules.js';

function frame(game,key,down=true) {
  game.step([{frame:game.state.frame,subframe:0.2,key,type:down?'keydown':'keyup'}]);
}
function tap(game,key) { frame(game,key); frame(game,key,false); }
function place(game,index) {
  if(index===2) tap(game,'hold');
  const target=index===0 ? 4 : [1,4,7][index%3];
  while(game.state.piece.x!==target) tap(game,game.state.piece.x<target?'moveRight':'moveLeft');
  tap(game,'hardDrop');
}
function singleWell(mode) {
  const game=new Engine({mode,seed:1}); // First seeded piece is O.
  game.state.board.rows[39].fill('gb');
  game.state.board.rows[39][4]=game.state.board.rows[39][5]=null;
  return game;
}
for(const mode of ['40l','blitz']) test(`#3 ${mode}: 12 seeded placements, clear, hold and restored continuation`,()=>{
  const a=singleWell(mode), b=singleWell(mode);
  const initialHoleSeed=a.state.holes.rng.seed;
  place(a,0); place(b,0);
  assert.equal(a.state.stats.lines,1);
  assert.deepEqual(a.state.board.rows[39],[null,null,null,null,'o','o',null,null,null,null]);
  let restored=Engine.restore(a.serialize());
  for(let i=1;i<12;i++) {
    place(a,i); place(b,i); place(restored,i);
    assert.equal(a.state.playing,true,`unexpected topout at piece ${i}`);
    assert.equal(a.state.stats.pieces,i+1);
    assert.equal(a.serialize(),b.serialize()); assert.equal(a.serialize(),restored.serialize());
    restored=Engine.restore(restored.serialize());
  }
  assert.equal(a.state.stats.holds,1);
  assert.equal(a.state.attack,null); assert.equal(a.state.stats.score,null);
  assert.ok(a.state.stats.dropScore>0);
  assert.deepEqual(a.state.conformance,{aggregateScore:'unknown',attack:'unknown',b2b:'unknown'});
  assert.equal(a.state.holes.rng.seed,initialHoleSeed);
  assert.equal(a.trace.some(x=>x.type==='attack'||x.type==='tank'),false);
  assert.throws(()=>a.receive({from:'P2',iid:1,amt:4}),UnknownBehavior);
});
test('#3 40L: known checkpoint at 39 lines finishes objective on the next clear',()=>{
  const a=singleWell('40l'); a.state.stats.lines=39;
  const restored=Engine.restore(a.serialize());
  tap(a,'hardDrop'); tap(restored,'hardDrop');
  assert.equal(a.state.stats.lines,40); assert.equal(a.state.success,true); assert.equal(a.state.playing,false);
  assert.equal(a.serialize(),restored.serialize()); assert.equal(a.state.stats.score,null);
});
test('#3 Blitz: placement crosses multiple known thresholds, restores gravity and progress',()=>{
  const a=new Engine({mode:'blitz',seed:1});
  // Synthetic legal pre-placement checkpoint: vertical I completes four rows.
  Object.assign(a.state.piece,{type:'i',x:3,y:36.96,r:1});
  for(let y=36;y<40;y++) { a.state.board.rows[y].fill('gb'); a.state.board.rows[y][4]=null; }
  a.state.stats.levelLines=2;
  a.state.stats.lines=2;
  const b=Engine.restore(a.serialize());
  tap(a,'hardDrop'); tap(b,'hardDrop');
  assert.equal(a.state.stats.lines,6); assert.equal(a.state.stats.level,2);
  assert.equal(a.state.stats.levelLines,3); assert.equal(a.state.g,blitzGravity(2));
  assert.equal(a.state.board.rows.flat().filter(Boolean).length,0);
  // A second supplied near-threshold checkpoint tests the progression loop:
  // level 1 needs 3, level 2 needs 5; 2 prior + 6 clearable rows crosses both.
  const c=new Engine({mode:'blitz'}); c.state.stats.levelLines=2;
  for(let y=34;y<40;y++) c.state.board.rows[y].fill('gb');
  c.lock();
  assert.equal(c.state.stats.level,3); assert.equal(c.state.stats.levelLines,0); assert.equal(c.state.g,blitzGravity(3));
  const continued=Engine.restore(a.serialize());
  for(let i=1;i<6;i++) { place(a,i); place(b,i); place(continued,i); }
  assert.equal(a.serialize(),b.serialize()); assert.equal(a.serialize(),continued.serialize());
});
test('#3 Blitz: timed objective survives checkpoint at final frame',()=>{
  const a=new Engine({mode:'blitz'}); a.state.frame=7199;
  const b=Engine.restore(a.serialize()); a.step(); b.step();
  assert.equal(a.state.success,true); assert.equal(a.serialize(),b.serialize());
});
test('#3 solo checkpoint cannot silently claim known score or TL attacks',()=>{
  const s=JSON.parse(new Engine({mode:'40l'}).serialize());
  for(const change of [v=>v.stats.score=0,v=>v.conformance.b2b='covered-tl',v=>v.attack={}]) {
    const mutated=structuredClone(s); change(mutated);
    assert.throws(()=>Engine.restore(JSON.stringify(mutated)),TypeError);
  }
  s.schema='tetrp-engine/1'; assert.throws(()=>Engine.restore(JSON.stringify(s)),/version/);
});
