import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPath,checkDiagnostic} from '../scripts/kiwi-score-trace-audit.js';
import {insert} from '../scripts/kiwi-score-trace-prepare.js';
const placement={location:{type:'I',orientation:'north',x:4,y:1},spin:'none'};
function path(){return {root:placement,score:3,rebuilt:3,leaf:1,leafReason:'unexpanded_leaf',steps:[{placement,cachedScore:3,childValue:1,description:{reward:2,localEval:1,toppedOut:false,breakdown:{stages:Array.from({length:12},()=>({eval:1,reward:2}))}}}]};}
test('reject stale backprop, changed rewards and leaf values',()=>{
 checkPath(path());for(const edit of [p=>p.steps[0].cachedScore=4,p=>p.steps[0].description.reward=3,p=>p.leaf=0,p=>p.steps[0].description.localEval=7]){const p=path();edit(p);assert.throws(()=>checkPath(p));}
});
test('Hold uses one globally aggregated placement, not scenario-specific maxima',()=>{
 const other={...placement,location:{...placement.location,x:5}};
 const make=(root,score)=>{const p=path();p.root=root;p.steps[0].placement=root;p.score=p.rebuilt=p.steps[0].cachedScore=score;p.steps[0].description.reward=score-1;p.steps[0].description.breakdown.stages.forEach(s=>s.reward=score-1);return p;};
 const candidate=(placement,mean,worst)=>({placement,mean_score:mean,worst_score:worst,scenarios:2});
 const d={version:1,scenarios:[{branch:'post_hold',scenario:0,paths:[make(placement,3),make(other,8)]},{branch:'post_hold',scenario:1,paths:[make(placement,7),make(other,0)]}],branches:[{branch:'post_hold',candidates:[candidate(placement,5,3),candidate(other,4,0)]}]};
 const r={candidates:[{action:{kind:'hold'},mean_score:5,worst_score:3}]};assert.equal(checkDiagnostic(r,d).top2[0].selectedHypotheticalPlacement,placement);
 r.candidates[0].mean_score=7.5;assert.throws(()=>checkDiagnostic(r,d));
});
test('source insert refuses ambiguous anchors',()=>{assert.equal(insert('abc','b','!'),'a!bc');assert.throws(()=>insert('abbc','b','!'));});
