// TRUE full-match KO data only; SWAPPED player positions share one original
// 7-bag seed and must never be counted as independent observations.
import {readFileSync,writeFileSync} from 'node:fs';

const seeds=[67812,67813,67814,67815];
const base=process.env.INTENT_REPLICATION_DIR??'replication-artifacts';
const rows=seeds.map(seed=>{
  const filename=`${base}/rook-intent-role-swap-original-seed-${seed}/replication.jsonl`;
  const matches=readFileSync(filename,'utf8').trim()
    .split('\n').filter(Boolean).map(JSON.parse);
  if(matches.length!==2||matches[0].swap!==false||
    matches[1].swap!==true||matches.some(r=>r.seed!==seed||
      r.error||r.cap!==2000||r.swapRoles!=='1'||!r.sameSeed||
      !r.simultaneousLocks||r.slots.length!==2||
      r.candidateNodeBudget!==3000||r.baselineNodeBudget!==3000||
      !['KO','double-KO','capped'].includes(r.termination)||
      r.scored!==(r.termination==='KO')))
    throw Error('Invalid real ROOK role-swap authority pair seed '+seed);
  const sides=matches.map(r=>{
    const p=r.slots.find(x=>x.kind==='public-strategic-intent');
    const q=r.slots.find(x=>x.kind==='reactive-strategic-intent');
    if(!p||!q)throw Error('Unrecognized original actual ROOK policies');
    return {winner:r.winner,scored:r.scored,termination:r.termination,
      turns:r.turns,firstSamePublicDifference:r.firstIdenticalPublicActionDifference,
      samePublicActionChanges:r.identicalPublicActionChanges,
      persistent:{sent:p.sent,tanked:p.tanked,nodes:p.nodes,
        searches:p.searches,cpuMs:p.ms,retained:p.intentRetained},
      reactive:{sent:q.sent,tanked:q.tanked,nodes:q.nodes,
        searches:q.searches,cpuMs:q.ms}};
  });
  const [a,b]=sides;
  // Swapping player slots MUST NOT masquerade as additional stochastic
  // evidence. Outcome, attacks, searches and chosen root histories should
  // be identical; CPU may differ due to runner scheduling.
  for(const key of ['winner','scored','termination','turns',
    'firstSamePublicDifference','samePublicActionChanges'])
    if(a[key]!==b[key])throw Error('Slot-order bias '+seed+' '+key);
  for(const policy of ['persistent','reactive'])
    for(const key of ['sent','tanked','nodes','searches','retained'])
      if(a[policy][key]!==b[policy][key])
        throw Error('Slot-order policy drift '+seed+' '+policy+' '+key);
  const cpuRatios=sides.map(x=>x.persistent.cpuMs/x.reactive.cpuMs);
  return {seed,independentOriginalSeed:true,
    symmetricRoleSwapVerified:true,correlatedGames:2,
    scored:a.scored,termination:a.termination,turns:a.turns,
    winner:a.scored?a.winner:null,
    firstSamePublicDifference:a.firstSamePublicDifference,
    samePublicActionChanges:a.samePublicActionChanges,
    persistent:a.persistent,reactive:a.reactive,
    persistentCpuRatiosByPlayerSlot:cpuRatios.map(x=>+x.toFixed(4)),
    actualNodeTotalsEqual:a.persistent.nodes===a.reactive.nodes};
});
const won=rows.filter(x=>x.winner==='public-strategic-intent');
const lost=rows.filter(x=>x.winner==='reactive-strategic-intent');
const drawn=rows.filter(x=>x.winner===null);
const out={format:'rook-real-KO-strategy-intent-independent-seed-audit/1',
  originalIndependentSeedCount:seeds.length,
  correlatedSwappedGames:rows.length*2,
  trueKOScoredMatches:rows.filter(x=>x.scored).length,
  genuineOriginalSeedWins:{persistent:won.length,reactive:lost.length},
  unscoredOriginalSeeds:drawn.length,
  originalSeedRows:rows,
  defaultRookChanged:false,
  notAnEqualCpuClaim:true,
  caveats:'Same-seed swapped-player games are deterministically identical, not independent wins. Short-window attack metrics are not a substitute for true KO. CPU and actual total nodes can differ despite 3000 nodes per search.'};
writeFileSync(process.env.INTENT_REPLICATION_OUT??'role-swap-audit.json',
  JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({independentSeeds:out.originalIndependentSeedCount,
  pairedSwappedMatches:out.correlatedSwappedGames,
  trueKO:out.trueKOScoredMatches,
  seedLevelWins:out.genuineOriginalSeedWins,
  rows:rows.map(x=>({seed:x.seed,winner:x.winner,turns:x.turns,
    sideSwapInvariant:x.symmetricRoleSwapVerified,
    firstPublicActionChanges:x.samePublicActionChanges,
    cpuRatios:x.persistentCpuRatiosByPlayerSlot,
    actualNodesEqual:x.actualNodeTotalsEqual})),
  note:out.caveats}));
