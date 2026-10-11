// Authority-only research fork. The policy receives public view() alone;
// hidden bag/hole RNG is preserved ONLY within paired authoritative engines.
// One original-match seed may produce at most ONE selected fork.
import {createHash} from 'node:crypto';
import {plannedHold,proveForecastPlacement} from '../src/analysis/rook-plan.js';
import {assertSimultaneousPair,scoreKO} from './rook-ko-protocol.js';

const hashVisible=visible=>createHash('sha256')
  .update(JSON.stringify(visible)).digest('hex').slice(0,16);
const cellKey=cells=>cells?.map(([x,y])=>x+','+y).sort().join(';')??null;
function health(demo){
  const s=demo.engine.state,b=s.board,H=b.rows.length;
  let height=0,holes=0,garbage=0;
  for(let x=0;x<b.width;x++){
    let covered=false;
    for(let y=0;y<H;y++){
      const v=b.rows[y][x];
      if(v!==null){
        if(!covered)height=Math.max(height,H-y);
        covered=true;
        if(v==='gb'||v==='gbd')garbage++;
      }else if(covered)holes++;
    }
  }
  return {alive:s.playing,height,holes,garbage,btb:s.attack.btb,
    sent:s.attack.totals.sent,generated:s.attack.totals.generated,
    tanked:s.attack.totals.tanked,cancelled:s.attack.totals.cancelled,
    pending:[...(s.attack.pending??[]),...(s.attack.are??[])]
      .reduce((n,p)=>n+p.amt,0)};
}


export function runHoldCounterfactual({demos,kinds,forecast,seed,turn,
  prepareUntilPlace,cap=2000}){
  if(kinds.join(',')!=='rook,kiwi')
    throw Error('Hold fork requires the original rook/kiwi slots');
  if(!Number.isInteger(cap)||cap<1||cap>2000)
    throw Error('Expected a KO-first 2000-lock safety cap');
  const windowLocks=new Set([1,2,3,4,5,6,8,16,32,64]);
  const startingAuthority=demos.map(d=>JSON.stringify(d.engine.serialize()));
  const run=(forceForecast)=>{
    const copies=demos.map(d=>d.fork());
    if(copies.some((d,i)=>JSON.stringify(d.engine.serialize())!==
      startingAuthority[i]))throw Error('Fork initial private state mismatch');
    let inbound=[],round=turn,error=null,forced=false;
    let firstAction=null,firstPublicFingerprint=null;
    const windows=[],fingerprints=[],openingActions=[];
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
            firstAction={piece:proof.move.piece,spin:proof.execution.spin,
              holdUsed:true,cellKey:cellKey(proof.move.cells)};
            forced=true;
          }else{
            const decision=prepareUntilPlace(copies[i],kinds[i]);
            decisions.push(decision);
            if(i===0){
              if(round===turn)firstAction={
                piece:decision.placement?.piece??null,
                spin:decision.executionSpin??null,
                holdUsed:decision.holdCount>0,
                cellKey:cellKey(decision.placement?.cells)};
              rookNodes+=decision.nodes;rookMs+=decision.searchMs;
            }
            else {kiwiNodes+=decision.nodes;kiwiMs+=decision.searchMs;}
          }
        }
        if(assertSimultaneousPair(copies)!==frame)
          throw Error('Fork did not prepare synchronous decisions');
        for(let i=0;i<2;i++){
          const view=copies[i].commit(decisions[i].revision);
          if(i===0&&round-turn<8){
            const p=decisions[i].placement;
            const opening=round===turn?firstAction:{
              piece:p?.piece??view.lastPlacement?.piece??null,
              spin:decisions[i].executionSpin??view.lastPlacement?.spin??null,
              holdUsed:(decisions[i].holdCount??0)>0,
              cellKey:cellKey(p?.cells)};
            openingActions.push({afterLocks:round-turn+1,...opening});
          }
        }
        assertSimultaneousPair(copies);
        if(round===turn)
          firstPublicFingerprint=hashVisible(copies[0].view().visible);
        const afterLocks=round-turn+1;
        const views=copies.map(d=>d.view().visible);
        if(afterLocks<=64){
          // Research-only equality fingerprints. Do not return hidden
          // authority hashes or private RNG. Compare equality in memory.
          fingerprints.push({afterLocks,
            publicHash:views.map(hashVisible),
            rookBoardHash:hashVisible(views[0].board),
            rookHoldHash:hashVisible(views[0].hold),
            authorityHash:copies.map(d=>hashVisible(d.engine.serialize()))});
        }
        if(windowLocks.has(afterLocks))
          windows.push({afterLocks,slots:copies.map(health)});
        for(let i=0;i<2;i++)
          for(const x of copies[i].engine.state.attack.outbox.splice(0))
            inbound.push({to:1-i,iid:x.iid,ackiid:x.ackiid,amt:x.amt});
        round++;
      }
    }catch(e){error=e instanceof Error?e.message:String(e)}
    const scored=scoreKO({alive:copies.map(d=>d.engine.state.playing),
      rounds:round,cap,error});
    return {forced,firstAction,firstPublicFingerprint,windows,
      fingerprints,openingActions,finalHealth:copies.map(health),
      roundsFromStart:round,continuationLocks:round-turn,
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
  const verifiedFirstActionDifference=Boolean(reactive.firstAction&&
    retained.firstAction&&
    reactive.firstAction.holdUsed===false&&
    retained.firstAction.holdUsed===true&&
    reactive.firstPublicFingerprint&&retained.firstPublicFingerprint&&
    reactive.firstPublicFingerprint!==retained.firstPublicFingerprint);
  if(!verifiedFirstActionDifference)
    throw Error('Paired counterfactual did not produce different first authoritative public states');
  const equality=[];
  const common=Math.min(reactive.fingerprints.length,retained.fingerprints.length);
  let firstPublicRookConvergence=null,firstPrivatePairConvergence=null;
  for(let i=0;i<common;i++){
    const a=reactive.fingerprints[i],b=retained.fingerprints[i];
    if(a.afterLocks!==b.afterLocks)throw Error('Fork steps misaligned');
    const rookPublicEqual=a.publicHash[0]===b.publicHash[0];
    const kiwiPublicEqual=a.publicHash[1]===b.publicHash[1];
    const bothPrivateEqual=a.authorityHash.every((h,j)=>h===b.authorityHash[j]);
    const e={afterLocks:a.afterLocks,rookPublicEqual,kiwiPublicEqual,
      rookBoardEqual:a.rookBoardHash===b.rookBoardHash,
      rookHoldEqual:a.rookHoldHash===b.rookHoldHash,
      bothPrivateEqual};
    if(firstPublicRookConvergence===null&&rookPublicEqual)
      firstPublicRookConvergence=a.afterLocks;
    if(firstPrivatePairConvergence===null&&bothPrivateEqual)
      firstPrivatePairConvergence=a.afterLocks;
    if(a.afterLocks<=8||windowLocks.has(a.afterLocks))equality.push(e);
  }
  delete reactive.fingerprints;delete retained.fingerprints;
  return {equality,firstPublicRookConvergence,firstPrivatePairConvergence,
    verifiedFirstActionDifference,format:'rook-hold-counterfactual-fork/1',seed,turn,
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
