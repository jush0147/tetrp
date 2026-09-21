import test from 'node:test';
import assert from 'node:assert/strict';
import {DemoController} from '../viewer/demo-controller.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const view={visible:{next:['i','o','t','s','z']},revision:0,index:0,total:0,stopped:false};
const result={action:{kind:'place'},candidateCount:2};
function harness(overrides={}){
 const calls=[],errors=[],views=[];
 const controller=new DemoController({delay:0,bot:{dispose(){},async analyze(){return result;}},
  async rpc(type){calls.push(type);return {...view};},onView:v=>views.push(v),onThinking(){},
  onRecommendation(){},onResult(){},onError:e=>errors.push(e),...overrides});
 return {controller,calls,errors,views};
}
test('exit during search ignores late reply and never prepares or commits',async()=>{
 const pending=deferred(),started=deferred();
 const h=harness({bot:{dispose(){},analyze(){started.resolve();return pending.promise;}}});
 const running=h.controller.begin();await started.promise;h.controller.cancel();pending.resolve(result);await running;
 assert.deepEqual(h.calls,['demo-start']);assert.equal(h.controller.view,null);assert.deepEqual(h.errors,[]);
});
test('exit during target preview cancels prepared placement and late UI callbacks',async()=>{
 const shown=deferred();const h=harness({delay:60000,onRecommendation(){shown.resolve();}});
 const running=h.controller.begin();await shown.promise;h.controller.cancel();await running;
 assert.deepEqual(h.calls,['demo-start','demo-prepare']);assert.equal(h.controller.view,null);
});
test('failed timing candidate retries ranked report, then executes one placement',async()=>{
 const indexes=[],calls=[];const h=harness({bot:{dispose(){},async analyze(_,o){indexes.push(o.candidateIndex);return result;}},
  async rpc(type){calls.push(type);if(type==='demo-prepare'&&indexes.length===1)throw new Error('timing');return {...view};}});
 await h.controller.begin();assert.deepEqual(indexes,[0,1]);
 assert.deepEqual(calls,['demo-start','demo-prepare','demo-prepare','demo-commit']);assert.deepEqual(h.errors,[]);
});
test('ended branch starts no search; saved forward movement only seeks',async()=>{
 let searches=0;const h=harness({bot:{dispose(){},async analyze(){searches++;return result;}}});
 h.controller.view={...view,stopped:true};await h.controller.next();
 h.controller.view={...view,index:3,total:4};await h.controller.next();
 assert.equal(searches,0);assert.deepEqual(h.calls,['demo-seek']);
});

test('timing retry advances past the actual candidate after geometry skipped earlier ranks',async()=>{
 const indexes=[];let attempts=0;
 const h=harness({bot:{dispose(){},async analyze(_,o){indexes.push(o.candidateIndex);
  return {...result,candidateIndex:o.candidateIndex===0?2:3,candidateCount:4};}},
  async rpc(type){if(type==='demo-prepare'&&attempts++===0)throw new Error('timing');return {...view};}});
 await h.controller.begin();assert.deepEqual(indexes,[0,3]);assert.deepEqual(h.errors,[]);
});
