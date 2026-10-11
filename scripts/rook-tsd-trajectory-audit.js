// Study exact authority-verified TSD histories using public fields only.
// Scaffold potential is geometric, NOT proof of an executable future TSD.
import {readFileSync,writeFileSync} from 'node:fs';
import {tsdScaffolds,tsdScaffoldPotential} from '../src/analysis/rook-tsd.js';

const records=readFileSync(process.env.ROOK_TSD_TRACE_INPUT??'rook-public-tsd-traces.jsonl','utf8')
  .trim().split('\n').filter(Boolean).map(JSON.parse);
const offsetGroups=Array.from({length:6},()=>({count:0,positive:0,sum:0,
  fullGeometry:0}));
const events=[];
for(const r of records){
  if(!['kiwi','rook'].includes(r.kind)||r.outcome?.spin!=='full'||
    r.outcome.lines!==2||!Array.isArray(r.history)||!r.history.length||
    r.history.length>6)
    throw Error('Unexpected or unverified TSD history');
  const snapshots=[];
  for(const t of r.history){
    const v=t.visible;
    if(v.next?.length!==5||'bag' in v||'rng' in v||
      'holes' in v||'checkpoint' in v||!v.current||
      !v.board||!v.rules||'opponent' in v)
      throw Error('TSD history includes non-public fields');
    const lag=r.turn-t.turn;
    if(lag<0||lag>5)throw Error('Invalid TSD chronological history');
    const potential=tsdScaffoldPotential(v.board,v.rules);
    const geometries=tsdScaffolds(v.board,v.rules,{maxMissing:4});
    const full=geometries.some(x=>x.fullSpinGeometry);
    snapshots.push({turn:t.turn,lag,potential,fullSpinGeometry:full,
      heldT:v.hold?.piece==='t',currentT:v.current.type==='t',
      visibleT:[v.current.type,...v.next].includes('t'),
      pending:[...(v.attack?.pending??[]),...(v.attack?.are??[])]
        .reduce((n,p)=>n+(p.amt??0),0)});
    const group=offsetGroups[lag];
    group.count++;group.positive+=Number(potential>0);
    group.sum+=potential;group.fullGeometry+=Number(full);
  }
  events.push({seed:r.seed,turn:r.turn,kind:r.kind,
    btb:r.outcome.btb,snapshots});
}
const byKind={};
for(const kind of ['kiwi','rook']){
  const subset=events.filter(e=>e.kind===kind);
  byKind[kind]={tsdEvents:subset.length,
    lead2ScaffoldPositive:subset.filter(e=>e.snapshots.some(s=>
      s.lag===2&&s.potential>0)).length,
    lead3ScaffoldPositive:subset.filter(e=>e.snapshots.some(s=>
      s.lag===3&&s.potential>0)).length,
    medianBtb:subset.length?[...subset.map(e=>e.btb)].sort((a,b)=>a-b)[
      Math.floor(subset.length/2)]:null};
}
const report={format:'rook-public-tsd-trajectory-audit/1',
  records:events.length,byKind,
  signalByLag:offsetGroups.map((g,lag)=>({lag,
    samples:g.count,positive:g.positive,
    meanPotential:g.count?Number((g.sum/g.count).toFixed(3)):null,
    fullGeometry:g.fullGeometry})),
  events,
  warning:'These are public retrospective, overlapping trajectories from one deterministic match; scaffold potential is not a forward SRS+ proof or a strength result.'};
if(process.env.ROOK_TSD_REPORT)
  writeFileSync(process.env.ROOK_TSD_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,events:undefined}));
