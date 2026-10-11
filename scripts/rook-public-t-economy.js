// Observable T-resource lifecycle from an already-scored historical match.
// Hold occupancy is a sequence of correlated PUBLIC snapshots, never a count
// of independent Hold decisions or a recommendation to force all T to spin.
import {readFileSync,writeFileSync} from 'node:fs';
const rows=readFileSync(process.env.ROOK_PUBLIC_LOCK_TRACE??
  'rook-all-public-locks.jsonl','utf8').trim().split('\n')
  .filter(Boolean).map(JSON.parse);
if(!rows.length)throw Error('No published player-visible lock trace');
const groups=['rook','kiwi'].map(kind=>{
  const arr=rows.filter(x=>x.kind===kind).sort((a,b)=>a.turn-b.turn);
  if(!arr.length||arr.some((x,i)=>
    x.visible?.next?.length!==5||
    'bag' in x.visible||'rng' in x.visible||'holes' in x.visible||
    (i>0&&x.turn!==arr[i-1].turn+1)))
    throw Error('Non-contiguous or private source data');
  let holdTEpisodes=0,previousHoldT=false;
  for(const x of arr){
    const heldT=x.visible.hold?.piece==='t';
    if(heldT&&!previousHoldT)holdTEpisodes++;
    previousHoldT=heldT;
  }
  const t=arr.filter(x=>x.outcome.piece==='t');
  const fullTsd=t.filter(x=>x.outcome.spin==='full'&&
    x.outcome.lines===2);
  const noSpinNoClear=t.filter(x=>x.outcome.spin==='none'&&
    x.outcome.lines===0);
  const otherT=t.filter(x=>!fullTsd.includes(x)&&
    !noSpinNoClear.includes(x));
  const last=arr.at(-1)?.visible.hold?.piece==='t';
  return {kind,publicLocks:arr.length,
    currentTViews:arr.filter(x=>x.visible.current.type==='t').length,
    holdTViewCount:arr.filter(x=>x.visible.hold?.piece==='t').length,
    holdTEpisodes,holdTAtFinalObservedLock:!!last,
    actualTPlacements:t.length,fullTsd:fullTsd.length,
    tNoSpinNoClear:noSpinNoClear.length,otherT:otherT.length,
    tSpinTypeBreakdown:Object.fromEntries([...new Set(t.map(x=>
      x.outcome.spin+':'+x.outcome.lines))].map(key=>[key,t.filter(x=>
      x.outcome.spin+':'+x.outcome.lines===key).length]))};
});
const report={format:'rook-public-T-resource-lifecycle/1',
  independentSeeds:new Set(rows.map(x=>x.seed)).size,
  groups,
  warning:'One deterministic same-seed match; Hold T views are correlated observations and episodes not direct Hold actions. A no-clear T placement is not automatically strategically wrong. No bot strategy or hidden input was used.'};
if(process.env.ROOK_T_ECONOMY_OUTPUT)
  writeFileSync(process.env.ROOK_T_ECONOMY_OUTPUT,
    JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
