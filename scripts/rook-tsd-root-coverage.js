// Differential diagnosis: does the standard ROOK final beam SEE a full TSD
// from the SAME Kiwi-made public board 1..3 turns before an actual TSD?
// No Kiwi private engine state, no policy changes, and no KO inference.
import {readFileSync,writeFileSync} from 'node:fs';
import {chooseMove} from '../src/analysis/rook.js';
import {tsdScaffoldPotential} from '../src/analysis/rook-tsd.js';
const traces=readFileSync(process.env.ROOK_TSD_POSITIVES??
  'rook-public-tsd-traces.jsonl','utf8').trim().split('\n')
  .filter(Boolean).map(JSON.parse);
const original=new Map();
for(const event of traces.filter(e=>e.kind==='kiwi')){
  if(event.outcome?.spin!=='full'||event.outcome.lines!==2)
    throw Error('Not an authority-confirmed Kiwi full TSD event');
  for(const item of event.history){
    const lag=event.turn-item.turn;
    if(lag<1||lag>3)continue;
    const key=event.seed+':'+event.kind+':'+item.turn;
    if(!original.has(key))original.set(key,{seed:event.seed,owner:event.kind,
      turn:item.turn,visible:item.visible,lags:[]});
    original.get(key).lags.push(lag);
  }
}
const rows=[];
for(const {seed,owner,turn,visible,lags} of original.values()){
  if(visible?.next?.length!==5||'bag' in visible||'rng' in visible||
    'holes' in visible||'checkpoint' in visible||'opponent' in visible)
    throw Error('Only contemporaneous player-visible snapshots allowed');
  const frozen=JSON.stringify(visible);
  const start=performance.now();
  const analysis=chooseMove(visible,{depth:4,beamWidth:24,maxNodes:6000,
    maxStates:1200,maxSteps:42,traceRootScores:true});
  const elapsed=performance.now()-start;
  if(JSON.stringify(visible)!==frozen)throw Error('Search mutated public state');
  const finalists=analysis.rootScores??[];
  const all=finalists.map(r=>{
    const index=r.leaf.forecastLocks.findIndex(p=>
      p.piece==='t'&&p.spin==='full'&&p.lines===2);
    if(index<0)return null;
    const lock=r.leaf.forecastLocks[index];
    return {ply:index+1,proof:lock.proof,
      precedingUnproved:r.leaf.forecastLocks.slice(0,index)
        .filter(p=>p.proof!=='srs').length};
  }).filter(Boolean);
  rows.push({seed,owner,turn,lags,scaffold:
    tsdScaffoldPotential(visible.board,visible.rules),
    finalRootCount:finalists.length,
    anyFinalistFullTsd:all.length>0,
    selectedFinalistFullTsd:!!all[0]&&
      finalists[0].leaf.forecastLocks.some(p=>
        p.piece==='t'&&p.spin==='full'&&p.lines===2),
    hasSrsWitnessForTsd:all.some(x=>x.proof==='srs'),
    bestPredictedTsd:all[0]??null,
    ms:Number(elapsed.toFixed(1))});
}
const group=lag=>{
  const v=rows.filter(r=>r.lags.includes(lag));
  return {lag,samples:v.length,scaffoldPositive:v.filter(r=>r.scaffold>0).length,
    anyFinalistFullTsd:v.filter(r=>r.anyFinalistFullTsd).length,
    selectedFinalistFullTsd:v.filter(r=>r.selectedFinalistFullTsd).length,
    withSrsTsdWitness:v.filter(r=>r.hasSrsWitnessForTsd).length};
};
const report={format:'rook-kiwi-public-tsd-root-coverage/1',
  positions:rows.length,sourceEvents:traces.filter(x=>x.kind==='kiwi').length,
  independentSeeds:new Set(rows.map(r=>r.seed)).size,
  byLead:[1,2,3].map(group),
  seenByAnyRoot:rows.filter(r=>r.anyFinalistFullTsd).length,
  seenInBestRoot:rows.filter(r=>r.selectedFinalistFullTsd).length,
  bestRootIncludesUnverifiedPriorPly:rows.filter(r=>
    r.bestPredictedTsd?.precedingUnproved>0).length,
  rows,
  caveat:'Retrospectively sampled only REAL Kiwi TSD successes from one seed. SRS witness of a hypothetical TSD does not prove earlier geometric placements are executable. Surviving root finalists are not all searched paths; these rates are not general accuracy, APP, or KO strength.'};
if(process.env.ROOK_TSD_ROOT_OUTPUT)
  writeFileSync(process.env.ROOK_TSD_ROOT_OUTPUT,
    JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined}));
