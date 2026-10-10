// Reproducible CPU-cost calibration from archived player-visible Kiwi KO
// observations. No authority-private fields, no new Kiwi search, no KO claim.
import {readFileSync,writeFileSync} from 'node:fs';
import {chooseMove} from '../src/analysis/rook.js';
import {actionSignature} from '../src/analysis/rook-disagreement.js';
const observations=readFileSync(process.env.ROOK_CPU_PUBLIC_SNAPSHOTS??
  'rook-public-observations.jsonl','utf8').trim().split('\n').map(JSON.parse);
const refs=readFileSync(process.env.ROOK_CPU_PREVIOUS_DIFF??
  'rook-choice-diff.jsonl','utf8').trim().split('\n').map(JSON.parse);
if(observations.length!==22||refs.length!==22||
   new Set(observations.map(r=>r.seed)).size!==2)throw Error('Invalid pinned public cohort');
const common={maxStates:1200,maxSteps:42};
const configs=[{id:'exact-fifth-4x24',options:{depth:4,beamWidth:24,
  maxNodes:6000,exactLeafExtension:true,leafExtensionBudget:5000,
  leafExtensionStates:800}},
  {id:'deeper-5x128',options:{depth:5,beamWidth:128,
    maxNodes:120000,futureReachableProbes:15}}];
const rows=[];
for(let i=0;i<observations.length;i++){
  const o=observations[i],before=JSON.stringify(o.visible);
  if(o.visible?.next?.length!==5||'bag' in o.visible||
    'holes' in o.visible||'rng' in o.visible||o.seed!==refs[i].seed)
    throw Error('Public information contract/identity mismatch');
  const options=[];
  for(const cfg of configs){
    const start=performance.now();
    const result=chooseMove(o.visible,{...common,...cfg.options});
    const elapsed=performance.now()-start;
    options.push({id:cfg.id,ms:elapsed,action:actionSignature(result),
      evaluated:result.diagnostics.evaluated,
      extraEvaluated:result.diagnostics.leafExtensionEvaluated??0});
  }
  if(JSON.stringify(o.visible)!==before)throw Error('Policy mutated public state');
  rows.push({seed:o.seed,turn:o.turn,owner:o.owner,
    differentRoot:options[0].action!==options[1].action,options});
}
const totals=idx=>{
  const ms=rows.reduce((sum,row)=>sum+row.options[idx].ms,0);
  return {totalMs:Number(ms.toFixed(1)),meanMs:Number((ms/rows.length).toFixed(1)),
    evaluated:rows.reduce((sum,row)=>sum+row.options[idx].evaluated,0),
    extraEvaluated:rows.reduce((sum,row)=>sum+row.options[idx].extraEvaluated,0)};
};
const candidate=totals(0),deeper=totals(1);
const output={format:'rook-near-cpu-control-public-screen/1',
  observations:rows.length,independentSeeds:2,
  candidate,deeper,ratio:Number((candidate.totalMs/deeper.totalMs).toFixed(3)),
  differentRoot:rows.filter(r=>r.differentRoot).length,rows,
  disclaimer:'This is overlapping public-position timing from two independent seeds, not a hard CPU cap or scored KO performance.'};
if(process.env.ROOK_CPU_OUTPUT)writeFileSync(process.env.ROOK_CPU_OUTPUT,
  JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({...output,rows:undefined}));
