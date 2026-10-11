// Offline aggregation of WHOLE original seeds from genuine authority forks.
// Each original public checkpoint is one design unit. All scenario branches
// share it; never count them as separate KO games or use window differences
// as learned reward labels.
import {readFileSync,writeFileSync} from 'node:fs';

const originalSeeds=[67720,67722,67723];
const rows=originalSeeds.map(seed=>{
  const file=(process.env.PAIRED_ROOT_DIR??'fidelity-traces')+
    '/rook-3lock-fidelity-'+seed+'/fidelity.json';
  const x=JSON.parse(readFileSync(file,'utf8'));
  if((x.independentSeed??x.seed)!==seed)
    throw Error('Wrong source original seed '+seed);
  if(x.status==='no-eligible-public-conflict'){
    if(x.scored!==false)return;
    return {seed,eligible:false};
  }
  const ex=x.conditionalExperiment;
  if(!x.strategicWindow||x.scoredWindowTrial!==false||
    x.opponentKind!=='kiwi'||x.originalPublicNextCount!==5||
    !x.identicalAuthorityCheckpoint||
    ex?.conditionalPrivateScenarios!==3||
    ex?.strategyCommitLocks!==3||ex.scenarios?.length!==3)
    throw Error('Invalid research experiment '+seed);
  const pairs=ex.scenarios.map(s=>{
    if(s.treatmentResults?.length!==3||
      !s.sameFirstLockedPieceAndPrivateAuthority||
      s.futureTwoLockActionDifferences.length!==2)
      throw Error('FIRST LOCK causal parity missing '+seed);
    const [a,b,c]=s.treatmentResults;
    if(![a,b,c].every(r=>r.scored===false&&!r.error))
      throw Error('Unexpected failed or scored diagnostic '+seed);
    if(b.rootSignature!==c.rootSignature||
      b.first3LockActions[0].candidateActions.join('|')!==
        c.first3LockActions[0].candidateActions.join('|'))
      throw Error('Different Kiwi FIRST lock invalidates continuation contrast');
    return {
      scenario:s.scenario,
      actionDifferenceOnLocks2or3:
        s.futureTwoLockActionDifferences.some(v=>v.differentChoices),
      completeExtraDecisions:
        s.futureTwoLockActionDifferences.every(v=>v.bothReached),
      horizons:[4,8,16,32].map(horizon=>{
        const root=s.rootOnlyFirstVersusKiwi.find(x=>x.horizon===horizon);
        const commit=s.kiwiContinuationEffectGivenSameRoot.find(x=>
          x.horizon===horizon);
        if(!root||!commit)throw Error('Missing declared time horizon');
        return {horizon,
          rootComplete:root.complete,commitComplete:commit.complete,
          rootSentGap:root.complete?root.firstMinusSecondCombat.sent:null,
          extraKiwiSentGap:commit.complete?
            commit.firstMinusSecondCombat.sent:null,
          extraKiwiTankedGap:commit.complete?
            commit.firstMinusSecondCombat.tanked:null,
          extraKiwiBoardMismatch:commit.complete?
            commit.occupiedCellMismatch:null};
      })
    };
  });
  return {seed,eligible:true,originalTurn:x.forkTurn,
    conflictKind:x.strategicSelection.kind,
    conditionalScenarios:pairs};
});
if(rows.some(x=>x===undefined))throw Error('Invalid missing scenario');
const eligible=rows.filter(r=>r.eligible);
const horizonSummaries=[4,8,16,32].map(h=>{
  const comparisons=eligible.flatMap(r=>r.conditionalScenarios
    .map(s=>({seed:r.seed,...s.horizons.find(x=>x.horizon===h)})));
  const complete=comparisons.filter(r=>r.commitComplete);
  return {horizon:h,originalSeedsWithAtLeastOneComplete:
    new Set(complete.map(r=>r.seed)).size,
    completedConditionedScenarios:complete.length,
    censoredConditionedScenarios:comparisons.length-complete.length,
    extraKiwiActuallySentMore:complete.filter(r=>
      r.extraKiwiSentGap<0).length,
    extraKiwiActuallySentLess:complete.filter(r=>
      r.extraKiwiSentGap>0).length,
    equalActualSent:complete.filter(r=>
      r.extraKiwiSentGap===0).length,
    explicitlyNotAnIndependentSample:true};
});
const report={
  format:'rook-whole-seed-causal-strategy-fidelity/1',
  originalSeedCount:rows.length,eligibleSeedCount:eligible.length,
  conditionalFuturesPerEligibleOriginal:3,
  originalSeedsWithGenuineExtraActionChanges:eligible.filter(r=>
    r.conditionalScenarios.some(s=>
      s.actionDifferenceOnLocks2or3)).map(r=>r.seed),
  originalSeeds:rows,horizonSummaries,
  scoredFullKOs:0,policyPromoted:false,
  limitations:'Scenario count and horizons are correlated within each original seed, and 3 Kiwi locks are a behavioral intervention, not a learned or validated policy. No victory or independent-game claims.'};
writeFileSync(process.env.STRATEGY_AUDIT_OUT??'strategy-audit.json',
  JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({format:report.format,originalSeedCount:rows.length,
  eligibleSeeds:eligible.length,
  actionChangedSeedIds:report.originalSeedsWithGenuineExtraActionChanges,
  horizonSummaries,limitations:report.limitations},null,2));
