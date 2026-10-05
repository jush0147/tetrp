// Audit saved diagnostic artifacts only: no bot, search, arena or network.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkDiagnostic} from './kiwi-score-trace-audit.js';
const run='37315205579',dir=`.cache/score-trace-${run}`,out='docs/audits/cc2-alignment';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const [on,off,wasm,inputs]=await Promise.all([`${dir}/observed.json`,`${dir}/native-reference.json`,`${dir}/wasm-reference.json`,`${out}/eval-public-inputs.json`].map(read));
assert.equal(on.length,4);
const hashes={};for(const name of ['observed','native-reference','wasm-reference','score-trace-summary'])hashes[name]=createHash('sha256').update(await readFile(`${dir}/${name}.json`)).digest('hex');
function parts(path){
 const reward={},leaf={};
 for(const s of path.steps){let prev=0;for(const p of s.description.breakdown?.stages??[]){reward[p.name]=(reward[p.name]??0)+p.reward-prev;prev=p.reward;}}
 let prev=0;for(const p of path.steps.at(-1).description.breakdown?.stages??[]){leaf[p.name]=p.eval-prev;prev=p.eval;}
 const sent=path.steps.reduce((n,s)=>n+s.description.sentAfter-s.description.sentBefore,0);
 const r=path.steps.reduce((n,s)=>n+s.description.reward,0);
 assert.ok(Math.abs((reward.transaction??0)-sent)<.0001);
 assert.ok(Math.abs(Object.values(reward).reduce((a,b)=>a+b,0)-r)<.0001);
 return {depth:path.steps.length,score:path.score,reward:r,leaf:path.leaf,sent,shaping:r-sent,rewardParts:reward,leafParts:leaf,leafReason:path.leafReason,path};
}
const rows=[];let paths=0;
for(let i=0;i<on.length;i++){
 const r=on[i];assert.equal(r.id,inputs[i].id);assert.deepEqual(r.report,off[i].report);assert.deepEqual(r.report,wasm[i].report);
 const checked=checkDiagnostic(r.report,r.diagnostic);paths+=checked.paths;
 const candidates=checked.top2.map(c=>{
  const scenarios=c.scenarios.map(s=>({scenario:s.scenario,...parts(s.path)}));
  const avg=k=>scenarios.reduce((n,s)=>n+s[k],0)/scenarios.length;
  const meanParts=k=>Object.fromEntries([...new Set(scenarios.flatMap(s=>Object.keys(s[k])))].map(name=>[name,scenarios.reduce((n,s)=>n+(s[k][name]??0),0)/scenarios.length]));
  assert.ok(Math.abs(avg('score')-c.candidate.mean_score)<1e-10);
  return {action:c.candidate.action,meanScore:c.candidate.mean_score,hypotheticalPlacement:c.selectedHypotheticalPlacement,mean:{sent:avg('sent'),shaping:avg('shaping'),reward:avg('reward'),leaf:avg('leaf'),depth:avg('depth'),rewardParts:meanParts('rewardParts'),leafParts:meanParts('leafParts')},scenarios};
 });
 const [a,b]=candidates;const delta={score:a.meanScore-b.meanScore};for(const k of ['sent','shaping','reward','leaf'])delta[k]=a.mean[k]-b.mean[k];
 delta.roundingResidual=delta.score-delta.reward-delta.leaf;
 rows.push({id:r.id,snapshot:inputs[i].snapshot,pathsChecked:checked.paths,candidates,top1MinusTop2:delta});
}
const result={run:Number(run),source:'4994e5fadd450bfa7f0ae5e20f20c48684815b70',hashes,correctness:{requests:4,fullReportComparisons:8,pathsChecked:paths,localRecheck:true},rows,limitations:['Four fixed snapshots, not KO evidence or frequency estimate','Paths are final cached winners under current budget, not proof of optimal continuation','Per-scenario futures use existing hole assumptions; no physical transport validation added','No production latency change; diagnostic wall time is not performance evidence'],selectedEvaluatorModification:null};
await writeFile(`${out}/FINAL_SCORE_TRACE_RESULT_${run}.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({paths,rows:rows.map(r=>({id:r.id,means:r.candidates.map(c=>c.mean),delta:r.top1MinusTop2}))},null,2));
