import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';import * as R from '../src/rotation.js';
import {Reconstruction} from '../src/replay/index.js';
import {ViewerSession} from '../viewer/session.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {prepareKiwi,normalizeRecommendation,NODE_BUDGET} from '../src/analysis/kiwi.js';
import {BotAdapter} from '../viewer/bot-adapter.js';
import {verifyKiwi} from '../scripts/verify-kiwi.js';
import {createPlacementTools} from '../vendor/kiwi-v1/tetrp-placement-path.mjs';
import {captureSnapshot,buildSnapshotRequest,applyHoldForReanalysis} from '../vendor/kiwi-v1/kiwi-snapshot-adapter.mjs';
import init,{analyze_snapshot_json,snapshot_capabilities_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';
await init({module_or_path:readFileSync(new URL('../vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm',import.meta.url))});
const search=p=>JSON.parse(analyze_snapshot_json(JSON.stringify(p.request)));
const e=new Engine({seed:42,rules:{b2bcharge_base:3,garbageare:5,garbagearebump:12}});
const snapshot=visibleState(e.state),prepared=prepareKiwi(snapshot),report=search(prepared);

test('pinned v3.2 artifact hashes and snapshot capabilities',async()=>{
 await verifyKiwi();const c=JSON.parse(snapshot_capabilities_json());assert.equal(c.same_piece_hold_search,true);assert.equal(c.history_scan,false);assert.equal(c.root_geometry_in_search,true);
});
test('direct projection never reads history, hidden NEXT or RNG; analysis preserves exact checkpoint',async()=>{
 const v=Object.create(ViewerSession.prototype);v.session=new Reconstruction({schema:'tetrp-timeline/1',id:'test',frames:20,initial:e.serialize(),events:[]});
 const before=v.session.checkpoint();Object.defineProperty(v.session,'state',{get(){throw new Error('full state clone');}});Object.defineProperty(v.session.timeline,'events',{get(){throw new Error('history read');},configurable:true});
 const s=await v.analysisState();assert.deepEqual(s,snapshot);Object.defineProperty(v.session.timeline,'events',{value:[],writable:true,configurable:true});assert.equal(v.session.checkpoint(),before);
 assert.equal(await v.analysisState({cancelled:()=>true}),null);
 const raw=Engine.restore(e.serialize()).state;raw.bag.queue=new Proxy(raw.bag.queue,{get(t,k){if(Number(k)>=5)throw new Error('hidden queue');return Reflect.get(t,k);}});
 Object.defineProperty(raw.bag,'rng',{get(){throw new Error('rng');}});assert.deepEqual(visibleState(raw),snapshot);
 assert.equal(s.next.length,5);assert.doesNotMatch(JSON.stringify(s),/observedDraws|rng|outgoing|events/);
});
test('snapshot carries real rules, clock, exact five previews; no bag input',()=>{
 const q=prepared.request;assert.equal(q.rules.b2bcharge_base,3);assert.equal(q.timing_rules.garbage_are_frames,5);assert.equal(q.timing_rules.garbage_are_bump_frames,12);assert.equal(q.start.queue.length,6);assert.equal(q.bag_knowledge,'unknown');assert.equal(q.unknown_tail,'finite_visible');assert.ok(!('randomizer' in q.start));
 const s=structuredClone(snapshot);s.attack.multiplier=2;s.frame=18000;
 const p=buildSnapshotRequest(captureSnapshot({...prepared.authority.state,frame:s.frame,attack:s.attack},{rootGeometry:{placements:q.root_legal_placements}}));assert.equal(p.garbage_multiplier,2);assert.equal(p.authority_frame,18000);assert.equal(p.incoming.length,0);
 assert.ok(JSON.parse(analyze_snapshot_json(JSON.stringify({...p,node_budget:5000}))).nodes<=5000);
});
test('real WASM deterministic hard budget and normalized recommendation without mutation',()=>{
 const before=e.serialize();assert.deepEqual(search(prepared),report);assert.ok(report.nodes>0&&report.nodes<=NODE_BUDGET);
 const r=normalizeRecommendation(snapshot,prepared,report);assert.ok(['hold','place'].includes(r.action.kind));if(r.move)assert.equal(r.move.cells.length,4);assert.equal(e.serialize(),before);
 for(const c of report.candidates)if(c.action.kind==='place')assert.ok(prepared.request.root_legal_placements.some(p=>JSON.stringify(p)===JSON.stringify(c.action.placement)));
});
test('same-piece empty and occupied Hold are standalone; locked post-Hold search cannot Hold',()=>{
 for(const occupied of [false,true]){
 const h=Engine.restore(e.serialize());if(occupied)h.state.hold.piece=h.state.piece.type;else h.state.bag.queue[0]=h.state.piece.type;
 const s=visibleState(h.state),p=prepareKiwi(s),r=search(p),a=r.candidates.find(c=>c.action.kind==='hold').action;
 assert.equal(a.same_piece,true);assert.ok(!('placement' in a));const normalized=normalizeRecommendation(s,p,{...r,action:a});assert.equal(normalized.move,null);
 const before=h.serialize(),post=applyHoldForReanalysis(h,a,{Engine});assert.equal(h.serialize(),before);assert.equal(post.state.hold.locked,true);
 assert.deepEqual(post.state.bag.queue.slice(0,5),h.state.bag.queue.slice(occupied?0:1,occupied?5:6));
 const after=search(prepareKiwi(visibleState(post.state)));assert.ok(after.candidates.every(c=>c.action.kind==='place'));
 }
});
test('unknown pending timing remains visible and analyzable; unsupported phases retain errors',()=>{
 const h=Engine.restore(e.serialize());h.receive({from:'peer',iid:1,ackiid:0,amt:4});
 const capture=()=>captureSnapshot(h.state,{rootGeometry:{placements:prepared.request.root_legal_placements}});
 const unknown=buildSnapshotRequest(capture(),{nodeBudget:5000});
 assert.deepEqual(unknown.incoming,[{lines:4,ready_in_frames:null}]);
 const result=JSON.parse(analyze_snapshot_json(JSON.stringify(unknown)));
 assert.equal(result.unknown_activation_packets,1);assert.equal(result.scenarios,30);
 assert.deepEqual(result.unknown_activation_delays,[1,25,600]);assert.ok(result.nodes<=5000);
 assert.equal(unknown.incoming[0].ready_in_frames,null);
 h.confirm(1);const q=buildSnapshotRequest(capture(),{nodeBudget:5000});assert.equal(q.incoming[0].lines,4);assert.ok(JSON.parse(analyze_snapshot_json(JSON.stringify(q))).nodes<=5000);
 h.state.attack.pending[0].hardened=true;assert.throws(capture,{code:'PENDING_PACKET_HARDENED_UNSUPPORTED'});h.state.attack.pending=[];h.state.attack.are=[{amt:1}];assert.throws(capture,{code:'PENDING_ARE_QUEUE_UNSUPPORTED'});
});
test('40L explicitly uses neutral competitive stacking without a TL attack clock',()=>{
 const solo=new Engine({mode:'40l',seed:42}),s=visibleState(solo.state),p=prepareKiwi(s);assert.equal(p.request.analysis_mode,'competitive_stacking');assert.equal(p.request.source_mode,'40l');assert.equal(p.request.garbage_multiplier,null);assert.equal(p.request.start.combo,0);assert.ok(p.warnings.some(w=>w.includes('40L')));normalizeRecommendation(s,p,search(p));
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
