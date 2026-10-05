import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPath,checkDiagnostic,checkAllocations} from '../scripts/kiwi-score-trace-audit.js';
import {insert,workCounters} from '../scripts/kiwi-score-trace-prepare.js';
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
test('work accounting catches dropped nodes, invisible retries and wrong stop reason',()=>{
 const d={allocationVersion:1,scenarios:[{branch:'place',scenario:0}],allocations:[{branch:'place',scenario:0,budget:100,nodes:100,selections:3,expansions:1,budgetExhausted:true,finalStall:0,maxStall:1,stop:'partial_budget',ranks:[],rows:[{root:null,depth:1,reason:'expanded',attempts:1,nodes:90,expansions:1,cancelled:0},{root:null,depth:7,reason:'finite_frontier',attempts:1,nodes:0,expansions:0,cancelled:0},{root:null,depth:2,reason:'partial_cancel',attempts:1,nodes:10,expansions:0,cancelled:1}]}]};
 const report={nodes:100,node_budget:100};checkAllocations(report,d);
 for(const edit of [a=>a.rows[0].nodes--,a=>a.rows[1].attempts++,a=>a.stop='stall_limit',a=>a.rows[1].expansions++]){const copy=structuredClone(d);edit(copy.allocations[0]);assert.throws(()=>checkAllocations(report,copy));}
});
test('work counters are insertion-only and reject duplicate installation',()=>{
 const s='        SelectResult::Advance(self.piece, children[i].mv)';const changed=workCounters(s,'known');assert.ok(changed.includes('root_choice'));assert.throws(()=>workCounters(changed,'known'));
});
