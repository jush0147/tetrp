// Research-only original-SEED aggregation of frozen real authority replay
// artifacts. Correlated locks in a seed are NEVER independent games or wins.
// Pinned Kiwi != matched CPU and the short capped runs are UN-SCORED.
import {readFileSync,writeFileSync} from 'node:fs';

const sources=[
  {seed:67920,path:'plan-source/rook-true-kiwi-public-next-plan-fidelity-67920/with-audit.jsonl'},
  {seed:67921,path:'stress-source/rook-real-pressure-forecast-original-seed-67921/original-game.jsonl'},
  {seed:67922,path:'stress-source/rook-real-pressure-forecast-original-seed-67922/original-game.jsonl'}
];
const permitted=['placement-srs-proven','hold-plus-placement-srs-proven',
  'public-precondition-changed','placement-no-srs-proof',
  'hold-valid-but-placement-unproven','hold-not-permitted'];
const rows=sources.map(({seed,path})=>{
  const lines=readFileSync(path,'utf8').trim().split('\n').filter(Boolean);
  if(lines.length!==1)throw Error('One genuine original game only '+seed);
  const x=JSON.parse(lines[0]),f=x.forecastAudit;
  if(x.seed!==seed||x.order!==0||x.error||!x.sameSeed||
    !x.simultaneousLocks||x.scored!==false||
    x.termination!=='capped'||x.winner!==null||
    x.nodeBudgets?.rook!==3000||x.nodeBudgets?.kiwi!==32768||
    !f||f.executedFullGameWithoutChangingSelection!==true||
    f.samples?.length!==f.actualNextLockChecks)
    throw Error('Not capped one-seed genuine live authority forecast '+seed);
  let direct=0,hold=0,changed=0,invalidProof=0,other=0;
  const mismatchDimensions={board:0,current:0,hold:0,pending:0,
    btb:0,combo:0};
  for(const a of f.samples){
    if(a.seed!==seed||!permitted.includes(a.status)||
      a.atActualTurn!==a.fromTurn+1||
      a.postHoldAuthorityProof?.authorityFutureExposed===true||
      'next6' in a||'rng' in a||'privateBag' in a)
      throw Error('Nonpublic or nondeterministic step in source '+seed);
    if(a.status==='placement-srs-proven'){
      if(!a.verifiedPlacement||!a.all)throw Error('False direct SRS proof');
      direct++;
    }else if(a.status==='hold-plus-placement-srs-proven'){
      if(!a.verifiedPlacement||!a.all||
        a.postHoldAuthorityProof?.placementSrsProven!==true||
        a.postHoldAuthorityProof?.authorityFutureExposed!==false)
        throw Error('Unproven authority Hold+landing');
      hold++;
    }else if(a.status==='public-precondition-changed'){
      if(a.all||a.verifiedPlacement)throw Error('Not truly invalid forecast');
      changed++;
      for(const [k,v]of Object.entries(a.matched))
        if(v===false)mismatchDimensions[k]++;
    }else if(a.status==='placement-no-srs-proof')invalidProof++;
    else other++;
  }
  if(direct+hold+changed+invalidProof+other!==f.actualNextLockChecks)
    throw Error('Not all public correlated observations accounted for');
  return {originalIndependentSeed:seed,
    actualSynchronizedLocks:x.lockSteps,scoredFalse:true,
    correlatedObservationCount:f.actualNextLockChecks,
    fullLegalNextMoveWitnesses:direct+hold,
    directSrsProven:direct,holdPlusSrsProven:hold,
    publicPreconditionChanges:changed,
    failedSrsAtMatchedPublicState:invalidProof,
    otherUnproven:other,mismatchDimensions};
});
const totals=Object.fromEntries([
  'correlatedObservationCount','fullLegalNextMoveWitnesses',
  'directSrsProven','holdPlusSrsProven',
  'publicPreconditionChanges','failedSrsAtMatchedPublicState',
  'otherUnproven'].map(k=>[k,rows.reduce((n,r)=>n+r[k],0)]));
const mismatchTotals=Object.fromEntries(
  ['board','current','hold','pending','btb','combo'].map(k=>[k,
    rows.reduce((n,r)=>n+r.mismatchDimensions[k],0)]));
const out={format:'rook-real-kiwi-next-lock-public-plan-seed-audit/1',
  independentOriginalGameSeeds:rows.length,
  originalSeeds:rows,
  descriptiveTotalsAcrossCorrelatedLocks:totals,
  mismatchTotalsAcrossCorrelatedLocks:mismatchTotals,
  independentFullKOWinEvidence:0,
  noPolicyPromotion:true,
  conclusion:'This audits LEGALITY of ROOK forecast second LOCK under actual public opponent conditions, not strategy quality or true KO; no independent information unit per lock.'};
writeFileSync('real-public-next-plan-audit.json',
  JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
