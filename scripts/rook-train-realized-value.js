// Offline observed-trajectory baseline. NEVER use the holdout seeds for
// fitting/hyperparameter selection, and NEVER pass authority future labels
// to chooseMove. This script does NOT modify the live ROOK evaluator.
import {readFileSync,writeFileSync} from 'node:fs';
import {FEATURE_NAMES,buildRealizedWindows} from
  '../src/analysis/rook-realized-value-data.js';

const inputs=(process.env.DATA_FILES??'').split(',').filter(Boolean);
const trainSeeds=(process.env.TRAIN_SEEDS??'67610,67611')
  .split(',').map(Number);
const testSeeds=(process.env.TEST_SEEDS??'67612,67613')
  .split(',').map(Number);
if(inputs.length!==4||trainSeeds.length!==2||testSeeds.length!==2||
  [...trainSeeds,...testSeeds].some(x=>!Number.isSafeInteger(x))||
  new Set([...trainSeeds,...testSeeds]).size!==4)
  throw Error('Expected 4 disjoint, predeclared independent game seeds');
const traces=[],caps=new Map(),seenGames=new Set();
for(const input of inputs){
  const root=input.replace(/\/$/,'');
  const match=readFileSync(root+'/match.jsonl','utf8').trim()
    .split('\n').filter(Boolean).map(JSON.parse);
  if(match.length!==1||match[0].cap!==2000||!match[0].sameSeed||
    !match[0].simultaneousLocks||match[0].error||
    !['KO','capped','double-KO'].includes(match[0].termination)||
    match[0].order!==0)
    throw Error('Invalid original, non-mirrored true-KO authority match');
  const m=match[0];
  if(seenGames.has(m.seed))throw Error('Repeated game seed');
  seenGames.add(m.seed);caps.set(m.seed,m.termination);
  const rows=readFileSync(root+'/public-locks.jsonl','utf8').trim()
    .split('\n').filter(Boolean).map(JSON.parse);
  if(rows.length!==m.lockSteps*2||
    rows.some(r=>r.seed!==m.seed||r.turn>=m.lockSteps||
      r.kind!==m.kinds[r.slot]))
    throw Error('Trace must contain both true authority policies, every lock');
  traces.push(...rows);
}
if([...trainSeeds,...testSeeds].some(x=>!seenGames.has(x)))
  throw Error('Missing a predeclared independent seed');
const ds=buildRealizedWindows(traces,{horizon:8,matchCaps:caps});
const train=ds.windows.filter(x=>trainSeeds.includes(x.seed));
const test=ds.windows.filter(x=>testSeeds.includes(x.seed));
if(train.length<25||test.length<25)
  throw Error('Insufficient complete authentic 8-lock labels; no model fitted');
const n=FEATURE_NAMES.length;
const means=FEATURE_NAMES.map(k=>train.reduce((s,r)=>s+r.features[k],0)/train.length);
const stdev=FEATURE_NAMES.map((k,i)=>{
  const variance=train.reduce((s,r)=>
    s+(r.features[k]-means[i])**2,0)/train.length;
  return Math.max(1e-6,Math.sqrt(variance));
});
const x=r=>[1,...FEATURE_NAMES.map((k,i)=>
  (r.features[k]-means[i])/stdev[i])];
// Deterministic Gaussian elimination, fixed regularization chosen BEFORE
// validation. Intercept is not penalized; no external ML dependencies.
function solve(A,b){
  const m=A.length;
  const aug=A.map((row,i)=>[...row,b[i]]);
  for(let col=0;col<m;col++){
    let pivot=col;
    for(let r=col+1;r<m;r++)if(Math.abs(aug[r][col])>
      Math.abs(aug[pivot][col]))pivot=r;
    if(Math.abs(aug[pivot][col])<1e-12)throw Error('Singular ridge model');
    [aug[col],aug[pivot]]=[aug[pivot],aug[col]];
    const d=aug[col][col];
    for(let j=col;j<=m;j++)aug[col][j]/=d;
    for(let r=0;r<m;r++){
      if(r===col)continue;
      const z=aug[r][col];
      for(let j=col;j<=m;j++)aug[r][j]-=z*aug[col][j];
    }
  }
  return aug.map(r=>r[m]);
}
function fit(label){
  const p=n+1,A=Array.from({length:p},()=>Array(p).fill(0));
  const b=Array(p).fill(0);
  for(const row of train){
    const v=x(row),y=row.targets[label];
    for(let i=0;i<p;i++){
      b[i]+=v[i]*y;
      for(let j=0;j<p;j++)A[i][j]+=v[i]*v[j];
    }
  }
  const lambda=10;
  for(let i=1;i<p;i++)A[i][i]+=lambda;
  return solve(A,b);
}
const targets=['sent','tanked'];
const models=Object.fromEntries(targets.map(k=>[k,fit(k)]));
function diagnostics(rows,label){
  const mean=train.reduce((n,r)=>n+r.targets[label],0)/train.length;
  let modelAE=0,baselineAE=0,modelSE=0,baselineSE=0;
  for(const row of rows){
    const predicted=x(row).reduce((s,v,i)=>s+v*models[label][i],0);
    const actual=row.targets[label];
    modelAE+=Math.abs(predicted-actual);
    baselineAE+=Math.abs(mean-actual);
    modelSE+=(predicted-actual)**2;
    baselineSE+=(mean-actual)**2;
  }
  return {count:rows.length,modelMae:modelAE/rows.length,
    constantTrainMeanMae:baselineAE/rows.length,
    modelMse:modelSE/rows.length,
    constantTrainMeanMse:baselineSE/rows.length,
    improvesMse:modelSE<baselineSE};
}
const validate=Object.fromEntries(targets.map(k=>[k,diagnostics(test,k)]));
const bySeed=Object.fromEntries(testSeeds.map(seed=>[seed,
  Object.fromEntries(targets.map(k=>[k,
    diagnostics(test.filter(r=>r.seed===seed),k)]))]));
const output={format:'rook-realized-value-ridge-experiment/1',
  status:'OFFLINE_PROTOTYPE_NO_LIVE_POLICY',horizon:8,
  featureNames:FEATURE_NAMES,means,stdev,lambda:10,
  heads:models,trainSeeds,testSeeds,
  trainingExamples:train.length,testExamples:test.length,
  allIndependentSeeds:ds.independentSeeds,
  rawLocks:ds.rawLocks,censored:ds.censored.length,
  validation:validate,byTestSeed:bySeed,
  fundamentalLimitation:'Labels are actual future sent/tanked under ROOK or Kiwi behavior. They are correlated windows, confounded by policy and opponent, and not counterfactual action returns. Better held-out prediction alone DOES NOT establish improved KO or valid policy value.',
  noHiddenInputs:true,noOutcomeLabelsAtDecisionTime:true};
writeFileSync(process.env.MODEL_OUT??'rook-realized-value-ridge.json',
  JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({format:output.format,status:output.status,
  trainingExamples:output.trainingExamples,testExamples:output.testExamples,
  censored:output.censored,trainSeeds,testSeeds,validation:validate,byTestSeed:bySeed,
  limitation:output.fundamentalLimitation}));
