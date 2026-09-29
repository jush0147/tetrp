// Static impact audit of a proposed resource-count substitution.
// Does not run search, change evaluator, or estimate a KO win rate.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const dir='docs/audits/cc2-alignment';
const observed=JSON.parse(await readFile('.cache/eval-run-36551709585/observed.json','utf8'));
const effects=JSON.parse(await readFile(`${dir}/TSLOT_WITNESS_GEOMETRY.json`,'utf8')).effects;
function knownT(remaining,reserve){return remaining.filter(p=>p==='T').length+Number(reserve==='T');}
// Resource-count invariants only; no claim that T can be played immediately.
assert.equal(knownT([], 'S'),0);
assert.equal(knownT([], 'T'),1);
assert.equal(knownT(['T','J','T'],'T'),3);
assert.equal(knownT(['J','O'],'S'),0);
const rows=[];
for(const input of observed){
 const samples=input.diagnostic.rows;let rewriteIndex=0;
 const cases=samples.map((row,index)=>{
  const proposed=knownT(row.normalizedRemainingAfter,row.reserve);
  const currentRewriteIndex=row.category==='board_rewrite'?rewriteIndex++:null;
  const effect=currentRewriteIndex===null?null:effects.find(e=>e.id===input.id&&e.sampleIndex===currentRewriteIndex);
  if(row.category==='board_rewrite')assert(effect);
  const tslot=row.stages.find(s=>s.stage==='tslot').deltaEval;
  // Only the zero-resource case is exactly determined by existing traces:
  // cutout loop disappears, base features stay on real board. More/fewer-but-
  // nonzero loops need actual reevaluation and may discover different templates.
  const determinedDelta=proposed===0?-(effect?.baseDelta??0)-tslot:null;
  return {index,depth:row.depth,branch:row.branch,scenario:row.scenario,category:row.category,
   existingAllowance:row.cutoutAllowance,proposedKnownT:proposed,
   direction:proposed===row.cutoutAllowance?'same':proposed>row.cutoutAllowance?'increase':'decrease',
   determinedLocalDelta:determinedDelta};
 });
 rows.push({id:input.id,samples:cases.length,same:cases.filter(c=>c.direction==='same').length,
  increase:cases.filter(c=>c.direction==='increase').length,decrease:cases.filter(c=>c.direction==='decrease').length,
  zeroTTemplateHits:cases.filter(c=>c.proposedKnownT===0&&c.category!=='control').length,
  zeroTBoardRewrites:cases.filter(c=>c.proposedKnownT===0&&c.category==='board_rewrite').length,cases});
}
const result={schema:'kiwi-tslot-resource-proposal/1',date:'2026-09-29',sourceRun:36551709585,
 hypothesis:'Replace synthetic-bag cutout allowance with post-transition normalized remaining known T count plus reserve T. Unknown-tail contribution zero in this candidate only.',
 scope:'Quota-selected stored witnesses. Count substitution only; no counterfactual root ranking. Nonzero proposed count cases not reevaluated. All observed Hold slots occupied.',
 rows};
await writeFile(`${dir}/TSLOT_RESOURCE_PROPOSAL_EVIDENCE.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(rows.map(({cases,...r})=>r)));
