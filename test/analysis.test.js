import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';
import * as R from '../src/rotation.js';
import {Reconstruction} from '../src/replay/index.js';
import {ViewerSession} from '../viewer/session.js';
import {ObservedDraws,visibleState} from '../src/analysis/visible-state.js';
import {prepareKiwi,normalizePlacement,NODE_BUDGET} from '../src/analysis/kiwi.js';
import {BotAdapter} from '../viewer/bot-adapter.js';
import {verifyKiwi} from '../scripts/verify-kiwi.js';
import {SevenBagObserver} from '../vendor/kiwi-v1/tetrp-authority-adapter.mjs';
import {createPlacementTools} from '../vendor/kiwi-v1/tetrp-placement-path.mjs';
import init,{WasmBot,analyze_pending_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';
await init({module_or_path:readFileSync(new URL('../vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm',import.meta.url))});
const snapshot=e=>visibleState(e.state,new ObservedDraws(e.state).draws);
function viewer(engine,events=[],frames=100){
  const v=Object.create(ViewerSession.prototype);
  v.session=new Reconstruction({schema:'tetrp-timeline/1',id:'analysis-test',frames,initial:engine.serialize(),events});return v;
}

test('pinned Kiwi browser artifact is byte-identical and uses frozen interactive profile',async()=>{
  await verifyKiwi();const b=new WasmBot();
  assert.equal(JSON.parse(b.capabilities_json()).config_profile,'h9+h12+h13-interactive');b.free();
});
test('canonical projection excludes hidden RNG, queue, packet identity, and source events',()=>{
  const e=new Engine({seed:42}),a=snapshot(e);
  e.state.bag.queue.splice(5,99,'i','i');e.state.bag.rng.seed=9;e.state.holes.rng.seed=22;
  e.state.attack.incoming.secret=9;e.state.attack.outgoing.secret=[{amt:999}];
  assert.deepEqual(snapshot(e),a);
  assert.equal(a.next.length,5);assert.equal(prepareKiwi(a).request.start.queue.length,6);
  assert.doesNotMatch(JSON.stringify(a),/rng|outgoing|secret|events|seed|bagId/);
  a.board.rows[39][0]='gb';assert.equal(e.state.board.rows[39][0],null);
});
test('board conversion preserves all 40 rows and reverses vertical coordinates once',()=>{
  const e=new Engine({seed:42});e.state.board.rows[39][2]='gb';e.state.board.rows[20][3]='j';e.state.board.rows[0][9]='t';
  const p=prepareKiwi(snapshot(e));assert.equal(p.visible.board[0][2],'G');assert.equal(p.visible.board[19][3],'J');assert.equal(p.visible.board[39][9],'T');
});
test('observed history handles empty Hold, occupied Hold and bag frontiers without hidden queue',async()=>{
  const e=new Engine({seed:42,handling:{safelock:false}}),v=viewer(e,[
    {frame:0,type:'keydown',key:'hold',subframe:0},
    {frame:0,type:'keydown',key:'hardDrop',subframe:.2},
    {frame:1,type:'keyup',key:'hold',subframe:0},
    {frame:1,type:'keydown',key:'hold',subframe:.2},
    {frame:1,type:'keyup',key:'hardDrop',subframe:.3},
    {frame:1,type:'keydown',key:'hardDrop',subframe:.4},
  ]);
  v.session.seekPlacement(1);let s=await v.analysisState();
  assert.equal(s.observedDraws.length,8);assert.equal(new SevenBagObserver(s.observedDraws,s.observedDraws.slice(-6)).frontierBagState().length,6);
  assert.equal(s.hold.piece,e.state.piece.type);prepareKiwi(s);
  v.session.seekPlacement(2);s=await v.analysisState();assert.equal(s.observedDraws.length,9);prepareKiwi(s);
  // A nonempty Hold before lock does not consume a bag draw; search rejects its locked root.
  v.session.seekPlacement(1);v.session.advance();v.session.advance();v.session.advance();
  s=await v.analysisState();assert.equal(s.observedDraws.length,8);assert.equal(s.hold.locked,true);
  assert.throws(()=>prepareKiwi(s),/Hold/);
});
test('history recovery stops at exact same-frame source cursor, is cancellable and does not mutate Reconstruction',async()=>{
  const v=viewer(new Engine({seed:42,handling:{safelock:false}}),[
    {frame:0,type:'keydown',key:'hardDrop',subframe:.2},
    {frame:0,type:'receive',data:{from:'peer',iid:1,ackiid:0,amt:7}},
  ]);
  v.session.seekPlacement(1);const before=v.session.checkpoint(),s=await v.analysisState();
  assert.equal(s.attack.pending.length,0);assert.equal(v.session.checkpoint(),before);
  v.session.timeline.events[1].data.amt=33;assert.deepEqual(await v.analysisState(),s);
  const future=v.session.timeline.events[1];
  Object.defineProperty(v.session.timeline.events,1,{get(){throw new Error('future read');},configurable:true});
  assert.deepEqual(await v.analysisState(),s);
  Object.defineProperty(v.session.timeline.events,1,{value:future,writable:true,configurable:true});
  v.session.seekFrame(90);assert.equal(await v.analysisState({cancelled:()=>true}),null);
});
test('observable pending cannot enter persistent search and exact arrival/clock fields are retained',()=>{
  const e=new Engine({seed:42});e.receive({from:'peer',iid:1,ackiid:0,amt:4});
  assert.throws(()=>prepareKiwi(snapshot(e)),/activation frame/);
  e.confirm(1);const p=prepareKiwi(snapshot(e));
  assert.equal(p.path,'pending-snapshot');assert.deepEqual(p.request.incoming,[{lines:4,ready_in_frames:20}]);
  assert.equal(p.request.authority_frame,0);assert.equal(p.request.garbage_margin_frames,10800);
  assert.equal(p.request.node_budget,200000);assert.equal(p.request.frames_per_piece,24);
  e.state.attack.pending[0].active=true;assert.equal(prepareKiwi(snapshot(e)).request.incoming[0].ready_in_frames,0);
  e.state.attack.pending[0].hardened=true;assert.throws(()=>prepareKiwi(snapshot(e)),/垃圾/);
});
test('actual TL surge-base and ARE differences are disclosed without changing authority counters',()=>{
  const e=new Engine({rules:{b2bcharge_base:3,garbageare:5,garbagearebump:12}});
  e.state.attack.btb=10;e.state.attack.combo=4;
  e.receive({from:'peer',iid:1,ackiid:0,amt:4});e.confirm(1);
  const before=e.serialize(),p=prepareKiwi(snapshot(e));
  assert.equal(p.request.start.b2b_count,9);assert.equal(p.request.start.combo,4);
  assert.ok(p.warnings.some(s=>s.includes('surge base=3')));assert.ok(p.warnings.some(s=>s.includes('ARE')));
  assert.equal(e.serialize(),before);
});
test('WASM 200k search is deterministic and normalized recommendation is read-only',()=>{
  const e=new Engine({mode:'40l',seed:42}),s=snapshot(e),p=prepareKiwi(s),before=e.serialize();
  const run=()=>{const b=new WasmBot();b.start(JSON.stringify(p.request.start));assert.equal(Number(b.think_nodes(NODE_BUDGET)),200000);const r=JSON.parse(b.suggest_json());b.free();return r;};
  const first=run();assert.deepEqual(run(),first);
  const move=normalizePlacement(s,p.visible,first[0]);assert.equal(move.cells.length,4);assert.equal(e.serialize(),before);
  assert.equal(move.piece,e.state.piece.type);assert.equal(move.useHold,false);assert.ok(p.warnings.length);
});
test('artifact placement mapping covers every piece, four orientations and explicit Hold',()=>{
  const tools=createPlacementTools({Engine,boardModule:B,rotationModule:R});
  for(const type of 'IOTLJSZ')for(const orientation of ['north','east','south','west']){
    const e=new Engine({seed:42});e.state.piece.type=type.toLowerCase();
    const s=snapshot(e),placement={location:{type,orientation,x:4,y:2},spin:'none'};
    let target=tools.targetFor(placement);placement.location.y-=39-Math.max(...target.cells.map(c=>c[1]));
    const move=normalizePlacement(s,{queue:[type]},placement);
    assert.equal(move.piece,type.toLowerCase());assert.equal(move.useHold,false);assert.equal(Math.max(...move.cells.map(c=>c[1])),39);
  }
  for(const held of [null,'i']){
    const e=new Engine({seed:42});e.state.hold.piece=held;const s=snapshot(e);
    const type=(held??s.next[0]).toUpperCase(),placement={location:{type,orientation:'north',x:4,y:0},spin:'none'};
    const move=normalizePlacement(s,{queue:[s.current.type.toUpperCase()]},placement);assert.equal(move.useHold,true);assert.equal(move.piece,type.toLowerCase());
  }
});
test('pending WASM snapshot respects total hard node budget',()=>{
  const e=new Engine({seed:42});e.receive({from:'peer',iid:1,ackiid:0,amt:4});e.confirm(1);
  const s=snapshot(e),p=prepareKiwi(s),report=JSON.parse(analyze_pending_json(JSON.stringify(p.request)));
  assert.ok(report.candidates.length);normalizePlacement(s,p.visible,report.candidates[0].placement);
  assert.equal(report.nodes,200000);assert.equal(report.node_budget,200000);assert.equal(report.scenarios,10);
});
test('updated artifact transport prevents a reset-heavy path locking a second piece',()=>{
  const tools=createPlacementTools({Engine,boardModule:B,rotationModule:R});
  const e=new Engine({seed:779,rules:{g:0,gincrease:0},handling:{arr:0,sdf:20,safelock:false,irs:'off',ihs:'off'}});
  while(B.legal(e.state.board,{...e.state.piece,y:e.state.piece.y+1}))e.state.piece.y++;
  const before=e.serialize(),moves=[...Array.from({length:16},(_,i)=>i%2?'moveRight':'moveLeft'),'hardDrop'];
  const replay=inputs=>{const probe=Engine.restore(before);for(let f=0;f<=19;f++)probe.step(tools.inputsForFrame(inputs,f));return probe.trace.filter(x=>x.type==='lock');};
  assert.equal(replay(tools.schedulePath(0,19,moves)).length,2);
  const safe=tools.schedulePath(0,19,moves,e),locks=replay(safe);
  assert.equal(locks.length,1);assert.equal(locks[0].frame,19);assert.equal(locks[0].subframe,.5);
  assert.equal(e.serialize(),before);
  const ordinary=['moveLeft','hardDrop'];
  assert.deepEqual(tools.schedulePath(0,19,ordinary,e),tools.schedulePath(0,19,ordinary));
});
test('adapter rejects stale results, repeated requests, cancellation and worker failure; restarts cleanly',async()=>{
  const workers=[],adapter=new BotAdapter(()=>{const w={postMessage(m){this.message=m;},terminate(){this.dead=true;}};workers.push(w);return w;});
  const first=adapter.analyze({n:1}),old=workers[0];const rejectFirst=assert.rejects(first,{name:'AbortError'});
  const second=adapter.analyze({n:2});await rejectFirst;
  old.onmessage({data:{id:old.message.id,result:'stale'}});old.onerror();const w=workers[1];
  w.onmessage({data:{id:w.message.id,result:'new'}});assert.equal(await second,'new');
  const third=adapter.analyze({n:3});const rejection=assert.rejects(third,/Worker/);w.onerror();await rejection;
  const fourth=adapter.analyze({n:4});const cancel=assert.rejects(fourth,{name:'AbortError'});adapter.dispose();await cancel;assert.equal(workers.length,3);
});
