import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {RookSession} from '../src/analysis/rook-session.js';
import {chooseMove} from '../src/analysis/rook.js';

// An executable no-spin target derived only from the player-visible snapshot.
function hardDrop(v){
  let p={...v.current};
  while(B.legal(v.board,{...p,y:p.y+1}))p={...p,y:p.y+1};
  return {kind:'place',move:{piece:p.type,x:p.x,y:Math.ceil(p.y),rotation:p.r,
    useHold:false,cells:B.cells(p).map(([x,y])=>[x,Math.ceil(y)])},
    execution:{moves:['hardDrop'],spin:p.spin}};
}
function holdAction(v){
  return {kind:'hold',mode:v.hold.piece===null?'empty':'occupied',
    samePiece:(v.hold.piece??v.next[0])===v.current.type,
    requiresReanalysis:true};
}
function assertVisible(v){
  assert.equal(v.next.length,5);
  for(const key of ['rng','holes','bag','history','opponent','replay','queuedInputs']){
    assert.equal(Object.hasOwn(v,key),false,'private key '+key);
  }
}

test('empty Hold consumes an authority draw, reveals NEXT5, then decides again with Hold locked',()=>{
  const original=new Engine({seed:42,mode:'tl',rules:{g:0,b2bcharge_base:3}});
  const initial=original.serialize(),hidden=original.state.bag.queue[5];
  const observed=[];
  const session=new RookSession(original,{decide:v=>{
    assertVisible(v);observed.push(structuredClone(v));
    return observed.length===1?holdAction(v):hardDrop(v);
  }});
  const answer=session.step();
  assert.deepEqual(answer.actions.map(x=>x.kind),['hold','place']);
  assert.equal(answer.decisions,2);
  assert.equal(observed.length,2);
  assert.equal(observed[0].hold.piece,null);
  assert.equal(observed[1].hold.piece,observed[0].current.type);
  assert.equal(observed[1].hold.locked,true);
  assert.equal(observed[1].current.type,observed[0].next[0]);
  assert.deepEqual(observed[1].next.slice(0,4),observed[0].next.slice(1));
  assert.equal(observed[1].next[4],hidden);
  assert.equal(answer.view.index,1);
  assert.equal(answer.view.visible.hold.locked,false);
  assert.equal(original.serialize(),initial,'recorded checkpoint must remain unchanged');
});

test('occupied same-piece Hold consumes no draw but still triggers post-Hold decision',()=>{
  const e=new Engine({seed:13,mode:'tl',rules:{g:0}});
  e.state.hold.piece=e.state.piece.type;e.state.hold.locked=false;
  const original=e.serialize(),snapshots=[];
  const session=new RookSession(e,{decide:v=>{
    assertVisible(v);snapshots.push(structuredClone(v));
    return snapshots.length===1?holdAction(v):hardDrop(v);
  }});
  const r=session.step();
  assert.deepEqual(r.actions.map(a=>a.kind),['hold','place']);
  assert.equal(snapshots[1].current.type,snapshots[0].current.type);
  assert.deepEqual(snapshots[1].next,snapshots[0].next);
  assert.equal(snapshots[1].hold.locked,true);
  assert.equal(e.serialize(),original);
});

test('a second Hold is forbidden and cannot sneak past Tetrp root Hold lock',()=>{
  const e=new Engine({seed:47,rules:{g:0}});
  const session=new RookSession(e,{decide:v=>holdAction(v)});
  assert.throws(()=>session.step(),/second Hold/);
  assert.equal(session.view().index,0,'no placement committed');
  assert.equal(session.view().visible.hold.locked,true,'first real Hold is preserved');
});

test('hidden tail and private RNG changes do not affect any pre-reveal decision',()=>{
  const e=new Engine({seed:19,rules:{g:0}});
  const altered=Engine.restore(e.serialize());
  altered.state.bag.queue[5]=altered.state.bag.queue[5]==='t'?'z':'t';
  altered.state.bag.rng.seed=1337;
  altered.state.holes.rng.seed=3141;
  const seenA=[],seenB=[];
  const decision=target=>v=>{assertVisible(v);target.push(structuredClone(v));return hardDrop(v)};
  const a=new RookSession(e,{decide:decision(seenA)});
  const b=new RookSession(altered,{decide:decision(seenB)});
  assert.deepEqual(seenA,[]);
  const actionA=a.step(),actionB=b.step();
  assert.deepEqual(seenA,seenB);
  assert.deepEqual(actionA.actions,actionB.actions);
  assert.notDeepEqual(a.view().visible.next,b.view().visible.next,
    'hidden NEXT may differ only after Tetrp actually reveals it');
});

test('same allowed snapshot yields identical ROOK decisions even when private data differs',()=>{
  const e=new Engine({seed:31,rules:{g:0}});
  const v=visibleState(e.state);
  const a=chooseMove(v,{depth:2,beamWidth:4,maxNodes:400,maxStates:400});
  const b=chooseMove({...v,secretFuture:['t','t'],history:'private',opponent:{board:'private'}},
    {depth:2,beamWidth:4,maxNodes:400,maxStates:400});
  assert.deepEqual(a,b);
});

test('at least eight consecutive real authority locks progressively refill NEXT5',()=>{
  const e=new Engine({seed:99,mode:'tl',rules:{g:0,b2bcharge_base:3}});
  const original=e.serialize(),observed=[];
  const session=new RookSession(e,{options:{depth:1,beamWidth:6,maxNodes:600,maxStates:600},
    decide:(v,options)=>{assertVisible(v);observed.push(v.next.slice());return chooseMove(v,options);}});
  for(let i=0;i<8;i++){
    const r=session.step();
    assert.equal(r.view.index,i+1);
    assert.equal(r.view.visible.next.length,5);
    assert.equal(r.view.visible.hold.locked,false);
    assert.equal(e.serialize(),original);
  }
  assert.equal(observed.length>=8,true);
  assert.notDeepEqual(observed[0],observed.at(-1));
});
