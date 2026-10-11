// Historical NATURAL public pressure positions from genuine ROOK-vs-Kiwi
// KO. They are NOT new independent games and may be correlated; no KO
// result is produced. The authority-private bag, RNG, hidden hole columns,
// and opponent next move are not accessible to the policy.
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {chooseMove} from '../src/analysis/rook.js';
import {actionSignature} from '../src/analysis/rook-disagreement.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
const records=readFileSync(process.env.ROOK_PUBLIC_SNAPSHOTS??
  'rook-public-observations.jsonl','utf8').trim().split('\n').map(JSON.parse);
if(records.length!==22||new Set(records.map(x=>x.seed)).size!==2)
  throw Error('Missing the exact 22 archival natural-match public states');
const pendingOf=v=>[...(v.attack?.pending??[]),
  ...(v.attack?.are??[])].reduce((n,p)=>n+(p.amt??0),0);
const selected=records.filter(x=>pendingOf(x.visible)>0);
if(selected.length!==3)throw Error('Expected three genuine public garbage positions');
const cfg={depth:4,beamWidth:24,maxNodes:6000,maxStates:1200,maxSteps:42,
  garbageBelief:true,beliefProbes:3,beliefMaxOutcomes:10,
  beliefRiskWeight:0.2,beliefReachableStates:300};
const snapshots=[];
for(const row of selected){
  const v=row.visible,original=JSON.stringify(v);
  if(v.next?.length!==5||'rng' in v||'bag' in v||
    'checkpoint' in v||'opponent' in v)
    throw Error('Invalid historical player-visible next five');
  const reports=[];
  for(const [variant,settings] of [
    ['legacy',{beliefCommonHorizon:false}],
    ['common',{beliefCommonHorizon:true,
      beliefHorizonNodes:900,beliefHorizonBeam:2}]
  ]){
    const t0=performance.now();
    const a=chooseMove(v,{...cfg,...settings,traceRootScores:true});
    const ms=performance.now()-t0;
    if(a.kind==='place'&&!validatePlacement(v,{action:{kind:'place'},
      move:a.move,execution:a.execution}))
      throw Error('Historical policy returned invalid SRS+ action');
    reports.push({variant,action:actionSignature(a),
      ms:+ms.toFixed(2),baseEvaluations:a.diagnostics.evaluated,
      beliefAttempts:a.diagnostics.beliefAttempts,
      beliefCompleted:a.diagnostics.beliefEvaluations,
      aborted:a.diagnostics.beliefHorizonAborted,
      conditionalNodes:a.diagnostics.beliefHorizonEvaluated,
      abortedReasons:a.diagnostics.beliefHorizonAbortReasons,
      exhaustedScenarioLimit:a.diagnostics.beliefOverBudget,
      selectedForecastTank:a.diagnostics.selectedForecastTank,
      selectedUnresolved:a.diagnostics.selectedUnresolvedGarbage,
      selectedLeafDepth:a.rootScores?.[0]?.leaf.ply??null,
      horizon:a.diagnostics.effectiveDepth});
  }
  if(JSON.stringify(v)!==original)
    throw Error('Mutated historical ROOK/Kiwi player-visible snapshot');
  snapshots.push({seed:row.seed,turn:row.turn,owner:row.owner,
    publiclyPending:pendingOf(v),changed:reports[0].action!==reports[1].action,
    reports});
}
const total=(key,n)=>snapshots.reduce((sum,row)=>sum+row.reports[n][key],0);
const output={format:'rook-real-kiwi-organic-public-belief/1',
  sourceRun:37949389406,naturalIndependentGameSeeds:2,
  inspectedCorrelatedPublicStates:snapshots.length,
  scored:false,knockouts:0,changes:snapshots.filter(x=>x.changed).length,
  legacyAttempts:total('beliefAttempts',0),
  commonAttempts:total('beliefAttempts',1),
  commonCompleted:total('beliefCompleted',1),
  commonAborted:total('aborted',1),
  commonConditionalNodes:total('conditionalNodes',1),
  commonExhausted:total('exhaustedScenarioLimit',1),
  note:'Real prior KO boards, but correlated selected pressure snapshots. Same-public-state decision diagnostic only, not independent KO evidence or matched CPU.',
  snapshots};
console.log(JSON.stringify(output));
