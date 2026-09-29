// Read-only analysis of completed runs; no new search, private future or tuning.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
const dir='docs/audits/cc2-alignment',root='.cache/tslot-run-36566413689',old='.cache/eval-run-36551709585';
const read=async(p)=>JSON.parse(await readFile(p,'utf8'));
const [inputs,baseline,candidate,observed,previous,effects]=await Promise.all([
 `${root}/candidate-inputs.json`,`${root}/native-reference.json`,`${root}/candidate.json`,`${root}/observed.json`,`${old}/observed.json`,`${dir}/TSLOT_WITNESS_GEOMETRY.json`].map(read));
const id='leg20/request493',entry=a=>a.find(r=>r.id===id),input=entry(inputs),b=entry(baseline).report,c=entry(candidate).report;
const before=entry(previous),after=entry(observed);
assert.deepEqual(before.report,b,'old observer must reproduce this exact accepted report');
assert.deepEqual(after.report,c);
assert.equal(input.snapshot.current.type,'t');assert.equal(input.snapshot.hold.piece,'z');
assert(!input.snapshot.next.includes('t'));assert.equal(input.snapshot.hold.locked,false);
assert.deepEqual(b.branch_nodes,c.branch_nodes);assert.equal(b.scenarios,10);assert.equal(c.scenarios,10);
const key=a=>JSON.stringify(a);
const ranks=b.candidates.map(x=>{
 const y=c.candidates.find(y=>key(x.action)===key(y.action));assert(y,'root candidate disappeared');
 return {action:x.action,baselineRank:x.candidate_index,candidateRank:y.candidate_index,
  baselineMean:x.mean_score,candidateMean:y.mean_score,meanDelta:y.mean_score-x.mean_score,
  baselineWorst:x.worst_score,candidateWorst:y.worst_score};
});
assert.equal(b.candidates.length,c.candidates.length);
const oldWinner=ranks.find(r=>r.baselineRank===0),hold=ranks.find(r=>r.action.kind==='hold');
const prepared=prepareKiwi(input.snapshot);
const normalized=normalizeTopRecommendation(input.snapshot,prepared,b),proof=validatePlacement(input.snapshot,normalized);
normalizeTopRecommendation(input.snapshot,prepared,c);
function groups(d){
 return ['place','post_hold'].map(branch=>{
  const counts=Object.entries(d.groups).filter(([k])=>k.startsWith(branch+'/')).reduce((a,[,v])=>a.map((n,i)=>n+v[i]),[0,0,0]);
  return {branch,boardRewrite:counts[0],templateOnly:counts[1],control:counts[2],evaluations:counts.reduce((a,b)=>a+b,0)};
 });
}
const beforeGroups=groups(before.diagnostic),afterGroups=groups(after.diagnostic);
assert.equal(afterGroups[0].boardRewrite+afterGroups[0].templateOnly,0);
const knownT=r=>r.normalizedRemainingAfter.filter(p=>p==='T').length+Number(r.reserve==='T');
// Stage comparison only for the same selected path and post-transition real state.
// These witnesses are not the backed-up winning continuation of a DAG root.
const stateKey=r=>JSON.stringify([r.branch,r.scenario,r.depth,r.selectedPathBefore,r.placement,r.realBoardCols,
 r.reserve,r.holdIsEmpty,r.normalizedRemainingAfter,r.pendingAfter,r.sentAfter,r.b2bBefore,r.b2bAfter,r.comboBefore,r.lines]);
const oldByKey=new Map(before.diagnostic.rows.map(r=>[stateKey(r),r]));
const matched=[];
for(const r of after.diagnostic.rows){const a=oldByKey.get(stateKey(r));if(!a)continue;
 assert.equal(a.stages.at(-1).reward,r.stages.at(-1).reward,'same-state immediate reward changed');
 assert.deepEqual(a.stages.slice(0,6),r.stages.slice(0,6),'same-state pre-cutout scoring changed');
 matched.push({branch:r.branch,scenario:r.scenario,depth:r.depth,placement:r.placement,
  oldAllowance:a.cutoutAllowance,newAllowance:r.cutoutAllowance,
  oldEval:a.stages.at(-1).eval,newEval:r.stages.at(-1).eval,
  oldReward:a.stages.at(-1).reward,newReward:r.stages.at(-1).reward,
  stageDeltas:r.stages.map((s,i)=>({stage:s.stage,evalDelta:s.deltaEval-a.stages[i].deltaEval,rewardDelta:s.deltaReward-a.stages[i].deltaReward}))});
}
const rewrites=before.diagnostic.rows.filter(r=>r.category==='board_rewrite');
const witnesses=[];
for(const branch of ['place','post_hold']){
 const index=rewrites.findIndex(r=>r.branch===branch&&knownT(r)===0);assert(index>=0);
 const r=rewrites[index],effect=effects.effects.find(e=>e.id===id&&e.sampleIndex===index);assert(effect);
 const path=[...r.selectedPathBefore.map(([,p])=>p),r.placement];
 witnesses.push({branch,scenario:r.scenario,depth:r.depth,path,reserve:r.reserve,remaining:r.normalizedRemainingAfter,
  syntheticBag:r.syntheticBag,oldAllowance:r.cutoutAllowance,newAllowance:0,
  cutouts:r.cutouts,localCutoutEffect:effect.totalLocalDelta,localTslotEffect:effect.tslot,localBoardEffect:effect.baseDelta,
  stages:r.stages,realBoardCols:r.realBoardCols,evaluatedBoardCols:r.evaluatedBoardCols,
  limitation:'Conditional local removal arithmetic from stored witness, not candidate resimulation or root score attribution.'});
}
const summary={oldPlaceLead:oldWinner.baselineMean-hold.baselineMean,newHoldLeadOverOldPlace:hold.candidateMean-oldWinner.candidateMean,
 newHoldLeadOverBestPlace:c.candidates[0].mean_score-c.candidates.find(x=>x.action.kind==='place').mean_score,
 oldPlaceDelta:oldWinner.meanDelta,holdDelta:hold.meanDelta,beforeGroups,afterGroups,matchedWitnesses:matched.length,
 changedMatchedLocalScores:matched.filter(x=>x.oldEval!==x.newEval||x.oldReward!==x.newReward).length,
 matchedRewardChanges:0,matchedPreCutoutChanges:0};
const result={schema:'kiwi-tslot-decision-audit/1',runs:[36551709585,36566413689],id,
 inputSha256:createHash('sha256').update(JSON.stringify(input.request)).digest('hex'),publicSnapshot:input.snapshot,
 summary,rootRankings:ranks,baselineTop1Geometry:{move:normalized.move,clear:proof.clear,spin:proof.finalPiece.spin},
 witnesses,matchedWitnesses:matched,
 limits:'Root scores include changed search exploration and backup. No winning continuation or per-scenario root score decomposition was recorded. Sample absence cannot prove unsearched. No KO strength evidence.'};
await writeFile(`${dir}/TSLOT_DECISION_AUDIT.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
console.log(JSON.stringify(witnesses.map(({stages,cutouts,...w})=>w),null,2));
