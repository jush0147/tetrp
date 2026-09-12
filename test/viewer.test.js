import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {cells} from '../src/board.js';
import {parseReplay,prepareReplay,Reconstruction,selectPlayer} from '../src/replay/index.js';
import {ViewerSession,catalog,MAX_FRAMES} from '../viewer/session.js';
import {boardModel} from '../viewer/render.js';
import {PlaybackClock,displayStats,placementLabel,incomingGarbage,visibleGarbage} from '../viewer/playback.js';
import {receive,tank,fight,resolveAttack} from '../src/attack.js';

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
  assert.equal(displayStats(state).b2b,Math.max(0,state.attack.btb-1));
  state.attack.totals.received=9;state.attack.totals.tanked=3;
  assert.equal(displayStats(state).received,9);
  state.attack=null;state.stats.score=null;
  assert.equal(displayStats(state).apm,null);assert.equal(displayStats(state).score,null);
  assert.equal(placementLabel({piece:'t',spin:'mini',lines:1}),'T-SPIN MINI · SINGLE');
  assert.equal(placementLabel({piece:'j',spin:'full',lines:2}),'J-SPIN · DOUBLE');
  assert.equal(placementLabel({piece:'i',spin:'none',lines:4}),'QUAD');
  assert.equal(placementLabel({piece:'o',spin:'none',lines:2,allClear:true}),'ALL CLEAR · DOUBLE');
  assert.equal(placementLabel({piece:'t',spin:'full',lines:2,allClear:true}),'ALL CLEAR · T-SPIN · DOUBLE');
});
test('All Clear observation survives repeated seeks and does not leak onto the next placement',async()=>{
  const viewer=new ViewerSession(parseReplay(JSON.stringify(syntheticReplay())),0,0);
  // Synthetic pre-placement checkpoint: O completes and empties the last two rows.
  const e=new Engine({mode:'40l',seed:1});
  for(const y of [38,39]){e.state.board.rows[y].fill('gb');e.state.board.rows[y][4]=e.state.board.rows[y][5]=null;}
  viewer.session=new Reconstruction({...viewer.session.timeline,initial:e.serialize()});
  await viewer.initialize();
  for(const n of [1,2,1,0,1]){
    viewer.seek('placement',n);const result=viewer.result();
    assert.equal(Boolean(result.lastPlacement?.allClear),n===1);
    assert.equal(placementLabel(result.lastPlacement).includes('ALL CLEAR'),n===1);
    if(n===1){assert.equal(result.lastPlacement.lines,2);assert.equal(result.state.board.rows.flat().filter(Boolean).length,0);}
  }
  viewer.seek('frame',0);assert.equal(viewer.result().lastPlacement,null);
  viewer.seek('frame',3);assert.equal(viewer.result().lastPlacement.allClear,true);
});

export function syntheticReplay(){return {version:1,gamemode:'40l',replay:{frames:90,options:{version:15,seed:42,handling:{safelock:false}},
  events:[{frame:0,type:'start',data:{}},...Array.from({length:6},(_,i)=>[
    {frame:i*12+1,type:'keydown',data:{key:'hardDrop',subframe:.2}},
    {frame:i*12+2,type:'keyup',data:{key:'hardDrop',subframe:.4}},
  ]).flat(),{frame:90,type:'end',data:{reason:'clear'}}]}};}

async function garbageNavigation(events,engine=new Engine({mode:'tl',seed:42,safelock:false})){
  const viewer=new ViewerSession(parseReplay(JSON.stringify(syntheticReplay())),0,0);
  viewer.session=new Reconstruction({schema:'tetrp-timeline/1',id:'synthetic-navigation',frames:100,initial:engine.serialize(),events});
  await viewer.initialize();return viewer;
}
const drops=[{frame:1,type:'keydown',key:'hardDrop',subframe:.2},{frame:2,type:'keyup',key:'hardDrop',subframe:.2},
  {frame:40,type:'keydown',key:'hardDrop',subframe:.2},{frame:41,type:'keyup',key:'hardDrop',subframe:.2}];
const packet=(frame,cid,amt)=>[{frame,type:'receive',remoteCid:cid,data:{from:'peer',iid:cid,ackiid:0,amt}},
  {frame,type:'confirm',remoteCid:cid}];
test('manual navigation exposes unseen tank once, restores both directions, and leaves direct seeks unchanged',async()=>{
  const viewer=await garbageNavigation([...drops.slice(0,2),...packet(5,1,2),...packet(6,2,3),...drops.slice(2)]);
  viewer.seek('placement',1);const before=viewer.result().state;
  const paused=viewer.step(1);assert.equal(paused.stats.pieces,1);assert.equal(incomingGarbage(paused).total,5);
  assert.equal(paused.attack.totals.tanked,0);assert.equal(viewer.result().navigationStop,'incoming');
  const finished=viewer.step(1);assert.equal(finished.stats.pieces,2);assert.equal(finished.attack.totals.tanked,5);
  assert.equal(viewer.result().navigationStop,null);
  assert.deepEqual(viewer.step(-1),paused);assert.deepEqual(viewer.step(-1),before);
  assert.deepEqual(viewer.step(1),paused);assert.deepEqual(viewer.step(1),finished);
  assert.deepEqual(viewer.seek('placement',2),finished);assert.equal(viewer.result().navigationStop,null);
  viewer.seek('frame',30);assert.equal(incomingGarbage(viewer.result().state).total,5);
  assert.deepEqual(viewer.step(1),finished);assert.equal(viewer.result().navigationStop,null);
});
test('manual navigation does not stop for packets that stay pending or never tank',async()=>{
  const viewer=await garbageNavigation([...drops.slice(0,2),...packet(39,1,2),...drops.slice(2)]);
  viewer.seek('placement',1);assert.equal(viewer.step(1).stats.pieces,2);
  assert.equal(viewer.result().navigationStop,null);assert.equal(incomingGarbage(viewer.result().state).total,2);
});
test('manual navigation skips cancelled garbage instead of inventing an intake stop',async()=>{
  const engine=new Engine({mode:'tl',seed:1,safelock:false});
  for(const y of [38,39]){engine.state.board.rows[y].fill('gb');engine.state.board.rows[y][4]=engine.state.board.rows[y][5]=null;}
  const viewer=await garbageNavigation([...packet(5,1,2),...drops.slice(2)],engine);
  const result=viewer.step(1);
  assert.equal(result.stats.pieces,1);assert.equal(result.attack.totals.cancelled,2);
  assert.equal(result.attack.totals.tanked,0);assert.equal(viewer.result().navigationStop,null);
});
test('placement sent counts actual outgoing rows after cancellation and resets on the next placement',async()=>{
  const engine=new Engine({mode:'tl',seed:1,safelock:false});
  for(const y of [38,39]){engine.state.board.rows[y].fill('gb');engine.state.board.rows[y][4]=engine.state.board.rows[y][5]=null;}
  const viewer=await garbageNavigation([...packet(5,1,2),...drops.slice(2),
    {frame:70,type:'keydown',key:'hardDrop',subframe:.2}],engine);
  for(const index of [1,2,1,0,1]){
    viewer.seek('placement',index);const {state,lastPlacement}=viewer.result();
    if(index===0){assert.equal(lastPlacement,null);continue;}
    if(index===1){assert.ok(lastPlacement.sent>0);assert.equal(lastPlacement.sent,state.attack.totals.sent);
      assert.ok(lastPlacement.sent<state.attack.totals.generated);assert.equal(state.attack.totals.cancelled,2);}
    else assert.equal(lastPlacement.sent,0);
  }
  const solo=new ViewerSession(parseReplay(JSON.stringify(syntheticReplay())),0,0);await solo.initialize();
  solo.seek('placement',1);assert.equal(solo.result().lastPlacement.sent,null);
});
test('viewer index and repeated placement/frame seeks use the stable reconstruction state',async()=>{
  const replay=parseReplay(JSON.stringify(syntheticReplay()));
  assert.deepEqual(catalog(replay),[{index:0,players:[{index:0,name:'Player 1'}]}]);
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
test('B2B display starts on the second qualifying clear and respects profile AC contribution',()=>{
  const e=new Engine(),s=e.state;
  const clear=(lines,spin,allClear=false)=>resolveAttack(s.attack,{lines,spin,allClear,garbageRows:0},s.rules,s.holes);
  clear(2,'full');assert.equal(displayStats(s).b2b,0);assert.equal(s.attack.btb,1);
  clear(0,'full');assert.equal(displayStats(s).b2b,0);
  clear(1,'mini');assert.equal(displayStats(s).b2b,1);
  clear(0,'none');assert.equal(displayStats(s).b2b,1);
  clear(1,'none');assert.equal(displayStats(s).b2b,0);
  clear(4,'none',true);assert.equal(displayStats(s).b2b,s.rules.allclear_b2b);
});
test('incoming packet display preserves FIFO, shared tank cap, partial cancellation and full-slot limits',()=>{
  const s=new Engine().state;s.attack.pieces=20;
  receive(s.attack,{from:'peer',iid:1,amt:12});receive(s.attack,{from:'peer',iid:2,amt:3});
  assert.deepEqual(incomingGarbage(s).packets.map(p=>p.amount),[12,3]);assert.equal(incomingGarbage(s).total,15);
  assert.equal(tank(s.attack,s.rules,s.holes),0); // unconfirmed packets are still pending
  for(const p of s.attack.pending)p.active=true;
  assert.equal(tank(s.attack,s.rules,s.holes),8);
  assert.deepEqual(incomingGarbage(s).packets.map(p=>p.amount),[4,3]);
  fight(s.attack,2,s.rules,s.holes);assert.deepEqual(incomingGarbage(s).packets.map(p=>p.amount),[2,3]);
  assert.equal(tank(s.attack,s.rules,s.holes),5);assert.equal(incomingGarbage(s).total,0);
  const packets=[{amount:2},{amount:3},{amount:4}];assert.deepEqual(visibleGarbage(packets,47),packets.slice(0,1));
  assert.deepEqual(visibleGarbage(packets,23),[]);assert.equal(visibleGarbage(packets,72).length,3);
});
test('buffer piece is drawn at board top without changing canonical coordinates',()=>{
  const e=new Engine();Object.assign(e.state.piece,{type:'t',x:4,y:17.96,r:0});
  const before=e.serialize(),m=boardModel(e.state);
  assert.equal(m.above,true);assert.equal(m.displayActive.length,4);
  assert.equal(Math.min(...m.displayActive.map(([,y])=>y)),0);
  assert.equal(e.serialize(),before);
});
test('viewer cancellation yields and stream replacement does not reuse state',async()=>{
  const x=syntheticReplay();x.replay.frames=1000;x.replay.events.at(-1).frame=1000;
  const replay=parseReplay(JSON.stringify(x)),a=new ViewerSession(replay,0,0);
  let cancelled=false;assert.equal(await a.initialize({yieldTask:async()=>{cancelled=true;},cancelled:()=>cancelled}),false);
  const b=new ViewerSession(replay,0,0);await b.initialize();assert.equal(b.result().state.stats.pieces,0);
  const tooLong=syntheticReplay();tooLong.replay.frames=MAX_FRAMES+1;
  assert.throws(()=>new ViewerSession(parseReplay(JSON.stringify(tooLong)),0,0),/一小時/);
});
