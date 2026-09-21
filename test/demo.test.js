import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {prepareKiwi,normalizeRecommendation} from '../src/analysis/kiwi.js';
import {createBag,pullBag} from '../src/random.js';
import init,{analyze_snapshot_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';
await init({module_or_path:readFileSync(new URL('../vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm',import.meta.url))});
function recommendations(view){const p=prepareKiwi(view.visible);p.request.node_budget=10000;
 const report=JSON.parse(analyze_snapshot_json(JSON.stringify(p.request)));
 return report.candidates.map(c=>()=>normalizeRecommendation(view.visible,p,{...report,action:c.action}));}
function recommendation(view){return recommendations(view)[0]();}
test('demo executes beyond initial previews, reveals on actual consumption and restores history without touching replay',()=>{
 const recorded=new Engine({mode:'40l',seed:42,rules:{g:0}});recorded.beginFrame([]);recorded.input({type:'keydown',key:'moveLeft',subframe:.4});
 const original=recorded.serialize(),d=new BotDemo(recorded),bag=createBag(42);let current=pullBag(bag),hold=null;
 let view=d.view();
 for(let i=0;i<10;){
  let result;const rev=view.revision;
  for(const candidate of recommendations(view)){try{result=candidate();d.prepare(result,rev);break;}catch{result=null;}}
  assert.ok(result,'at least one candidate is executable');view=d.commit(rev);
  if(result.action.kind==='hold'){
   if(hold===null){hold=current;current=pullBag(bag);}else [current,hold]=[hold,current];
   assert.equal(view.visible.hold.locked,true);
  }else{current=pullBag(bag);i++;assert.equal(view.index,i);}
  assert.equal(view.visible.current.type,current);assert.equal(view.visible.hold.piece,hold);
  assert.deepEqual(view.visible.next,bag.queue.slice(0,5));assert.equal(recorded.serialize(),original);
  assert.doesNotMatch(JSON.stringify(view),/"rng"|"holes"|"observedDraws"|"queuedInputs"/);
 }
 const last=d.engine.serialize();d.seek(0);assert.equal(d.view().index,0);d.seek(10);assert.equal(d.engine.serialize(),last);
 assert.equal(recorded.serialize(),original);
});
test('demo Hold refills immediately; failed or stale placement cannot commit',()=>{
 const e=new Engine({mode:'40l',seed:1}),d=new BotDemo(e),before=d.engine.serialize();
 const v=d.view();const r=recommendation(v);r.move={...r.move,piece:'invalid'};r.action={kind:'place'};
 assert.throws(()=>d.prepare(r,v.revision));assert.equal(d.engine.serialize(),before);
 d.prepare({action:{kind:'hold',mode:'empty'}},v.revision);const post=d.commit(v.revision);
 assert.deepEqual(post.visible.next,e.state.bag.queue.slice(1,6));assert.equal(post.visible.hold.locked,true);
 assert.throws(()=>d.commit(v.revision));assert.throws(()=>d.prepare({action:{kind:'hold',mode:'occupied'}},post.revision));
 d.seek(0);assert.equal(d.engine.serialize(),before);
});
test('demo retains visible pending uncertainty without reading future acknowledgements or hole RNG',()=>{
 const e=new Engine({seed:1});e.receive({from:'peer',iid:1,amt:4});const d=new BotDemo(e);
 assert.equal(d.view().visible.attack.pending[0].activeFrame,null);
 const other=Engine.restore(e.serialize());other.state.holes.rng.seed=98765;
 assert.equal(new BotDemo(other).engine.serialize(),d.engine.serialize());
});
