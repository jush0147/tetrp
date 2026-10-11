// Discriminative, non-hindsight test: how often do geometric TSD cues
// precede a REAL authority Full TSD, versus occurring without one?
// All features come exclusively from contemporaneous player-visible views.
import {readFileSync,writeFileSync} from 'node:fs';
import * as B from '../src/board.js';
import {enumerateReachable} from '../src/analysis/rook.js';
import {tsdScaffolds,tsdScaffoldPotential} from '../src/analysis/rook-tsd.js';

const data=readFileSync(process.env.ROOK_LOCK_TRACE_INPUT??
  'rook-public-all-locks.jsonl','utf8').trim().split('\n')
  .filter(Boolean).map(JSON.parse);
if(!data.length)throw Error('No player-visible lock traces');
const byRole=new Map();
for(const row of data){
  const v=row.visible;
  if(!['rook','kiwi'].includes(row.kind)||
    v?.next?.length!==5||!v.board||!v.current||!v.rules||
    'bag' in v||'rng' in v||'holes' in v||'opponent' in v||
    'checkpoint' in v||typeof row.outcome?.fullTsd!=='boolean')
    throw Error('Non-public input, unknown role, or missing TSD authority label');
  const k=row.seed+'/'+row.slot+'/'+row.kind;
  if(!byRole.has(k))byRole.set(k,[]);
  const group=byRole.get(k);
  if(group.length&&row.turn!==group.at(-1).turn+1)
    throw Error('Non-contiguous synchronized public locks');
  group.push(row);
}
function proofNow(v){
  if(v.current.type!=='t')return false;
  const candidates=enumerateReachable(v.board,v.current,v.rules,
    {maxStates:1600,maxSteps:70});
  return candidates.some(candidate=>{
    if(candidate.spin!=='full')return false;
    const board={...v.board,rows:v.board.rows.map(row=>row.slice())};
    if(!B.legal(board,candidate.piece))return false;
    B.commit(board,candidate.piece);
    return B.fullLines(board).length===2;
  });
}
function quality(rows){
  const predicted=rows.filter(x=>x.signal).length;
  const actual=rows.filter(x=>x.future).length;
  const tp=rows.filter(x=>x.signal&&x.future).length;
  const fp=rows.filter(x=>x.signal&&!x.future).length;
  const fn=rows.filter(x=>!x.signal&&x.future).length;
  const tn=rows.filter(x=>!x.signal&&!x.future).length;
  return {samples:rows.length,positives:actual,predicted,tp,fp,fn,tn,
    precision:predicted?Number((tp/predicted).toFixed(3)):null,
    recall:actual?Number((tp/actual).toFixed(3)):null,
    specificity:fp+tn?Number((tn/(fp+tn)).toFixed(3)):null,
    baseRate:rows.length?Number((actual/rows.length).toFixed(3)):null};
}
const features=['anyScaffold','missingAtMostOne','fullSpinGeometry',
  'fullGeometryAndVisibleT','verifiedImmediateTsd'];
const horizons=[1,2,3];
const summaries=[], examples=[];
let totalNow=0,withGeometricSlot=0,geometricButNotReachable=0;
for(const [role,rows] of byRole){
  const observations=rows.map((row,i)=>{
    const v=row.visible;
    const slots=tsdScaffolds(v.board,v.rules,{maxMissing:4});
    const full=slots.some(s=>s.fullSpinGeometry);
    const near=slots.some(s=>s.missing<=1);
    const immediate=proofNow(v);
    const visibleT=v.current.type==='t'||v.hold?.piece==='t'||
      v.next.includes('t');
    totalNow+=Number(immediate);
    withGeometricSlot+=Number(full);
    geometricButNotReachable+=Number(full&&!immediate);
    return {turn:row.turn,kind:row.kind,seed:row.seed,
      actualTsdNow:row.outcome.fullTsd,
      potential:tsdScaffoldPotential(v.board,v.rules),
      flags:{anyScaffold:slots.length>0,
        missingAtMostOne:near,fullSpinGeometry:full,
        fullGeometryAndVisibleT:full&&visibleT,
        verifiedImmediateTsd:immediate},i};
  });
  for(const horizon of horizons){
    // Exclude the final horizon locks: their future true outcomes are unknown.
    const seen=observations.slice(0,Math.max(0,observations.length-horizon));
    for(const feature of features){
      const pairs=seen.map(s=>({
        signal:s.flags[feature],
        future:observations.slice(s.i+1,s.i+1+horizon).some(x=>x.actualTsdNow)
      }));
      summaries.push({role,kind:rows[0].kind,horizon,feature,
        ...quality(pairs)});
    }
  }
  examples.push({role,locks:rows.length,actualFullTsd:observations.filter(x=>
    x.actualTsdNow).length,
    scaffoldPositive:observations.filter(x=>x.flags.anyScaffold).length,
    fullGeometric:observations.filter(x=>x.flags.fullSpinGeometry).length,
    immediateProved:observations.filter(x=>x.flags.verifiedImmediateTsd).length,
    sample:observations.filter(x=>x.flags.fullSpinGeometry).slice(0,8)});
}
const report={format:'rook-tsd-positive-negative-control/1',
  locks:data.length,independentSeeds:new Set(data.map(x=>x.seed)).size,
  authorityEvents:data.filter(x=>x.outcome.fullTsd).length,
  geometricFullCount:withGeometricSlot,
  geometryWithoutImmediateSrsProof:geometricButNotReachable,
  immediateSrsProofCount:totalNow,summaries,roles:examples,
  warning:'Prediction samples overlap and all may originate from one seed. A visible geometric TSD slot is not a legal executable SRS+ TSD or evidence of KO strength. Baseline prevalence and false positives are essential.'};
if(process.env.ROOK_LOCK_AUDIT_OUTPUT)writeFileSync(process.env.ROOK_LOCK_AUDIT_OUTPUT,
  JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,summaries:summaries.filter(x=>
  x.horizon===2&&['anyScaffold','fullSpinGeometry','verifiedImmediateTsd'].includes(x.feature)),
  roles:examples.map(({sample,...x})=>x)}));
