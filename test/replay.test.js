import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.js';
import { parseReplay, selectPlayer, orderedEvents, prepareReplay, Reconstruction, DivergenceDiagnostics, decodeFlags, projectAnchor } from '../src/replay/index.js';
import { createBag } from '../src/random.js';

// Original synthetic fixtures only; never copy private replay contents here.
const input = (frame,type,key,subframe=0) => ({frame,type,data:{key,subframe}});
const fixture = () => ({version:1,gamemode:'40l',replay:{frames:5,options:{version:15,seed:42,handling:{}},events:[
  {frame:0,type:'start',data:{}},input(1,'keydown','rotateCW',0.8),input(1,'keydown','hardDrop',0.2),
  {frame:5,type:'end',data:{reason:'clear'}},
]}});
const parse = value => parseReplay(JSON.stringify(value));
test('parser preserves source order and decreasing subframes, selection and immutability',()=>{
  const parsed = parse(fixture()), player = selectPlayer(parsed);
  const events = orderedEvents(player);
  assert.deepEqual(events.slice(1,3).map(e=>[e.sourceIndex,e.subframe]),[[1,0.8],[2,0.2]]);
  assert.throws(()=>{player.stream.events.pop();},TypeError);
  assert.throws(()=>selectPlayer(parsed,1),/SELECTION/);
  assert.equal(prepareReplay(player).profile,'v19-compat-v15-40l/1');
  const multi = fixture(); multi.gamemode='league'; multi.replay={rounds:[[{id:'synthetic',replay:fixture().replay}],[{replay:fixture().replay}]]};
  assert.equal(parse(multi).rounds.length,2);
});
test('malformed and unsupported replay errors carry paths',()=>{
  assert.throws(()=>parseReplay('{'),/MALFORMED_JSON/);
  for (const [mutate,code] of [
    [x=>x.version=2,'UNSUPPORTED_VERSION'],[x=>x.replay.options.version=99,'UNSUPPORTED_VERSION'],
    [x=>x.replay.events[1].type='mystery','UNSUPPORTED_EVENT'],
    [x=>x.replay.events[1].data.key='mystery','UNSUPPORTED_KEY'],
    [x=>x.replay.events[1].data.subframe=1,'MALFORMED'],
    [x=>x.replay.events[2].frame=0,'EVENT_ORDER'],
    [x=>x.replay.events.pop(),'MALFORMED'],
  ]) {const x=fixture();mutate(x);assert.throws(()=>parse(x),e=>e.code===code && typeof e.path==='string');}
});
const timeline = () => ({schema:'tetrp-timeline/1',id:'synthetic-timeline',frames:8,
  initial:new Engine({seed:42,mode:'40l',handling:{safelock:false}}).serialize(),events:[
    {frame:0,type:'keydown',key:'rotateCW',subframe:0.8},
    {frame:0,type:'keydown',key:'hardDrop',subframe:0.2},
    {frame:0,type:'keyup',key:'hardDrop',subframe:0.2},
    {frame:0,type:'keydown',key:'hardDrop',subframe:0.3},
    {frame:0,type:'keyup',key:'hardDrop',subframe:0.3},
    {frame:4,type:'keydown',key:'hardDrop',subframe:0.5},
  ]});
test('ordered reconstruction equals existing engine, including two placements in a frame',()=>{
  const t=timeline(), direct=Engine.restore(t.initial);
  for(let frame=0;frame<t.frames;frame++) direct.step(t.events.filter(e=>e.frame===frame));
  const r=new Reconstruction(t);r.run();assert.equal(r.engine.serialize(),direct.serialize());
  assert.equal(r.seekPlacement(1).stats.pieces,1);
  assert.equal(r.state.frame,0);assert.equal(r.cursor,2);
  assert.equal(r.seekPlacement(2).stats.pieces,2);
  assert.equal(r.state.frame,0);assert.equal(r.cursor,4);
  assert.throws(()=>r.seekPlacement(10),/beyond/);
});
test('repeat seeks, checkpoint continuation and fork are deterministic and independent',()=>{
  const r=new Reconstruction(timeline());
  for(const n of [0,1,2,3]) {
    const a=r.seekPlacement(n);const cp=r.checkpoint();
    r.run();const final=r.engine.serialize();
    const restored=Reconstruction.restore(cp);restored.run();assert.equal(restored.engine.serialize(),final);
    assert.deepEqual(r.seekPlacement(n),a);
    const fork=r.fork(), fork2=Engine.restore(fork.serialize());
    if(fork.state.phase==='inputs'){fork.finishFrame();fork2.finishFrame();}
    const local=[{frame:fork.state.frame,type:'keydown',key:'moveLeft',subframe:0.4}];
    fork.step(local);fork2.step(local);assert.equal(fork.serialize(),fork2.serialize());
    assert.deepEqual(r.state,a);
  }
  for(const frame of [0,5,2,8,1]){const a=r.seekFrame(frame);r.run();assert.deepEqual(r.seekFrame(frame),a);}
});
test('first divergence reports fields, placement, timing and sparse-anchor uncertainty',()=>{
  const d=new DivergenceDiagnostics(), s=new Engine().state;
  d.observe(s,{piece:{resets:0,rotationResets:0},stats:{pieces:0}},{frame:0});
  s.piece.rotationResets=1;
  d.observe(s,{piece:{resets:1,rotationResets:1}},{frame:7,sourceIndex:4});
  assert.equal(d.first.firstObservedFrame,7);assert.equal(d.first.firstDivergentFrame,null);
  assert.equal(d.first.placementIndex,0);assert.equal(d.first.differences[0].field,'piece.resets');
  d.observe(s,{piece:{y:999}},{frame:8});assert.equal(d.first.firstObservedFrame,7);
  const exact=new DivergenceDiagnostics();exact.observe(s,{piece:{resets:1}},{frame:7,exact:true});
  assert.equal(exact.first.firstDivergentFrame,7);
});
test('anchor observation occurs at exact source cursor, survives checkpoint',()=>{
  const t=timeline();t.events.splice(2,0,{frame:0,type:'anchor',sourceIndex:2,expected:{stats:{pieces:0}}});
  const r=new Reconstruction(t);r.advance();r.advance();r.advance();
  assert.equal(r.diagnostics.first.placementIndex,1);
  const restored=Reconstruction.restore(r.checkpoint());assert.deepEqual(restored.diagnostics.first,r.diagnostics.first);
});
test('timeline/checkpoint rejects unsupported events and corrupt cursor',()=>{
  const t=timeline();t.events[0].type='full';assert.throws(()=>new Reconstruction(t),/Unsupported canonical event/);
  const r=new Reconstruction(timeline());const cp=JSON.parse(r.checkpoint());cp.cursor=900;
  assert.throws(()=>Reconstruction.restore(JSON.stringify(cp)),/Invalid cursor/);
});
test('no_szo rotates the first bag without RNG draws; anchorseed has no gameplay effect',()=>{
  const x=fixture();x.replay.options.no_szo=true;x.replay.options.anchorseed=true;
  const a=Engine.restore(prepareReplay(selectPlayer(parse(x))).initial);
  assert.equal(a.state.piece.type,'t');assert.equal(a.state.bag.queue.slice(0,6).join(''),'iljszo');
  const baseline=new Engine({mode:'40l',seed:42});
  assert.deepEqual(a.state.bag.rng,baseline.state.bag.rng);assert.deepEqual(a.state.holes,baseline.state.holes);
  assert.deepEqual(a.state.bag.queue.slice(6),baseline.state.bag.queue.slice(6));
  x.replay.options.anchorseed=false;
  assert.equal(prepareReplay(selectPlayer(parse(x))).initial,a.serialize());
});
const leagueFixture = () => {
  const solo=fixture(), s=solo.replay;s.options.version=19;s.options.gameid=7;s.frames=35;
  s.events=[{frame:0,type:'start',data:{}},
    {frame:0,type:'ige',data:{id:900,frame:99,type:'target',data:{targets:[8]}}},
    {frame:2,type:'ige',data:{id:1000,frame:0,type:'interaction',data:{type:'garbage',amt:3,gameid:8,frame:999,cid:78,iid:12,ackiid:0}}},
    {frame:3,type:'ige',data:{id:1001,frame:0,type:'interaction_confirm',data:{type:'garbage',amt:3,gameid:8,frame:999,cid:78,iid:12,ackiid:0}}},
    {frame:35,type:'end',data:{gameoverreason:'winner'}}];
  return {version:1,gamemode:'league',replay:{rounds:[[{replay:s}]]}};
};
test('IGE outer frame execution, ID correlation, 20F travel and restored continuation',()=>{
  const t=prepareReplay(selectPlayer(parse(leagueFixture()))), r=new Reconstruction(t);
  r.seekFrame(3);assert.deepEqual(r.packetIds,{'78':1});assert.equal(r.state.attack.pending[0].active,false);
  const restored=Reconstruction.restore(r.checkpoint());
  r.advance();restored.advance();assert.equal(r.state.attack.pending[0].confirmFrame,3);
  assert.equal(r.state.waiting[0].target,23);assert.equal(r.state.waiting[0].data.cid,1);
  r.seekFrame(22);assert.equal(r.state.attack.pending[0].active,false);
  r.seekFrame(23);assert.equal(r.state.attack.pending[0].active,true);
  restored.run();r.run();assert.equal(r.engine.serialize(),restored.engine.serialize());
});
test('duplicate IGE IDs are explicit metadata; confirm after full cancellation is harmless',()=>{
  const x=leagueFixture(), s=x.replay.rounds[0][0].replay;
  s.events.splice(3,0,structuredClone(s.events[2]));
  const t=prepareReplay(selectPlayer(parse(x)));assert.equal(t.events[3].kind,'duplicate-ige');
  const r=new Reconstruction(t);r.seekFrame(3);assert.equal(r.state.attack.pending.length,1);
  r.engine.state.attack.pending=[]; // Represents complete cancellation before confirm.
  r.advance();assert.equal(r.state.waiting.length,0);
  const cancelled=new Reconstruction({...t,events:[
    {frame:0,type:'receive',remoteCid:9,data:{from:'P2',amt:0,iid:1,ackiid:0}},
    {frame:0,type:'confirm',remoteCid:9},
  ]});cancelled.run();assert.equal(cancelled.state.waiting.length,0);assert.equal(cancelled.packetIds[9],null);
});
test('pre-spawn full checks seed-derived first bag without overwriting the engine',()=>{
  const x=leagueFixture(), stream=x.replay.rounds[0][0].replay, e=new Engine({seed:42});
  const raw={game:{board:e.state.board.rows,bag:createBag(42).queue,hold:e.state.hold,g:e.state.g,playing:true,
    falling:{type:'i',x:0,y:0,r:0,hy:0,kick:0,keys:0,safelock:0,locking:0,lockresets:0,rotresets:0,flags:0}},
    stats:{lines:0,holds:0,piecesplaced:0}};
  stream.events.splice(1,0,{frame:0,type:'full',data:raw});
  const t=prepareReplay(selectPlayer(parse(x))), r=new Reconstruction(t);r.advance();r.advance();
  assert.equal(r.diagnostics.first,null);assert.notEqual(r.state.piece.y,0);
  raw.game.bag[0]='t';
  const changed=new Reconstruction(prepareReplay(selectPlayer(parse(x))));changed.advance();changed.advance();
  assert.equal(changed.diagnostics.first.differences[0].field,'bag.queue.0');
  assert.equal(changed.engine.serialize(),r.engine.serialize());
});
test('flags and terminal anchor retain raw Y; retry terminates solo without resetting RNG',()=>{
  assert.deepEqual(decodeFlags(8|16|64|128|2048|4096),{wall:true,sleeping:true,forceLock:true,softDropped:true,spin:'mini'});
  const projection=projectAnchor({game:{board:[],bag:[],hold:{},g:0.02,playing:false,falling:{flags:128,y:17.96}}});
  assert.equal(projection.piece.y,17.96);assert.equal(projection.piece.sleeping,true);
  const x=fixture();x.replay.events[1]=input(1,'keydown','retry',0.4);
  const r=new Reconstruction(prepareReplay(selectPlayer(parse(x))));r.seekFrame(1);
  const bag=structuredClone(r.state.bag);r.advance();assert.equal(r.state.reason,'retry');assert.equal(r.state.playing,false);
  assert.deepEqual(r.state.bag,bag);
});
test('unsupported gameplay options, mode combinations, retryisclear and multiplayer retry fail explicitly',()=>{
  for(const [key,value] of [['retryisclear',true],['unknown_gameplay',true],['infinite_movement',true]]){
    const x=fixture();x.replay.options[key]=value;assert.throws(()=>prepareReplay(selectPlayer(parse(x))),/UNSUPPORTED_PROFILE/);
  }
  const x=leagueFixture();x.replay.rounds[0][0].replay.events.splice(2,0,input(1,'keydown','retry'));
  assert.throws(()=>prepareReplay(selectPlayer(parse(x))),/Multiplayer retry/);
  const wrong=fixture();wrong.replay.options.version=19;
  assert.throws(()=>prepareReplay(selectPlayer(parse(wrong))),/profile combination/);
});
test('terminal event cannot hide an endogenous engine reason divergence',()=>{
  const t=timeline();t.events=[{frame:0,type:'terminal',reason:'topout'},
    {frame:0,type:'anchor',expected:{reason:'topout'},sourceIndex:4}];
  const r=new Reconstruction(t);r.engine.die('garbagesmash');r.run();
  assert.deepEqual(r.diagnostics.first.differences,[{field:'reason',expected:'topout',actual:'garbagesmash'}]);
  assert.equal(r.diagnostics.first.firstDivergentFrame,null);
});
test('diagnostics capture missing/object values without later mutation and survive checkpoints',()=>{
  const t=timeline();t.events=[{frame:0,type:'anchor',expected:{absent:1,hold:null},sourceIndex:0}];
  const r=new Reconstruction(t);r.advance();
  assert.deepEqual(r.diagnostics.first.differences[0].actual,{$missing:true});
  const first=structuredClone(r.diagnostics.first);r.engine.state.hold.piece='t';
  assert.deepEqual(r.diagnostics.first,first);
  const cp=r.checkpoint(), restored=Reconstruction.restore(cp);
  assert.equal(restored.checkpoint(),cp);assert.deepEqual(restored.diagnostics.first,first);
});
