import test from 'node:test';
import assert from 'node:assert/strict';
import {shortPlan,compareScores,diagnosticOutcome} from '../scripts/kiwi-h1-short-metrics.js';
test('short protocol assigns both policies both seats on exactly one common seed',()=>{
 const plans=[0,1,2,3].map(shortPlan);
 assert.deepEqual(plans.map(p=>[p.policy,p.seat]),[['accepted',0],['accepted',1],['h1-off',0],['h1-off',1]]);
 assert.ok(plans.every(p=>p.seed===2026150001&&p.frames===24*100));assert.throws(()=>shortPlan(4));
});
test('counterfactual score comparison matches action identity, not rank',()=>{
 const c=(kind,score)=>({action:{kind},mean_score:score,worst_score:score});
 const on={candidates:[c('place',2),c('hold',1)]};
 assert.deepEqual(compareScores(on,{candidates:[c('hold',1),c('place',2)]}),{candidateSetChanged:false,changedScores:0});
 assert.deepEqual(compareScores(on,{candidates:[c('hold',3),c('place',2)]}),{candidateSetChanged:false,changedScores:1});
 assert.deepEqual(compareScores(on,{candidates:[c('hold',3)]}),{candidateSetChanged:true,changedScores:1});
});
test('horizon has no adjudicated winner and technical stop is not diagnostic completion',()=>{
 assert.match(diagnosticOutcome({reason:'frame-cap',winner:null}),/unscored/);
 assert.throws(()=>diagnosticOutcome({reason:'frame-cap',winner:0}));
 assert.throws(()=>diagnosticOutcome({reason:'watchdog',winner:null}));
 assert.match(diagnosticOutcome({reason:'topout',winner:0}),/diagnostic only/);
});
