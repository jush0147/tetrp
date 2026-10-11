// Offline aggregation of WHOLE original seeds from genuine authority forks.
// Each original public checkpoint is one design unit. All scenario branches
// share it; never count them as separate KO games or use window differences
// as learned reward labels.
import {readFileSync,writeFileSync} from 'node:fs';

const originalSeeds=[67720,67722,67723];
// Nonparametric descriptive Pareto check: no learned coefficients,
// no guessed conversion of attack/holes into a scalar winner.
// All 4 dimensions are actual authority+public-board results.
// B=Kiwi root, then ROOK; C=identical Kiwi root then Kiwi locks 2-3.
export function classifyConditionalPareto(h){
  if(!h?.complete)return 'censored';
  if(h.bothAlive!==true)return 'terminal-or-ko-at-horizon';
  const g=h.firstMinusSecondCombat; // B minus C
  const values=[g?.sent,-g?.tanked,-h.holesGap,-h.heightGap];
  if(values.some(v=>!Number.isFinite(v)))
    throw Error('Missing authority combat or real public board dimensions');
  if(values.every(v=>v===0))return 'identical-on-four-metrics';
  if(values.every(v=>v>=0))return 'one-lock-B-Pareto-dominates';
  if(values.every(v=>v<=0))return 'three-lock-C-Pareto-dominates';
  return 'tradeoff-or-conflict';
}
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
    const changed=s.futureTwoLockActionDifferences.some(v=>v.differentChoices);
    // Strict negative control: if Kiwi and ROOK actually chose the SAME
    // next two legal actions, and thereafter both arms use ROOK, identical
    // private futures must continue identically at every complete horizon.
    if(!changed){
      for(const h of s.kiwiContinuationEffectGivenSameRoot){
        if(!h.complete)continue;
        if(h.identicalCandidateBoard!==true||
          h.identicalOpponentBoard!==true||
          h.identicalCandidatePublicState!==true||
          h.occupiedCellMismatch!==0||
          Object.values(h.firstMinusSecondCombat).some(value=>value!==0))
          throw Error('UNEXPLAINED_STRATEGY_LABEL_EFFECT: same action chain unexpectedly diverged');
      }
    }
    return {
      scenario:s.scenario,
      actionDifferenceOnLocks2or3:changed,
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
            commit.occupiedCellMismatch:null,
          pareto:classifyConditionalPareto(commit)};
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
  const paretoCounts=Object.fromEntries([
    'one-lock-B-Pareto-dominates',
    'three-lock-C-Pareto-dominates',
    'identical-on-four-metrics',
    'tradeoff-or-conflict',
    'terminal-or-ko-at-horizon',
    'censored'
  ].map(type=>[type,comparisons.filter(q=>q.pareto===type).length]));
  if(Object.values(paretoCounts).reduce((a,v)=>a+v,0)!==comparisons.length)
    throw Error('Missing paired Pareto disposition');
  return {horizon:h,paretoCounts,originalSeedsWithAtLeastOneComplete:
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
