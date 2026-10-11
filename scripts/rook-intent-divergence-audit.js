// Forensic replay analysis only. NOT new independent KO trials.
// Every observation is conditional on an already-scored ORIGINAL game seed.
import {readFileSync,writeFileSync} from 'node:fs';
const seeds=[67812,67814,67815];
const verdicts={67812:'persistent',67814:'reactive',67815:'reactive'};
const base=process.env.ROOK_FORENSIC_ROOT??'forensic-artifacts';
const rows=seeds.map(seed=>{
  const file=`${base}/rook-first-public-strategy-root-forensic-${seed}/forensic.jsonl`;
  const lines=readFileSync(file,'utf8').trim().split('\n').filter(Boolean);
  if(lines.length!==1)throw Error('Expected exactly one original public-seed replay '+seed);
  const row=JSON.parse(lines[0]),diff=row.firstSamePublicDivergence;
  if(row.seed!==seed||row.error||!row.sameSeed||
    row.swapRoles!=='0'||!row.expertStrategic||
    !row.compareReactiveStrategy||!row.simultaneousLocks||
    row.identicalPublicActionChanges!==1||!diff||
    diff.originalSeed!==seed||diff.turn!==row.firstIdenticalPublicActionDifference||
    diff.pairedChoices?.length!==2||diff.before?.next5?.length!==5)
    throw Error('Invalid authentic first strategy fork on original seed '+seed);
  const [a,b]=diff.pairedChoices;
  if(a.kind!=='public-strategic-intent'||
    b.kind!=='reactive-strategic-intent'||
    a.legalExecutedActions===b.legalExecutedActions||
    JSON.stringify(a.signals)!==JSON.stringify(b.signals))
    throw Error('Not the exact same player-visible first decision on '+seed);
  const after=[1,4,8,16,32].map(h=>{
    const snap=row.divergenceSnapshots.find(s=>s.afterLocks===h);
    if(!snap)return {horizon:h,complete:false,reason:
      'KO or bounded replay ended before requested followup'};
    if(snap.slots?.length!==2)throw Error('No authoritative slots');
    const [p,r]=snap.slots;
    return {horizon:h,complete:true,bothAlive:snap.bothAlive,
      sentDifference:p.sent-r.sent,
      tankedDifference:p.tanked-r.tanked,
      heightDifference:p.height-r.height,
      holesDifference:p.holes-r.holes,
      garbageDifference:p.garbage-r.garbage,
      btbDifference:p.btb-r.btb};
  });
  return {originalSeed:seed,previousGenuineKOResult:verdicts[seed],
    originalPublicFirstDivergenceLock:diff.turn,
    identicalPublicSignals:a.signals,
    persisted:{mode:a.mode,immediateDesired:a.desired,
      retained:a.retained,actualMove:a.legalExecutedActions,
      searchNodes:a.evaluatedNodes},
    reactive:{mode:b.mode,immediateDesired:b.desired,
      retained:b.retained,actualMove:b.legalExecutedActions,
      searchNodes:b.evaluatedNodes},
    observationWindows:after,
    replayOnly:true};
});
const out={format:'rook-original-seed-first-public-intent-fork-forensics/1',
  originalIndependentSeeds:rows.length,additionalIndependentGames:0,
  windows:[1,4,8,16,32],
  rows,policyImproved:false,
  interpretation:'All three rows reuse original scored seeds 67812/67814/67815. Same-visible-state action differences and authority followup are descriptive, and do not identify robust causal policy value or support reward retuning.'};
writeFileSync(process.env.ROOK_FORENSIC_OUTPUT??'first-divergence-audit.json',
  JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({seedCount:out.originalIndependentSeeds,
  additionalIndependentGames:0,
  scenarios:rows.map(r=>({seed:r.originalSeed,
    winnerPreviously:r.previousGenuineKOResult,
    turn:r.originalPublicFirstDivergenceLock,
    desired:r.persisted.immediateDesired,
    persistentMode:r.persisted.mode,
    reactiveMode:r.reactive.mode,
    modeRetained:r.persisted.retained,
    firstActionPersistent:r.persisted.actualMove,
    firstActionReactive:r.reactive.actualMove,
    authorityWindows:r.observationWindows})),
  reminder:out.interpretation}));
