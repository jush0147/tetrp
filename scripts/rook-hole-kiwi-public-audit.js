// Historical discovery diagnostic (NOT training, live opponent access,
// independent observations, CPU-matched benchmark, or new KO outcome).
// The fixed half-hole penalty is registered separately BEFORE this script
// observes its agreement with archived Kiwi choices.
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {chooseMove} from '../src/analysis/rook.js';
import {actionSignature} from '../src/analysis/rook-disagreement.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';

const states=readFileSync('rook-public-observations.jsonl','utf8')
  .trim().split('\n').map(JSON.parse);
const ref=readFileSync('rook-choice-diff.jsonl','utf8')
  .trim().split('\n').map(JSON.parse);
if(states.length!==22||ref.length!==states.length||
  new Set(states.map(r=>r.seed)).size!==2)
  throw Error('Expected original 22 public Kiwi-vs-ROOK observations');
const base={depth:4,beamWidth:24,maxNodes:6000,maxStates:1200,
  maxSteps:42};
const rows=[];
for(let i=0;i<states.length;i++){
  const r=states[i],history=ref[i],v=r.visible;
  if(r.seed!==history.seed||r.turn!==history.turn||
    r.owner!==history.owner||v.next?.length!==5||
    'bag' in v||'rng' in v||'checkpoint' in v||'holes' in v)
    throw Error('Non-public or mismatched historical source');
  const original=JSON.stringify(v),choices=[];
  for(const scale of [1,.5]){
    const t0=performance.now();
    const choice=chooseMove(v,{...base,holePenaltyScale:scale});
    if(choice.kind==='place'&&!validatePlacement(v,{
      action:{kind:'place'},move:choice.move,execution:choice.execution}))
      throw Error('Selected root has no legal SRS+ authority action');
    choices.push({scale,key:actionSignature(choice),
      score:choice.diagnostics.value,
      ms:Math.round((performance.now()-t0)*10)/10,
      evaluations:choice.diagnostics.evaluated});
  }
  if(choices[0].key!==history.rook.key)
    throw Error('Unmodified default ROOK no longer matches archived baseline');
  if(JSON.stringify(v)!==original)throw Error('Mutated public snapshot');
  rows.push({seed:r.seed,turn:r.turn,owner:r.owner,
    kiwiAction:history.kiwi.key,
    beforeMatchesKiwi:choices[0].key===history.kiwi.key,
    reducedMatchesKiwi:choices[1].key===history.kiwi.key,
    changed:choices[0].key!==choices[1].key,choices});
}
const report={format:'rook-hole-penalty-public-kiwi-discovery/1',
  independentHistoricalMatchSeeds:2,
  correlatedSnapshots:rows.length,
  holeScale:0.5,
  beforeMatchesKiwi:rows.filter(r=>r.beforeMatchesKiwi).length,
  afterMatchesKiwi:rows.filter(r=>r.reducedMatchesKiwi).length,
  changedRoots:rows.filter(r=>r.changed).length,
  changesThatMatchKiwi:rows.filter(r=>r.changed&&r.reducedMatchesKiwi).length,
  totalBaselineMs:rows.reduce((s,r)=>s+r.choices[0].ms,0),
  totalTrialMs:rows.reduce((s,r)=>s+r.choices[1].ms,0),
  note:'This historical Kiwi-labeled cohort was examined when formulating the hypothesis. Agreement != strength; correlated positions != independent games; not held-out or equal CPU.',
  rows};
console.log(JSON.stringify(report));
