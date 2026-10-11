// Count conditional genuine SRS+ setup + occupied-Hold T Full TSD routes.
// Historic public boards only, NOT a new opponent game or a KO claim.
import {readFileSync,writeFileSync} from 'node:fs';
import {searchPublicForwardTsd} from '../src/analysis/rook-forward-attack.js';
const rows=readFileSync(process.env.ROOK_PUBLIC_LOCK_TRACE??
  'rook-all-public-locks.jsonl','utf8').trim().split('\n')
  .filter(Boolean).map(JSON.parse);
const config={beamWidth:16,maxPlacementEvaluations:2500,maxProofCalls:85,
  maxStates:800,maxSteps:70,maxPlans:3,
  heldTFinish:true,heldTSetupPieces:3};
const results=[];
for(const x of rows){
  const v=x.visible;
  if(v?.next?.length!==5||'bag' in v||'rng' in v||'holes' in v)
    throw Error('Non-public source board in held-T screen');
  if(v.hold?.piece!=='t')continue;
  const before=JSON.stringify(v),start=performance.now();
  const r=searchPublicForwardTsd(v,config);
  if(JSON.stringify(v)!==before||r.stats.proofCalls>85||
    r.stats.placements>2500||
    r.plans.some(p=>p.actions.filter(a=>a.action.kind==='hold').length!==1||
      p.actions.at(-2).action.mode!=='occupied'||
      p.actions.at(-1).execution.spin!=='full'||
      !p.evidence.allMovesSrsWitnessed||!p.evidence.terminalUsesHeldT))
    throw Error('Illegal or private held-T TSD portfolio');
  results.push({seed:x.seed,owner:x.kind,turn:x.turn,
    found:r.plans.length,garbageAborts:r.stats.garbageAborts,
    truncated:r.stats.truncated,proofCalls:r.stats.proofCalls,
    evaluations:r.stats.placements,
    elapsedMs:Number((performance.now()-start).toFixed(1)),
    firstAction:r.plans[0]?.actions[0]??null});
}
const groups=['rook','kiwi'].map(owner=>{
  const x=results.filter(r=>r.owner===owner);
  return {owner,heldTObservedPublicStates:x.length,
    witnessedHeldTFullTsdPlan:x.filter(r=>r.found>0).length,
    truncated:x.filter(r=>r.truncated).length,
    garbageAborts:x.reduce((n,r)=>n+r.garbageAborts,0),
    actualSrsCalls:x.reduce((n,r)=>n+r.proofCalls,0),
    ms:Number(x.reduce((n,r)=>n+r.elapsedMs,0).toFixed(1))};
});
const report={format:'rook-public-held-T-forward-portfolio/1',
  independentSeeds:new Set(rows.map(r=>r.seed)).size,
  sourcePublicLocks:rows.length,settings:config,groups,results,
  caveat:'One previous seed, correlated frames with a T stored in Hold, not independent T-hold actions. Real SRS+ proof on every static hypothetical board with an occupied Hold swap before terminal TSD. Unknown incoming opponent garbage may invalidate the intermediate setup. This does not say whether a plan should be chosen or improves KO.'};
if(process.env.ROOK_HELD_T_REPORT)
  writeFileSync(process.env.ROOK_HELD_T_REPORT,
    JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,results:undefined}));
