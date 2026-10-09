// Re-evaluate original real Kiwi-vs-ROOK public positions without running
// Kiwi again or fetching authority-private state. This is a DIAGNOSTIC,
 // not a claim of better KO or CPU-equivalent strength.
import {readFileSync,writeFileSync} from 'node:fs';
import {chooseMove} from '../src/analysis/rook.js';
import {actionSignature} from '../src/analysis/rook-disagreement.js';

const records=readFileSync(process.env.ROOK_PUBLIC_SNAPSHOTS??'rook-public-observations.jsonl','utf8')
  .trim().split('\n').map(JSON.parse);
const previous=readFileSync(process.env.ROOK_PREVIOUS_DIFF??'rook-choice-diff.jsonl','utf8')
  .trim().split('\n').map(JSON.parse);
if(records.length!==previous.length||records.length<8)
  throw Error('Public observations are not paired with original Kiwi analysis');
const options={depth:4,beamWidth:24,maxNodes:6000,maxStates:1200,maxSteps:42};
const configs=[
  {id:'baseline-4x24',settings:{}},
  {id:'deep-5x48',settings:{depth:5,beamWidth:48,maxNodes:24000}},
  {id:'relieved-5x48',settings:{depth:5,beamWidth:48,maxNodes:24000,
    intermediateHoleRelief:.65}},
];
function boardFeatures(board){
  let holes=0,height=0,garbage=0;
  for(let x=0;x<board.width;x++){
    let filled=false;
    for(let y=0;y<board.rows.length;y++){
      const cell=board.rows[y][x];
      if(cell!==null){
        if(!filled)height=Math.max(height,board.rows.length-y);
        filled=true;
        if(cell==='gb'||cell==='gbd')garbage++;
      }else if(filled)holes++;
    }
  }
  return {height,holes,garbage};
}
const rows=[];
for(let i=0;i<records.length;i++){
  const record=records[i],ref=previous[i],v=record.visible;
  if(record.seed!==ref.seed||record.turn!==ref.turn||record.owner!==ref.owner||
    !v||v.next?.length!==5||'bag' in v||'holes' in v||
    'checkpoint' in v||'rng' in v)
    throw Error('Snapshot identity or NEXT5 privacy invariant violated');
  const frozen=JSON.stringify(v);
  const opts=[];
  for(const variant of configs){
    const start=performance.now();
    const out=chooseMove(v,{...options,...variant.settings});
    const elapsed=performance.now()-start;
    const key=actionSignature(out);
    if(JSON.stringify(v)!==frozen)throw Error('Public snapshot was mutated');
    if(out.diagnostics.evaluated>(variant.settings.maxNodes??6000))
      throw Error('Search exceeded configured evaluations');
    opts.push({variant:variant.id,key,ms:Math.round(elapsed),
      evaluated:out.diagnostics.evaluated,score:out.diagnostics.value,
      // The first visible NEXT5 placements are modeled by a combination
      // of genuine SRS+ witnesses and cheap Hard Drop forecasts. Count
      // coverage directly instead of assuming deeper beam has more Spins.
      futureProofsByPly:out.diagnostics.futureReachableByPly,
      actualFutureSpinClears:out.diagnostics.futureSpinClears,
      fastSpinProbes:out.diagnostics.spinProbes,
      forecastSpinClears:out.diagnostics.forecastedSpinClears,
      futureMoves:out.diagnostics.futureMoves,
      unresolvedGarbageBranches:out.diagnostics.unresolvedTankNodes,
      matchesKiwi:key===ref.kiwi.key});
  }
  if(opts[0].key!==ref.rook.key)
    throw Error('Pinned 6K baseline no longer matches archived baseline; comparison invalid');
  const publicPending=[...(v.attack?.pending??[]),...(v.attack?.are??[])]
    .reduce((n,p)=>n+(p.amt??0),0);
  rows.push({seed:record.seed,turn:record.turn,owner:record.owner,
    pending:publicPending,...boardFeatures(v.board),
    kiwiKey:ref.kiwi.key,options:opts});
}
const kinds=['all','pending','garbage','holes','late'];
const categories={all:()=>true,pending:r=>r.pending>0,garbage:r=>r.garbage>0,
  holes:r=>r.holes>0,late:r=>r.turn>=20};
const statistics=Object.fromEntries(kinds.map(name=>{
  const subset=rows.filter(categories[name]);
  return [name,{positions:subset.length,
    baselineMatchesKiwi:subset.filter(r=>r.options[0].matchesKiwi).length,
    deepMatchesKiwi:subset.filter(r=>r.options[1].matchesKiwi).length,
    relievedMatchesKiwi:subset.filter(r=>r.options[2].matchesKiwi).length,
    deepChanges:subset.filter(r=>r.options[1].key!==r.options[0].key).length,
    reliefChangesVsDeep:subset.filter(r=>r.options[2].key!==r.options[1].key).length,
    meanHoles:subset.length?subset.reduce((n,r)=>n+r.holes,0)/subset.length:null,
    meanPending:subset.length?subset.reduce((n,r)=>n+r.pending,0)/subset.length:null,
    byVariant:configs.map((variant,i)=>({
      variant:variant.id,
      meanFutureProofsByPly:subset.length
        ?[0,1,2,3,4,5].map(p=>subset.reduce((n,r)=>
          n+(r.options[i].futureProofsByPly[p]??0),0)/subset.length):[],
      meanActualFutureSpinClears:subset.length?subset.reduce((n,r)=>
        n+r.options[i].actualFutureSpinClears,0)/subset.length:null,
      meanFastSpinProbes:subset.length?subset.reduce((n,r)=>
        n+r.options[i].fastSpinProbes,0)/subset.length:null,
      meanForecastSpinClears:subset.length?subset.reduce((n,r)=>
        n+r.options[i].forecastSpinClears,0)/subset.length:null,
      meanUnresolvedGarbageBranches:subset.length?subset.reduce((n,r)=>
        n+r.options[i].unresolvedGarbageBranches,0)/subset.length:null
    }))}];
}));
const result={format:'rook-real-kiwi-public-stress-triage/1',
  source:'same public Tetrp snapshots in pinned Kiwi-vs-ROOK full KO',
  matchSeeds:[...new Set(rows.map(r=>r.seed))],
  configurations:configs.map(c=>({id:c.id,...c.settings})),
  statistics,rows,
  warning:'Agreement with Kiwi is not a strength benchmark; search time / KO still required'};
if(process.env.ROOK_STRESS_OUTPUT)
  writeFileSync(process.env.ROOK_STRESS_OUTPUT,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,rows:undefined}));
