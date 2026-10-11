// Authority-only research fork. The policy receives public view() alone;
// hidden bag/hole RNG is preserved ONLY within paired authoritative engines.
// One original-match seed may produce at most ONE selected fork.
import {plannedHold,proveForecastPlacement} from '../src/analysis/rook-plan.js';
import {assertSimultaneousPair,scoreKO} from './rook-ko-protocol.js';

export function runHoldCounterfactual({demos,kinds,forecast,seed,turn,
  prepareUntilPlace,cap=2000}){
  if(kinds.join(',')!=='rook,kiwi')
    throw Error('Hold fork requires the original rook/kiwi slots');
  if(!Number.isInteger(cap)||cap<1||cap>2000)
    throw Error('Expected a KO-first 2000-lock safety cap');
  const run=(forceForecast)=>{
    const copies=demos.map(d=>d.fork());
    let inbound=[],round=turn,error=null,forced=false;
    let rookNodes=0,kiwiNodes=0,rookMs=0,kiwiMs=0;
    try{
      while(round<cap&&copies.every(d=>d.engine.state.playing)){
        if(round!==turn){
          for(const packet of inbound){
            const e=copies[packet.to].engine;
            const cid=e.receive({from:'P2',iid:packet.iid,
              ackiid:packet.ackiid,amt:packet.amt});
            e.confirm(cid);
          }
        }
        inbound=[];
        if(copies.some(d=>!d.engine.state.playing))break;
        const frame=assertSimultaneousPair(copies);
        const decisions=[];
        for(let i=0;i<2;i++){
          if(forceForecast&&round===turn&&i===0){
            const before=copies[0].view();
            const h=plannedHold(before.visible,forecast);
            if(!h)throw Error('Forecast Hold no longer publicly permitted');
            copies[0].prepare(h,before.revision);
            copies[0].commit(before.revision);
            const after=copies[0].view();
            const proof=proveForecastPlacement(after.visible,{
              ...forecast,preBoardKey:forecast.preBoardKey,
              preCurrent:after.visible.current.type
            },{maxStates:1200,maxSteps:42});
            if(!proof)throw Error('Forecast Hold+placement lacks SRS proof');
            copies[0].prepare(proof,after.revision);
            decisions.push({revision:after.revision,nodes:0,searchMs:0});
            forced=true;
          }else{
            const decision=prepareUntilPlace(copies[i],kinds[i]);
            decisions.push(decision);
            if(i===0){rookNodes+=decision.nodes;rookMs+=decision.searchMs;}
            else {kiwiNodes+=decision.nodes;kiwiMs+=decision.searchMs;}
          }
        }
        if(assertSimultaneousPair(copies)!==frame)
          throw Error('Fork did not prepare synchronous decisions');
        for(let i=0;i<2;i++)copies[i].commit(decisions[i].revision);
        assertSimultaneousPair(copies);
        for(let i=0;i<2;i++)
          for(const x of copies[i].engine.state.attack.outbox.splice(0))
            inbound.push({to:1-i,iid:x.iid,ackiid:x.ackiid,amt:x.amt});
        round++;
      }
    }catch(e){error=e instanceof Error?e.message:String(e)}
    const scored=scoreKO({alive:copies.map(d=>d.engine.state.playing),
      rounds:round,cap,error});
    return {forced,roundsFromStart:round,continuationLocks:round-turn,
      termination:scored.termination,scored:scored.scored,
      winner:scored.scored?kinds[scored.winnerSlot]:null,error,
      rookNodes,kiwiNodes,rookMs:+rookMs.toFixed(2),
      kiwiMs:+kiwiMs.toFixed(2),
      slots:copies.map((d,i)=>({kind:kinds[i],
        pieces:d.engine.state.stats.pieces,
        sent:d.engine.state.attack.totals.sent,
        generated:d.engine.state.attack.totals.generated,
        tanked:d.engine.state.attack.totals.tanked,
        playing:d.engine.state.playing}))};
  };
  const reactive=run(false);
  const retained=run(true);
  return {format:'rook-hold-counterfactual-fork/1',seed,turn,
    independentOriginalSeed:seed,independentForkPairs:1,
    sameAuthorityInitialState:true,hiddenFutureNeverPassedToBot:true,
    originalForecastUsesHold:true,continuationPolicy:'fresh-every-lock',
    reactive,retained,
    deltaKO:reactive.scored&&retained.scored
      ?Number(retained.winner==='rook')-Number(reactive.winner==='rook')
      :null,
    policyImproved:null,
    caution:'Selected within one original seed: descriptive paired intervention, NOT an independent full-match win or general policy improvement.'};
}
