// Forecast calibration, NOT a strength/KO benchmark: no opponent receives attacks.
// ROOK receives only player-visible snapshots. Authority totals are inspected
// afterward exclusively for differential validation, never passed to chooseMove.
import {Engine} from '../src/engine.js';
import {RookSession} from '../src/analysis/rook-session.js';
import {chooseMove} from '../src/analysis/rook.js';

const seeds=(process.env.SEEDS??'67020,67023').split(',').map(Number);
const count=Number(process.env.PIECES??32),horizon=Number(process.env.HORIZON??4);
if(seeds.some(x=>!Number.isSafeInteger(x))||new Set(seeds).size!==seeds.length||
  !Number.isInteger(count)||count<1||count>400||
  !Number.isInteger(horizon)||horizon<1||horizon>5)throw Error('invalid calibration configuration');
const configs={depth:4,beamWidth:24,maxNodes:6000,maxStates:1200,maxSteps:42,
  includeRanked:true,traceRootScores:true};
for(const seed of seeds){
  const e=new Engine({mode:'tl',seed,rules:{g:0,gincrease:0,b2bcharge_base:3},
    handling:{arr:0,das:1,dcd:0,sdf:20,safelock:false,cancel:false,
      may20g:true,irs:'off',ihs:'off'}});
  const original=e.serialize();let decisions=[];
  const session=new RookSession(e,{options:configs,decide:(publicView,opts)=>{
    if(publicView.next.length!==5||'bag' in publicView||'holes' in publicView)
      throw Error('ROOK public information boundary violated');
    const choice=chooseMove(publicView,opts);
    decisions.push(choice);
    return choice;
  }});
  const attempts=[];let firstMismatch=0;
  const counters=state=>({...state.attack?.totals});
  for(let i=0;i<count&&!session.view().stopped;i++){
    decisions=[];
    const before=session.view(),prev=counters(before.state);
    const next=session.step().view;
    // Post-Hold fresh reanalysis is authoritative, not the old Hold forecast.
    const chosen=decisions.at(-1),first=chosen.rootScores?.[0]?.leaf.forecastLocks?.[0];
    const now=counters(next.state),actual={generated:now.generated-prev.generated,
      sent:now.sent-prev.sent,cancelled:now.cancelled-prev.cancelled};
    if(first&&chosen.kind==='place'&&['generated','sent','cancelled'].some(k=>first[k]!==actual[k])){
      firstMismatch++;
      console.error('FIRST_LOCK_PARITY_ERROR',JSON.stringify({seed,i,first,actual}));
    }
    attempts.push({turn:i,fromHold:decisions.length===2,
      forecast:chosen.rootScores?.[0]?.leaf.forecastLocks??[],
      forecastPly:chosen.rootScores?.[0]?.leaf.ply??null,
      selectedScore:chosen.diagnostics.value,totals:now,
      generated:actual.generated,sent:actual.sent,cancelled:actual.cancelled,
      btb:next.state.attack?.btb??0});
  }
  let paired=0,sumPred=0,sumActual=0,sumAbsoluteError=0;
  const samples=[];
  for(let i=0;i+horizon-1<attempts.length;i++){
    const row=attempts[i];
    if(row.forecast.length<horizon)continue;
    const predicted=row.forecast.slice(0,horizon).reduce((a,x)=>a+x.sent,0);
    const observed=attempts.slice(i,i+horizon).reduce((a,x)=>a+x.sent,0);
    paired++;sumPred+=predicted;sumActual+=observed;
    sumAbsoluteError+=Math.abs(predicted-observed);
    samples.push({turn:row.turn,predicted,observed,
      error:predicted-observed,openingHold:row.fromHold});
  }
  const result={format:'rook-forecast-calibration/1',seed,pieces:attempts.length,
    firstLockParityErrors:firstMismatch,comparedFirstLocks:attempts.length,
    pairedHorizons:paired,horizon,projectedSent:sumPred,realizedSent:sumActual,
    meanAbsoluteError:paired?Number((sumAbsoluteError/paired).toFixed(3)):null,
    generated:attempts.reduce((a,x)=>a+x.generated,0),
    sent:attempts.reduce((a,x)=>a+x.sent,0),
    originalUnchanged:original===e.serialize(),
    samples:samples.slice(0,16)};
  console.log(JSON.stringify(result));
  if(firstMismatch)process.exitCode=1;
}
