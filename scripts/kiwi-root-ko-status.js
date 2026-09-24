import {KO_BATCHES} from './kiwi-root-ko.js';
export function experimentStatus(results,status,mode='pilot'){
  if(!['pilot','replication'].includes(mode))throw new Error('Unknown experiment mode');
  const batches=mode==='pilot'?['pilot']:['validation-1','validation-2'];
  const cases=['g1-f48','g1-f120','g1-f192'];
  const valid=results.length===cases.length*batches.length&&cases.every(id=>batches.every(batch=>{
    const rows=results.filter(r=>r.id===id&&(r.batch??'pilot')===batch);
    if(rows.length!==1)return false;
    const r=rows[0],seeds=KO_BATCHES[batch];
    return r.complete&&r.seatParity&&r.technicalFailures===0&&r.silentFallback===0&&r.parity?.mismatches===0&&
      r.independentScenarios===seeds.length&&r.pairs?.length===seeds.length&&
      r.pairs.every((p,i)=>p.seed===seeds[i])&&
      r.AOnlyWins===r.pairs.filter(p=>p.comparison==='A-only-win').length&&
      r.BOnlyWins===r.pairs.filter(p=>p.comparison==='B-only-win').length;
  }));
  return {ok:status==='success'&&valid,lines:results.map(r=>r.complete?
    `${r.id} / ${r.batch??'pilot'}: A-only ${r.AOnlyWins}; B-only ${r.BOnlyWins}; ${r.independentScenarios} futures; seat parity ${r.seatParity}.`:
    `${r.id} / ${r.batch??'pilot'}: incomplete; inspect artifacts.`)};
}
