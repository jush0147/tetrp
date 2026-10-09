import test from 'node:test';
import assert from 'node:assert/strict';
import {actionSignature,classifyRootDisagreement} from '../src/analysis/rook-disagreement.js';

const place=(x,{spin='none',reverse=false}={})=>({
  kind:'place',move:{piece:'t',cells:reverse?[[x+1,5],[x,5]]:[[x,5],[x+1,5]]},
  execution:{spin,moves:['hardDrop']}
});
const kiwi=x=>({action:{kind:'place'},move:x.move,execution:x.execution});
const hold={kind:'hold',mode:'empty',samePiece:false};
const check=(chosen,ranked,target,normalReachable=false,expandedReachable=false)=>
  classifyRootDisagreement({rookChosen:chosen,rookRanked:ranked,
    kiwiChosen:target,normalReachable,expandedReachable});

test('shared-state root comparison is invariant to block ordering but not to spin',()=>{
  assert.equal(actionSignature(place(1)),actionSignature(place(1,{reverse:true})));
  assert.notEqual(actionSignature(place(1)),actionSignature(place(1,{spin:'mini'})));
  assert.equal(check(place(1),[place(1)],kiwi(place(1))).category,'agreement');
});

test('distinguishes root BFS miss, pruning and candidate valuation',()=>{
  const actions=[place(1),place(2)];
  assert.equal(check(place(1),actions,kiwi(place(5)),false,true).category,'root-bfs-budget-miss');
  assert.equal(check(place(1),actions,kiwi(place(5))).category,'root-reachability-gap');
  assert.equal(check(place(1),actions,kiwi(place(5)),true).category,'generated-but-not-ranked');
  assert.deepEqual(
    (({category,candidateRank})=>({category,candidateRank}))
    (check(place(1),actions,kiwi(place(2)),true)),
    {category:'ranked-but-not-selected',candidateRank:2});
});

test('Hold is compared as an action, not as a nonexistent post-Hold placement',()=>{
  assert.equal(check(place(1),[place(1),hold],{action:hold}).category,'hold-ranked-not-selected');
  assert.equal(check(place(1),[place(1)],{action:hold}).category,'hold-not-ranked');
  assert.equal(check(hold,[hold,place(1)],kiwi(place(1)),true).category,'rook-prefers-hold');
  assert.throws(()=>actionSignature({kind:'place'}),/invalid comparable/);
});
