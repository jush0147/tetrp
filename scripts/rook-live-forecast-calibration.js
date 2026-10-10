// Calibrate public ROOK forecasts against a real two-player synchronous TL.
// Identical bag seed, 24 frames per lock, and no private authority state ever
// reaches chooseMove. This reports model error; it does not award KO wins at cap.
import {BotDemo} from '../src/analysis/demo.js';
import {Engine} from '../src/engine.js';
import {chooseMove} from '../src/analysis/rook.js';
import {assertMatchingOpening,assertSimultaneousPair,scoreKO} from './rook-ko-protocol.js';

const seed=Number(process.env.SEED??67020);
const opponentOffense=Number(process.env.OPPONENT_OFFENSE_WEIGHT??4.8);
const cap=Number(process.env.MAX_LOCKS??32);
const horizon=Number(process.env.HORIZON??4);
const nodes=Number(process.env.ROOK_NODES??6000);
const depth=Number(process.env.ROOK_DEPTH??4);
const beamWidth=Number(process.env.ROOK_BEAM??24);
if(!Number.isSafeInteger(seed)||!Number.isSafeInteger(cap)||cap<2||cap>2000||
  !Number.isInteger(horizon)||horizon<1||horizon>5||
  !Number.isFinite(opponentOffense)||opponentOffense<0||opponentOffense>24||
  !Number.isInteger(nodes)||nodes<1||nodes>100000||
  !Number.isInteger(depth)||depth<1||depth>5||
  !Number.isInteger(beamWidth)||beamWidth<1||beamWidth>128)
  throw Error('Invalid calibration configuration');
const config={depth,beamWidth,maxNodes:nodes,maxStates:1200,maxSteps:42,
  includeRanked:true,traceRootScores:true};
const makeDemo=()=>new BotDemo(new Engine({mode:'tl',seed,
  rules:{g:0,gincrease:0,b2bcharge_base:3},
  handling:{arr:0,das:1,dcd:0,sdf:20,safelock:false,cancel:false,
    may20g:true,irs:'off',ihs:'off'}}),{placementMode:'atomic'});
const demos=[makeDemo(),makeDemo()];
assertMatchingOpening(demos);
const copyTotals=demo=>({...demo.engine.state.attack.totals});
const counters=['generated','sent','cancelled','received','tanked'];
const sum=items=>items.reduce((a,b)=>a+b,0);
const incidents=[],samples=[[],[]];
const work=[{eval:0,ms:0,searches:0},{eval:0,ms:0,searches:0}];
const records=[[],[]];
let incoming=[],round=0,error=null;
function plan(demo,side){
  let hold=false;
  for(let decision=0;decision<2;decision++){
    const view=demo.view(),visible=view.visible;
    if(visible.next.length!==5||'bag' in visible||'rng' in visible||
      'holes' in visible||'checkpoint' in visible)
      throw Error('Public information boundary violated');
    const frozen=JSON.stringify(visible);
    const now=performance.now();
    const report=chooseMove(visible,{...config,
      offenseWeight:side===1?opponentOffense:4.8});
    work[side].ms+=performance.now()-now;
    work[side].eval+=report.diagnostics.evaluated;
    work[side].searches++;
    if(JSON.stringify(visible)!==frozen)throw Error('Search mutated public state');
    let rejection=null;
    for(const action of report.ranked){
      const request=action.kind==='hold'
        ?{action:{kind:'hold',mode:action.mode}}
        :{action:{kind:'place'},move:action.move,execution:action.execution};
      try{demo.prepare(request,view.revision)}
      catch(e){rejection=e;continue;}
      if(action.kind==='hold'){
        if(decision!==0)throw Error('Invalid second Hold');
        demo.commit(view.revision);hold=true;break;
      }
      const key=JSON.stringify(action);
      const candidate=report.rootScores?.find(x=>JSON.stringify(x.action)===key);
      return {revision:view.revision,hold,
        predicted:candidate?.leaf?.forecastLocks??[],
        bestAction:JSON.stringify(report.ranked[0])===key,
        publicPending:[...(visible.attack?.pending??[]),
          ...(visible.attack?.are??[])].reduce((a,p)=>a+p.amt,0),
        publicFrame:visible.frame,forecastDepth:candidate?.leaf?.ply??0};
    }
    if(decision===0&&hold)continue;
    throw Error('No executable action side '+side+' '+(rejection?.message??''));
  }
  throw Error('Post-Hold placement missing');
}
try{
  while(round<cap&&demos.every(d=>d.engine.state.playing)){
    const preTransfers=demos.map(copyTotals);
    for(const packet of incoming){
      const e=demos[packet.to].engine;
      const cid=e.receive({from:'P2',iid:packet.iid,ackiid:packet.ackiid,amt:packet.amt});
      e.confirm(cid);
    }
    incoming=[];
    if(demos.some(d=>!d.engine.state.playing))break;
    const frame=assertSimultaneousPair(demos);
    const before=demos.map(d=>({total:copyTotals(d),
      btb:d.engine.state.attack.btb,combo:d.engine.state.attack.combo}));
    const plans=demos.map((d,i)=>plan(d,i));
    if(assertSimultaneousPair(demos)!==frame)
      throw Error('Desynchronized decisions');
    for(let side=0;side<2;side++){
      const d=demos[side],result=d.commit(plans[side].revision),
        after=copyTotals(d),metadata=result.lastPlacement;
      const actual=Object.fromEntries(counters.map(k=>[k,after[k]-
        (k==='received'?preTransfers[side][k]:before[side].total[k])]));
      const first=plans[side].predicted[0];
      const comparable=plans[side].bestAction&&first!==undefined;
      const expected=comparable?{...first}:null;
      const executed={...actual,piece:metadata.piece,spin:metadata.spin,
        lines:metadata.lines,btb:d.engine.state.attack.btb,
        combo:d.engine.state.attack.combo};
      const diff=comparable?['generated','sent','cancelled','btb','combo',
        'piece','spin','lines'].filter(k=>expected[k]!==executed[k]):[];
      const row={seed,round,side,hold:plans[side].hold,
        pending:plans[side].publicPending,frame:plans[side].publicFrame,
        beforeBtb:before[side].btb,beforeCombo:before[side].combo,
        actual,btb:d.engine.state.attack.btb,combo:d.engine.state.attack.combo,
        piece:metadata.piece,spin:metadata.spin,lines:metadata.lines,
        forecast:plans[side].predicted,forecastDepth:plans[side].forecastDepth,
        bestAction:plans[side].bestAction,firstComparable:comparable,
        firstMismatch:diff};
      records[side].push(row);
      if(diff.length)incidents.push({type:'first-parity',...row});
      if(round<3)samples[side].push({round,actual,pending:row.pending,
        forecast:row.forecast.slice(0,4),lines:row.lines,spin:row.spin});
    }
    assertSimultaneousPair(demos);
    for(let from=0;from<2;from++)
      for(const packet of demos[from].engine.state.attack.outbox.splice(0))
        incoming.push({to:1-from,iid:packet.iid,ackiid:packet.ackiid,amt:packet.amt});
    round++;
    if(round%8===0)process.stderr.write(JSON.stringify({round,
      sent:demos.map(d=>d.engine.state.attack.totals.sent),
      received:demos.map(d=>d.engine.state.attack.totals.received),
      tanked:demos.map(d=>d.engine.state.attack.totals.tanked)})+'\n');
  }
}catch(e){error=e instanceof Error?e.stack:String(e)}
const slots=demos.map((demo,side)=>{
  const rows=records[side],paired=[];
  for(let i=0;i+horizon<=rows.length;i++){
    const start=rows[i],forecast=start.forecast;
    if(!start.bestAction||forecast.length<horizon)continue;
    const realized=rows.slice(i,i+horizon),predict=forecast.slice(0,horizon);
    const projectedSent=sum(predict.map(f=>f.sent));
    const realizedSent=sum(realized.map(r=>r.actual.sent));
    const projectedGenerated=sum(predict.map(f=>f.generated));
    const realizedGenerated=sum(realized.map(r=>r.actual.generated));
    const comparableFields=['piece','spin','lines','generated','sent',
      'cancelled','btb','combo'];
    let firstDivergence=null;
    for(let ply=0;ply<horizon;ply++){
      const observed=realized[ply],pred=predict[ply];
      const mismatches=comparableFields.filter(k=>{
        const observedValue=['generated','sent','cancelled'].includes(k)?
          observed.actual[k]:observed[k];
        return pred[k]!==observedValue;
      });
      if(mismatches.length){firstDivergence={ply:ply+1,fields:mismatches};break;}
    }
    paired.push({round:start.round,pending:start.pending,
      firstDivergence,laterReceived:sum(realized.map(r=>r.actual.received)),
      laterTanked:sum(realized.map(r=>r.actual.tanked)),
      projectedSent,realizedSent,projectedGenerated,realizedGenerated,
      predictedEndBtb:forecast[horizon-1].btb,
      realizedEndBtb:realized.at(-1).btb});
  }
  const errorMean=(array,keyA,keyB)=>array.length?
    Number((sum(array.map(x=>Math.abs(x[keyA]-x[keyB])))/array.length).toFixed(4)):null;
  const pressure=x=>x.pending>0||x.laterTanked>0||x.laterReceived>0;
  return {side,search:work[side],locks:rows.length,
    counters:copyTotals(demo),
    realPendingLocks:rows.filter(x=>x.pending>0).length,
    realReceivedLocks:rows.filter(x=>x.actual.received>0).length,
    realTankedLocks:rows.filter(x=>x.actual.tanked>0).length,
    firstComparable:rows.filter(x=>x.firstComparable).length,
    firstMismatch:rows.filter(x=>x.firstMismatch.length).length,
    forecastHorizon:horizon,pairedWindows:paired.length,
    sentMAE:errorMean(paired,'projectedSent','realizedSent'),
    generatedMAE:errorMean(paired,'projectedGenerated','realizedGenerated'),
    btbMismatch:paired.filter(x=>x.predictedEndBtb!==x.realizedEndBtb).length,
    exactFourPlyPlans:paired.filter(x=>x.firstDivergence===null).length,
    divergentPlans:paired.filter(x=>x.firstDivergence!==null).length,
    divergentUnderPressure:paired.filter(x=>pressure(x)&&x.firstDivergence!==null).length,
    divergentInCalm:paired.filter(x=>!pressure(x)&&x.firstDivergence!==null).length,
    divergenceFields:Object.fromEntries(['piece','spin','lines','generated','sent',
      'cancelled','btb','combo'].map(key=>[key,paired.filter(x=>
      x.firstDivergence?.fields.includes(key)).length])),
    divergenceByPly:Object.fromEntries(Array.from({length:horizon},(_,i)=>
      [i+1,paired.filter(x=>x.firstDivergence?.ply===i+1).length])),
    pressureWindows:paired.filter(pressure).length,
    pressureSentMAE:errorMean(paired.filter(pressure),
      'projectedSent','realizedSent'),
    calmSentMAE:errorMean(paired.filter(x=>!pressure(x)),
      'projectedSent','realizedSent'),
    pairs:paired.slice(0,10),samples:samples[side]};
});
const verdict=scoreKO({alive:demos.map(d=>d.engine.state.playing),rounds:round,cap,error});
console.log(JSON.stringify({format:'rook-live-forecast-calibration/1',seed,
  rules:'Tetrp TL, atomic SRS+, public NEXT5, synchronized 24 frames',
  identicalSeed:true,opponentOffenseWeight:opponentOffense,rounds:round,cap,
  termination:verdict.termination,scored:verdict.scored,error,
  slots,firstMismatchIncidents:incidents.slice(0,10)}));
if(error||incidents.length)process.exitCode=1;
