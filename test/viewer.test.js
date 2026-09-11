import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {cells} from '../src/board.js';
import {parseReplay,prepareReplay,Reconstruction,selectPlayer} from '../src/replay/index.js';
import {ViewerSession,catalog,MAX_FRAMES} from '../viewer/session.js';
import {boardModel} from '../viewer/render.js';
import {PlaybackClock,displayStats,placementLabel} from '../viewer/playback.js';

test('playback clock uses 60 source frames per second with continuous speed changes',()=>{
  for(const speed of [.5,1,1.5]){
    const c=new PlaybackClock();c.setSpeed(speed,0);c.start(12,100);
    assert.equal(c.target(1100,1000),12+60*speed);
    const paused=c.pause(1600);assert.equal(c.position(10000),paused);
    c.start(paused,10000);assert.equal(c.position(11000),paused+60*speed);
    assert.equal(c.target(100000,90),90);
  }
  const c=new PlaybackClock();c.start(0,0);c.setSpeed(.5,1000);
  assert.equal(c.position(2000),90);c.setSpeed(1.5,2000);assert.equal(c.position(3000),180);
  assert.throws(()=>c.setSpeed(2,0),RangeError);
});
test('stats disclose unknown values and spin labels include non-T and mini spins',()=>{
  const state=new Engine().state;state.frame=120;state.subframe=0;state.stats.pieces=8;
  assert.equal(displayStats(state).pps,4);
  assert.equal(displayStats(state).b2b,state.attack.btb);
  state.attack.totals.received=9;state.attack.totals.tanked=3;
  assert.equal(displayStats(state).received,9);
  state.attack=null;state.stats.score=null;
  assert.equal(displayStats(state).apm,null);assert.equal(displayStats(state).score,null);
  assert.equal(placementLabel({piece:'t',spin:'mini',lines:1}),'T-SPIN MINI · SINGLE');
  assert.equal(placementLabel({piece:'j',spin:'full',lines:2}),'J-SPIN · DOUBLE');
  assert.equal(placementLabel({piece:'i',spin:'none',lines:4}),'QUAD');
});

export function syntheticReplay(){return {version:1,gamemode:'40l',replay:{frames:90,options:{version:15,seed:42,handling:{safelock:false}},
  events:[{frame:0,type:'start',data:{}},...Array.from({length:6},(_,i)=>[
    {frame:i*12+1,type:'keydown',data:{key:'hardDrop',subframe:.2}},
    {frame:i*12+2,type:'keyup',data:{key:'hardDrop',subframe:.4}},
  ]).flat(),{frame:90,type:'end',data:{reason:'clear'}}]}};}
test('viewer index and repeated placement/frame seeks use the stable reconstruction state',async()=>{
  const replay=parseReplay(JSON.stringify(syntheticReplay()));
  assert.deepEqual(catalog(replay),[{index:0,players:[{index:0,name:'ID 1'}]}]);
  const viewer=new ViewerSession(replay,0,0);assert.equal(await viewer.initialize(),true);assert.equal(viewer.total,6);
  const reference=new Reconstruction(prepareReplay(selectPlayer(replay)));
  reference.seekPlacement(1);
  const checkpoint=reference.checkpoint();
  const lock=reference.transitions.find(t=>t.type==='lock');assert.equal(lock.placementIndex,1);
  lock.piece='changed diagnostic only';assert.equal(reference.checkpoint(),checkpoint);
  const restored=Reconstruction.restore(checkpoint);assert.deepEqual(restored.transitions,[]);
  assert.deepEqual(restored.run(),reference.run());
  assert.deepEqual(reference.transitions,[]);
  assert.equal(viewer.placements.size,6);
  for(const [index,p] of viewer.placements){assert.equal(p.index,index);assert.match(p.piece,/^[ijszotl]$/);assert.equal(p.lines,0);}
  for(const n of [0,3,6,3,0,6])assert.deepEqual(viewer.seek('placement',n),reference.seekPlacement(n));
  for(const n of [0,20,90,20])assert.deepEqual(viewer.seek('frame',n),reference.seekFrame(n));
  assert.throws(()=>viewer.seek('placement',7),RangeError);
  const copy=viewer.result();copy.state.board.rows[39][0]='gb';assert.notDeepEqual(viewer.result().state,copy.state);
});
test('render model clips buffer rows, uses engine cells/ceil, and never mutates state',()=>{
  const e=new Engine();e.state.board.rows[0][0]='gb';e.state.board.rows[20][0]='t';
  Object.assign(e.state.piece,{type:'t',x:4,y:20.1,r:2});
  const bytes=e.serialize(),m=boardModel(e.state);
  assert.equal(m.rows.length,20);assert.equal(m.rows[0][0],'t');
  assert.deepEqual(m.active,cells(e.state.piece).map(([x,y])=>[x,Math.ceil(y)-20]));
  assert.deepEqual(m.next,e.state.bag.queue.slice(0,e.state.rules.nextcount));
  m.rows[0][0]=null;m.hold.piece='i';assert.equal(e.serialize(),bytes);
  e.state.piece.sleeping=true;assert.deepEqual(boardModel(e.state).active,[]);
});
test('viewer cancellation yields and stream replacement does not reuse state',async()=>{
  const x=syntheticReplay();x.replay.frames=1000;x.replay.events.at(-1).frame=1000;
  const replay=parseReplay(JSON.stringify(x)),a=new ViewerSession(replay,0,0);
  let cancelled=false;assert.equal(await a.initialize({yieldTask:async()=>{cancelled=true;},cancelled:()=>cancelled}),false);
  const b=new ViewerSession(replay,0,0);await b.initialize();assert.equal(b.result().state.stats.pieces,0);
  const tooLong=syntheticReplay();tooLong.replay.frames=MAX_FRAMES+1;
  assert.throws(()=>new ViewerSession(parseReplay(JSON.stringify(tooLong)),0,0),/一小時/);
});
