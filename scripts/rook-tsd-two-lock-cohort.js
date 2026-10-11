// Diagnostic only: prove CURRENT then publicly known NEXT/Hold T creates a
// real two-lock Full TSD on the recorded board, absent new incoming garbage.
import {readFileSync,writeFileSync} from 'node:fs';
import {findPublicTwoLockTsd} from '../src/analysis/rook-tsd-two-lock.js';
const saved=readFileSync(process.env.ROOK_ALL_PUBLIC_TRACE??
  'rook-all-public-locks.jsonl','utf8').trim().split('\n')
  .filter(Boolean).map(JSON.parse);
const rows=[];
for(const x of saved){
  const v=x.visible;
  if(v?.next?.length!==5||'bag' in v||'rng' in v||'holes' in v)
    throw Error('Public NEXT5 restriction violated');
  const start=performance.now();
  const r=findPublicTwoLockTsd(v,{firstStates:1200,
    secondStates:2400,maxSteps:70,maxPlans:4});
  rows.push({seed:x.seed,kind:x.kind,turn:x.turn,
    knownT:r.nextT||r.heldT,firstMoves:r.firstMoves,
    fullGeometryAfterOneMove:r.geometricReady,
    secondSrsProofCalls:r.secondProofCalls,
    provedPlanCount:r.plans.length,
    hasProvedTwoLockTsd:r.plans.length>0,
    anyHoldTPlan:r.plans.some(p=>p.second.viaHold),
    truncation:r.truncated,ms:Math.round(performance.now()-start)});
}
const groups=['rook','kiwi'].map(kind=>{
  const group=rows.filter(x=>x.kind===kind);
  const eligible=group.filter(x=>x.knownT);
  return {kind,states:group.length,publicNextOrHoldT:eligible.length,
    readyGeometryAfterOneLock:eligible.filter(x=>x.fullGeometryAfterOneMove>0).length,
    atLeastOneProvedTwoLockTsd:eligible.filter(x=>x.hasProvedTwoLockTsd).length,
    usedHoldT:eligible.filter(x=>x.anyHoldTPlan).length,
    truncated:eligible.filter(x=>x.truncation).length,
    totalSecondSrsCalls:eligible.reduce((a,x)=>a+x.secondSrsProofCalls,0),
    ms:eligible.reduce((a,x)=>a+x.ms,0)};
});
const report={format:'rook-real-public-two-lock-tsd-proof/1',
  total:rows.length,independentSeeds:new Set(rows.map(x=>x.seed)).size,
  groups,rows,
  caution:'BOTH placements have individual real SRS+ witnesses on hypothetical static intermediate boards. No hidden sixth piece is used. Incoming opponent garbage, Hold commit timing and dynamic packet events may alter the board; this is a bounded, diagnostic two-lock route, not a guaranteed future TSD or a KO.'};
if(process.env.ROOK_TWO_LOCK_OUTPUT)
  writeFileSync(process.env.ROOK_TWO_LOCK_OUTPUT,
    JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined}));
