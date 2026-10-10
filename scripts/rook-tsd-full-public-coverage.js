// Fair observational screen: the SAME unchanged ROOK search evaluates all
// real public pre-lock boards produced by Kiwi and ROOK in a pinned match.
// Forecasts are plans, not known future authority events or KO predictions.
import {readFileSync,writeFileSync} from 'node:fs';
import {chooseMove} from '../src/analysis/rook.js';
import {tsdScaffoldPotential,tsdScaffolds} from '../src/analysis/rook-tsd.js';
const data=readFileSync(process.env.ROOK_ALL_PUBLIC_TRACE??
  'rook-all-public-locks.jsonl','utf8').trim().split('\n')
  .filter(Boolean).map(JSON.parse);
const groups=new Map();
for(const x of data){
  if(!['kiwi','rook'].includes(x.kind)||x.visible?.next?.length!==5||
    'bag' in x.visible||'rng' in x.visible||'holes' in x.visible||
    typeof x.outcome?.fullTsd!=='boolean')throw Error('Not all public data');
  const key=x.kind+'/'+x.slot+'/'+x.seed;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(x);
}
const rows=[];
for(const [group,observations] of groups){
  observations.sort((a,b)=>a.turn-b.turn);
  for(let i=0;i<observations.length;i++){
    const x=observations[i],v=x.visible,before=JSON.stringify(v);
    const start=performance.now();
    const decision=chooseMove(v,{depth:4,beamWidth:24,
      maxNodes:6000,maxStates:1200,maxSteps:42,traceRootScores:true});
    const ms=performance.now()-start;
    if(JSON.stringify(v)!==before)throw Error('Public board mutated');
    const candidates=decision.rootScores??[];
    const forecastTsd=entry=>{
      const steps=entry?.leaf?.forecastLocks??[];
      const index=steps.findIndex(z=>z.piece==='t'&&
        z.spin==='full'&&z.lines===2);
      if(index<0)return null;
      return {ply:index+1,proof:steps[index].proof,
        unprovedBefore:steps.slice(0,index).filter(z=>z.proof!=='srs').length};
    };
    const best=candidates.length?forecastTsd(candidates[0]):null;
    const any=candidates.some(r=>forecastTsd(r));
    const remaining=observations.length-i-1;
    const actualFuture4=remaining>=4?
      observations.slice(i+1,i+5).some(r=>r.outcome.fullTsd):null;
    rows.push({kind:x.kind,turn:x.turn,seed:x.seed,
      potential:tsdScaffoldPotential(v.board,v.rules),
      fullGeometry:tsdScaffolds(v.board,v.rules,{maxMissing:0})
        .some(r=>r.fullSpinGeometry),
      currentT:v.current.type==='t',heldT:v.hold?.piece==='t',
      bestTsd:best,bestHasTsd:!!best,anyFinalistHasTsd:any,
      bestPriorPathCertified:!!best&&best.unprovedBefore===0&&
        best.proof==='srs',trueTsdThisLock:x.outcome.fullTsd,
      trueTsdNext4:actualFuture4,ms:Number(ms.toFixed(1))});
  }
}
const byKind=['rook','kiwi'].map(kind=>{
  const x=rows.filter(r=>r.kind===kind);
  const observed=x.filter(r=>r.trueTsdNext4!==null);
  return {kind,states:x.length,
    publicScaffoldPositive:x.filter(r=>r.potential>0).length,
    fullGeometry:x.filter(r=>r.fullGeometry).length,
    bestBeamContainsFullTsd:x.filter(r=>r.bestHasTsd).length,
    anyBeamRootContainsFullTsd:x.filter(r=>r.anyFinalistHasTsd).length,
    bestBeamFullyWitnessedTsd:x.filter(r=>r.bestPriorPathCertified).length,
    realizedFullTsdLocks:x.filter(r=>r.trueTsdThisLock).length,
    next4Comparable:observed.length,
    next4RealizedTsd:observed.filter(r=>r.trueTsdNext4).length,
    bestPredictedAndRealized:observed.filter(r=>
      r.bestHasTsd&&r.trueTsdNext4).length,
    meanSearchMs:Number((x.reduce((a,r)=>a+r.ms,0)/x.length).toFixed(1))};
});
const report={format:'rook-full-match-public-tsd-coverage/1',
  observations:rows.length,
  independentSeeds:new Set(rows.map(r=>r.seed)).size,
  byKind,rows,
  caveat:'One known retrospective reference seed with overlapping decisions; policy-produced board distributions differ. A predicted future TSD is not a realized future TSD, and the next four actual locks were produced by different ROOK/Kiwi policies. Does not award attacks or imply KO strength.'};
if(process.env.ROOK_FULL_TSD_COVERAGE_OUTPUT)
  writeFileSync(process.env.ROOK_FULL_TSD_COVERAGE_OUTPUT,
    JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined}));
