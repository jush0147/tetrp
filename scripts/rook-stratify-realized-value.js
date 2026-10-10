// SECOND-LEVEL AUDIT of the already-fitted, FROZEN ridge model.
// Does not refit, pick hyperparameters or edit the live ROOK policy.
// All subgroups and baselines must use entirely disjoint original match seeds.
import {readFileSync,writeFileSync} from 'node:fs';
import {FEATURE_NAMES,buildRealizedWindows} from
  '../src/analysis/rook-realized-value-data.js';

const model=JSON.parse(readFileSync(process.env.MODEL_PATH??
  'rook-realized-value-ridge.json','utf8'));
if(model.format!=='rook-realized-value-ridge-experiment/1'||
  model.status!=='OFFLINE_PROTOTYPE_NO_LIVE_POLICY'||model.horizon!==8||
  JSON.stringify(model.featureNames)!==JSON.stringify(FEATURE_NAMES)||
  model.trainSeeds.join(',')!=='67610,67611'||
  model.testSeeds.join(',')!=='67612,67613')
  throw Error('Only the original frozen, seed-held-out model is acceptable');

const traces=[],caps=new Map();
for(const seed of [...model.trainSeeds,...model.testSeeds]){
  const dir=(process.env.TRACE_PREFIX??'rook-value-traces-')+seed;
  const match=readFileSync(dir+'/match.jsonl','utf8').trim()
    .split('\n').map(JSON.parse);
  if(match.length!==1||match[0].seed!==seed||match[0].error||
    match[0].cap!==2000||match[0].order!==0||
    !match[0].sameSeed||!match[0].simultaneousLocks)
    throw Error('Missing original full-match seed '+seed);
  caps.set(seed,match[0].termination);
  const rows=readFileSync(dir+'/public-locks.jsonl','utf8')
    .trim().split('\n').map(JSON.parse);
  if(rows.length!==match[0].lockSteps*2||
    rows.some(r=>r.seed!==seed||r.visible?.next?.length!==5||
      !r.authorityBeforeTotals||!r.outcome?.combatTotals))
    throw Error('Original authority trace count mismatch '+seed);
  traces.push(...rows);
}
const ds=buildRealizedWindows(traces,{horizon:8,matchCaps:caps});
const train=ds.windows.filter(r=>model.trainSeeds.includes(r.seed));
const holdout=ds.windows.filter(r=>model.testSeeds.includes(r.seed));
if(train.length!==model.trainingExamples||
  holdout.length!==model.testExamples||
  model.allIndependentSeeds!==4)
  throw Error('Original frozen train-test partition changed');

const rawPredict=(r,label)=>{
  const coef=model.heads[label];
  if(coef?.length!==FEATURE_NAMES.length+1)throw Error('Bad coefficient count');
  let p=coef[0];
  FEATURE_NAMES.forEach((name,i)=>{
    p+=(r.features[name]-model.means[i])/model.stdev[i]*coef[i+1];
  });
  return p;
};
const mean=(rows,label)=>rows.reduce((a,r)=>a+r.targets[label],0)/rows.length;
const globalMeans=Object.fromEntries(['sent','tanked'].map(k=>[k,mean(train,k)]));
const kindMeans=Object.fromEntries(['rook','kiwi'].map(k=>{
  const subset=train.filter(r=>r.kind===k);
  if(subset.length===0)throw Error('Empty training policy group');
  return [k,Object.fromEntries(['sent','tanked'].map(label=>
    [label,mean(subset,label)]))];
}));

const score=(rows,label)=>{
  if(!rows.length)return null;
  const e={count:rows.length,modelMae:0,globalConstantMae:0,
    policyConstantMae:0,modelMse:0,globalConstantMse:0,
    policyConstantMse:0,
    meanRealized:mean(rows,label)};
  for(const r of rows){
    const y=r.targets[label],p=rawPredict(r,label);
    const m=globalMeans[label],c=kindMeans[r.kind][label];
    if(!Number.isFinite(p))throw Error('Nonfinite prediction');
    e.modelMae+=Math.abs(p-y);e.globalConstantMae+=Math.abs(m-y);
    e.policyConstantMae+=Math.abs(c-y);
    e.modelMse+=(p-y)**2;e.globalConstantMse+=(m-y)**2;
    e.policyConstantMse+=(c-y)**2;
  }
  for(const key of Object.keys(e))if(key!=='count'&&key!=='meanRealized')
    e[key]/=rows.length;
  return e;
};
const scored=rows=>({
  count:rows.length,
  sent:score(rows,'sent'),
  tanked:score(rows,'tanked')
});
const byKind=Object.fromEntries(['rook','kiwi'].map(kind=>
  [kind,scored(holdout.filter(r=>r.kind===kind))]));
const bySeedKind=Object.fromEntries(model.testSeeds.map(seed=>[
  seed,Object.fromEntries(['rook','kiwi'].map(kind=>[
    kind,scored(holdout.filter(r=>r.seed===seed&&r.kind===kind))
  ]))
]));
const pressure={
  incoming:scored(holdout.filter(r=>r.features.publicPending>0)),
  noIncoming:scored(holdout.filter(r=>r.features.publicPending===0)),
  highStack:scored(holdout.filter(r=>r.features.heightMax>=10)),
  lowerStack:scored(holdout.filter(r=>r.features.heightMax<10))
};
// Overlapping windows are not independent. A deterministic disjoint subset
// contains at most one consecutive 8-lock future window per trajectory,
// providing a sensitivity audit, NOT new independent match seeds.
const nonOverlapping=holdout.filter(r=>r.turn%model.horizon===0);
const result={
  format:'rook-heldout-stratified-prediction-audit/1',
  modelStatus:'FROZEN_OFFLINE_NO_LIVE_POLICY',
  independentMatchSeeds:4,trainSeeds:model.trainSeeds,
  holdoutSeeds:model.testSeeds,trainingWindows:train.length,
  holdoutWindows:holdout.length,
  all:scored(holdout),byKind,bySeedKind,pressure,
  nonOverlapping:scored(nonOverlapping),
  trainGlobalMeans:globalMeans,trainPolicyMeans:kindMeans,
  meaningfulStrengthClaim:false,
  caveat:'Held-out windows overlap; effective independent unit is the original whole-game seed. Policy-specific constants are trained on train seeds only. Observational future attack from the chosen policy is NOT a causal value estimate of alternative actions; no policy promotion or KO inference.'};
for(const label of ['sent','tanked']){
  const original=model.validation[label];
  if(Math.abs(result.all[label].modelMse-original.modelMse)>1e-8||
    Math.abs(result.all[label].modelMae-original.modelMae)>1e-8||
    Math.abs(result.all[label].globalConstantMse-
      original.constantTrainMeanMse)>1e-8)
    throw Error('New stratification disagrees with frozen model validation');
}
writeFileSync(process.env.STRATIFIED_OUT??'rook-value-stratified.json',
  JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({format:result.format,
  byKind,bySeedKind,pressure,
  nonOverlapping:result.nonOverlapping,caveat:result.caveat}));
