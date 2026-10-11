// Read-only decomposed-root counterfactual on ORIGINAL published NEXT5 data.
// Holds the original finalists/path constant. It is not a search with changed
// weights, does not predict the resulting beam, and is NOT KO/causal proof.
import {readFileSync} from 'node:fs';

const rows=readFileSync('rook-choice-diff.jsonl','utf8')
  .trim().split('\n').map(JSON.parse);
if(rows.length!==22||new Set(rows.map(r=>r.seed)).size!==2)
  throw Error('Wrong original Kiwi diagnosis cohort');
const cases=[];
for(const row of rows){
  if(row.classification==='agreement')continue;
  const x=row.rootComparison?.chosen,y=row.rootComparison?.kiwi;
  if(!x||!y||!Number.isFinite(row.rootComparison?.scoreGap)||
    !Number.isFinite(x.terms?.holes)||!Number.isFinite(y.terms?.holes))
    throw Error('Missing original finalist scoring decomposition');
  const discountedHoleX=x.terms.holes*Math.pow(.88,x.depth);
  const discountedHoleY=y.terms.holes*Math.pow(.88,y.depth);
  const holeDifference=discountedHoleX-discountedHoleY;
  const baselineGap=row.rootComparison.scoreGap;
  const noHolesGap=baselineGap-holeDifference;
  const halfHolesGap=baselineGap-holeDifference*.5;
  // If both final paths remain FIXED, a zero penalty could make the original
  // Kiwi root look better. This is NOT a prediction of re-running the beam.
  const knockoutAtZero=noHolesGap<0;
  cases.push({seed:row.seed,turn:row.turn,owner:row.owner,
    classification:row.classification,
    chosenPly:x.depth,kiwiPly:y.depth,
    baselineGap,holeDifference,
    halfHolesGap,noHolesGap,
    zeroHoleWouldReverseFinalistRanking:knockoutAtZero});
}
const result={format:'rook-hole-gap-fixed-finalists/1',
  correlatedPositions:cases.length,historicalIndependentSeeds:2,
  meanBaselineGap:cases.reduce((a,x)=>a+x.baselineGap,0)/cases.length,
  meanDiscountedHoleContribution:cases.reduce((a,x)=>
    a+x.holeDifference,0)/cases.length,
  zeroPenaltyRankingFlips:cases.filter(x=>
    x.zeroHoleWouldReverseFinalistRanking).length,
  halfPenaltyRankingFlips:cases.filter(x=>x.halfHolesGap<0).length,
  note:'Frozen original finalist trajectories only: DOES NOT incorporate beam search/action changes, and is not a new independent Kiwi KO outcome.',
  cases};
console.log(JSON.stringify(result));
