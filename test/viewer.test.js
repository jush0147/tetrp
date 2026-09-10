import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {cells} from '../src/board.js';
import {parseReplay,prepareReplay,Reconstruction,selectPlayer} from '../src/replay/index.js';
import {ViewerSession,catalog,MAX_FRAMES} from '../viewer/session.js';
import {boardModel} from '../viewer/render.js';

export function syntheticReplay(){return {version:1,gamemode:'40l',replay:{frames:90,options:{version:15,seed:42,handling:{safelock:false}},
  events:[{frame:0,type:'start',data:{}},...Array.from({length:6},(_,i)=>[
    {frame:i*12+1,type:'keydown',data:{key:'hardDrop',subframe:.2}},
    {frame:i*12+2,type:'keyup',data:{key:'hardDrop',subframe:.4}},
  ]).flat(),{frame:90,type:'end',data:{reason:'clear'}}]}};}
test('viewer index and repeated placement/frame seeks use the stable reconstruction state',async()=>{
  const replay=parseReplay(JSON.stringify(syntheticReplay()));
  assert.deepEqual(catalog(replay),[{index:0,players:[{index:0,name:'Player 1'}]}]);
  const viewer=new ViewerSession(replay,0,0);assert.equal(await viewer.initialize(),true);assert.equal(viewer.total,6);
  const reference=new Reconstruction(prepareReplay(selectPlayer(replay)));
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
