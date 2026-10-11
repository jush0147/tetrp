// Non-KO research screen. SAME bounded forward multi-ply planner runs on
// real public ROOK and Kiwi boards, using no authority-private information.
import {readFileSync,writeFileSync} from 'node:fs';
import {searchPublicForwardTsd} from '../src/analysis/rook-forward-attack.js';

const input=process.env.ROOK_PUBLIC_LOCK_TRACE??
  'rook-all-public-locks.jsonl';
const data=readFileSync(input,'utf8').trim().split('\n')
  .filter(Boolean).map(JSON.parse);
if(!data.length)throw Error('No prior public lock observations');
const settings={beamWidth:16,maxPlacementEvaluations:2500,
  maxProofCalls:85,maxStates:800,maxSteps:70,maxPlans:3};
const rows=[];
for(const x of data){
  if(!['rook','kiwi'].includes(x.kind)||x.visible?.next?.length!==5||
    'bag' in x.visible||'rng' in x.visible||'holes' in x.visible)
    throw Error('Non-public or invalid source snapshot');
  const known=[x.visible.current.type,...x.visible.next];
  const tIndex=known.indexOf('t');
  if(tIndex<2||tIndex>4)continue;
  const original=JSON.stringify(x.visible),start=performance.now();
  const result=searchPublicForwardTsd(x.visible,settings);
  if(JSON.stringify(x.visible)!==original)
    throw Error('Public snapshot mutated by planner');
  if(result.stats.proofCalls>settings.maxProofCalls||
    result.stats.placements>settings.maxPlacementEvaluations)
    throw Error('Bounded forward search exceeded budget');
  if(result.plans.some(p=>!p.evidence.allMovesSrsWitnessed||
    !p.evidence.terminalFullTsd||p.planLength!==tIndex+1||
    p.witnesses.length!==tIndex+1))
    throw Error('Unproved or invalid promised TSD plan');
  rows.push({seed:x.seed,owner:x.kind,turn:x.turn,
    targetPly:tIndex+1,found:result.plans.length,
    truncated:result.stats.truncated,
    garbageAborts:result.stats.garbageAborts,
    proofCalls:result.stats.proofCalls,
    evaluated:result.stats.placements,
    elapsedMs:Number((performance.now()-start).toFixed(1)),
    firstAction:result.plans[0]?.actions[0]??null});
}
const groups=['rook','kiwi'].map(owner=>{
  const x=rows.filter(r=>r.owner===owner);
  return {owner,eligiblePublicStates:x.length,
    foundAtLeastOnePlan:x.filter(r=>r.found>0).length,
    truncated:x.filter(r=>r.truncated).length,
    garbageAborts:x.reduce((n,r)=>n+r.garbageAborts,0),
    placementEvaluations:x.reduce((n,r)=>n+r.evaluated,0),
    totalMs:Number(x.reduce((n,r)=>n+r.elapsedMs,0).toFixed(1))};
});
const report={format:'rook-public-multipiece-forward-tsd-cohort/1',
  inputPublicLocks:data.length,
  independentSeeds:new Set(data.map(r=>r.seed)).size,
  plansOnlyWithKnownPublicT:true,
  settings,groups,rows,
  caveat:'Overlapping real public boards from previous historical games; NOT independent events or scored KO. Per-step SRS+ witnessed conditional on the known public sequence; incoming hidden opponent garbage may invalidate a future board. Bounded beam may miss legal alternatives. Purely geometric setup scores guide search, not guaranteed attack.'};
if(process.env.ROOK_FORWARD_TSD_REPORT)
  writeFileSync(process.env.ROOK_FORWARD_TSD_REPORT,
    JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined}));
