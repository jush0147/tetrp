import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';
import * as R from '../src/rotation.js';
import {createHoles} from '../src/random.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {schedulePlacement} from '../src/analysis/placement-transport.js';
import {PlacementArenaEngine,PLACEMENT_MODEL,assertPlacementContract,validatePlacement,commitPlacement,commitHold,placementIdentity} from '../src/analysis/placement-authority.js';
import {createPlacementTools} from '../vendor/kiwi-v1/tetrp-placement-path.mjs';

const transport=createPlacementTools({Engine,boardModule:B,rotationModule:R});
const legalMoves=new Set(['moveLeft','moveRight','rotateCW','rotateCCW','rotate180','down','hardDrop']);
const key=cells=>cells.map(([x,y])=>`${x},${Math.ceil(y)}`).sort().join(';');

// Physical demonstration only. Never used by the placement strength model.
function publicPlan(snapshot,action,cadence){
  if(action?.action?.kind==='hold')return {action};
  const path=action?.execution?.moves;
  if(action?.action?.kind!=='place'||action.move?.piece!==snapshot.current.type||!Array.isArray(path)||path.length>512||
    path.at(-1)!=='hardDrop'||path.slice(0,-1).includes('hardDrop')||path.some(m=>!legalMoves.has(m)))throw new Error('Invalid placement');
  const probe=new Engine({rules:snapshot.rules}),s=probe.state;
  s.board=structuredClone(snapshot.board);s.piece=structuredClone(snapshot.current);s.hold={...snapshot.hold};
  s.bag.queue=[...snapshot.next,'i','o'];s.frame=snapshot.frame;
  // Arena uses standard handling and the default gravity schedule from frame 0.
  for(let f=1;f<=s.frame;f++)if(f>s.rules.gmargin_frames+1)s.g+=s.rules.gincrease/60;
  Object.assign(s.attack,structuredClone(snapshot.attack));s.stats.pieces=snapshot.piecesPlaced;
  s.garbageLockedUntil=snapshot.garbageLockedUntil;s.lastClear=s.attack.combo>0;
  const end=s.frame+cadence-1,inputs=schedulePlacement(probe,action,end),locks=[];
  const emit=probe.emit;
  probe.emit=function(type,data){if(type==='lock')locks.push({frame:this.state.frame,cells:B.cells(this.state.piece),spin:this.state.piece.spin});emit.call(this,type,data);};
  for(let frame=s.frame;frame<=end;frame++)probe.step(transport.inputsForFrame(inputs,frame));
  if(locks.length!==1||locks[0].frame!==end||key(locks[0].cells)!==key(action.move.cells)||locks[0].spin!==action.execution.spin)
    throw Object.assign(new Error('Public transport validation failed'),{details:{locks,target:action.move,expectedSpin:action.execution.spin,path}});
  return {action,inputs,locks:[]};
}

/** The only argument delivered to either policy is a detached PublicSnapshot.
 * Virtual frames advance together, independent of policy wall-clock speed.
 * Hold is a submitted action and reveals a new snapshot before another request.
 */
export async function match(bots,{seeds=[1,2],holeSeeds=[101,102],framesPerPiece=24,maxFrames=18000,watchdogFrames=360000,onProgress=()=>{},record=null,executionModel=PLACEMENT_MODEL,startCheckpoint=null,onBoundary=null}={}){
  if(bots.length!==2||!Number.isInteger(framesPerPiece)||framesPerPiece<2||maxFrames!==null&&(!Number.isInteger(maxFrames)||maxFrames<1)||
    !Number.isInteger(watchdogFrames)||watchdogFrames<1)
    throw new Error('Invalid arena configuration');
  if(![PLACEMENT_MODEL,'physical-input-v1'].includes(executionModel))throw new Error('Unknown arena execution model');
  const Authority=executionModel===PLACEMENT_MODEL?PlacementArenaEngine:Engine;
  const engines=seeds.map((seed,i)=>{const e=new Authority({seed});e.state.holes=createHoles(holeSeeds[i]);return e;});
  if(startCheckpoint){
    if(executionModel!==PLACEMENT_MODEL||startCheckpoint.states?.length!==2)throw new Error('Invalid placement checkpoint');
    for(let i=0;i<2;i++){
      const s=Engine.restore(JSON.stringify(startCheckpoint.states[i])).state;
      if(s.phase!=='ready'||s.subframe!==0||!s.playing||s.frame%framesPerPiece!==0||s.attack.outbox.length)
        throw new Error('Checkpoint must be a live post-delivery decision boundary');
      assertPlacementContract(s);engines[i].state=s;
    }
    if(engines[0].state.frame!==engines[1].state.frame)throw new Error('Checkpoint clocks differ');
  }
  const startFrame=engines[0].state.frame,initialPieces=engines.map(e=>e.state.stats.pieces);
  if(record)engines.forEach((e,seat)=>record({type:'initial',seat,executionModel,seed:seeds[seat],holeSeed:holeSeeds[seat],state:structuredClone(e.state)}));
  const failures=[null,null],latencies=[[],[]],decisions=[0,0],holds=[0,0],sent=[0,0];
  const transportStats=[0,1].map(()=>({fallbackRequests:0,rejectedCandidates:0,maxSelectedRank:0}));
  const parity=[0,1].map(()=>({placements:0,holds:0,mismatches:0})),requests=[null,null];
  function failure(seat,error){
    parity[seat].mismatches++;
    const request=requests[seat];
    failures[seat]={frame:engines[seat].state.frame,message:String(error.message),executionModel,
      snapshot:request?.snapshot??null,policyAction:request?.action??error.details?.policyAction??null,
      validated:plans[seat]?.proof??null,details:error.details??null,
      actual:{visible:visibleState(engines[seat].state),reason:engines[seat].state.reason,stats:structuredClone(engines[seat].state.stats)}};
    record?.({type:'technical-failure',seat,dump:structuredClone(failures[seat])});
  }
  let frame=startFrame,deliveries=[[],[]],plans=[null,null];
  while(frame<startFrame+(maxFrames??watchdogFrames)&&engines.every(e=>e.state.playing)&&failures.every(f=>f===null)){
    for(let i=0;i<2;i++)for(const event of deliveries[i]){
      const cid=engines[i].receive({...event,from:'P2',to:'P1'});if(cid!==null)engines[i].confirm(cid);
      record?.({type:'receive',seat:i,frame,event:structuredClone(event),cid});
    }
    deliveries=[[],[]];
    if(frame%framesPerPiece===0){
      onBoundary?.({frame,states:engines.map(e=>structuredClone(e.state))});
      // Capture both before either policy runs. No opponent action is observed.
      const snapshots=engines.map(e=>visibleState(e.state));
      for(let i=0;i<2;i++){
        try{
          let snapshot=snapshots[i],action;
          for(let attempt=0;attempt<2;attempt++){
            plans[i]=null;requests[i]={snapshot:structuredClone(snapshot),action:null};
            const start=performance.now();const result=await bots[i](structuredClone(snapshot));
            decisions[i]++;
            // Read exactly one candidate. In particular, never advance a lazy
            // ranked iterator after a failed top-1 validation.
            action=structuredClone(result?.candidates?result.candidates[Symbol.iterator]().next().value:result);
            requests[i].action=action;
            if(!action||action.candidateIndex!==undefined&&action.candidateIndex!==0)throw new Error('Policy did not submit original rank zero');
            if(action.action?.kind==='hold')plans[i]={action};
            else{
              const proof=validatePlacement(snapshot,action);
              plans[i]=executionModel===PLACEMENT_MODEL?{action,proof,locks:[]}:{...publicPlan(snapshot,action,framesPerPiece),proof};
            }
            record?.({type:'decision',seat:i,frame,snapshot:structuredClone(snapshot),selected:action,validated:plans[i].proof??null});
            latencies[i].push(performance.now()-start);
            if(action?.action?.kind!=='hold')break;
            if(attempt)throw new Error('Repeated Hold');
            const actual=commitHold(engines[i],snapshot,action);parity[i].holds++;
            record?.({type:'parity',kind:'hold',seat:i,frame,intent:action,actual});
            record?.({type:'hold',seat:i,frame});
            holds[i]++;snapshot=visibleState(engines[i].state);
            if(!snapshot.playing)break;
          }
          if(!engines[i].state.playing)continue;
          if(action?.action?.kind!=='place')throw new Error('Missing placement after Hold');
        }catch(error){failure(i,error);}
      }
      if(failures.some(Boolean)||engines.some(e=>!e.state.playing))break;
    }
    for(let i=0;i<2;i++){
      const e=engines[i],original=e.emit;
      e.emit=function(type,data){
        if(type==='lock')plans[i].locks.push({...placementIdentity(this.state.piece),frame:this.state.frame,subframe:this.state.subframe});
        if(type==='remove-lines')plans[i].clear={rows:[...data.rows],lines:data.rows.length,
          garbageRows:data.rows.filter(y=>requests[i].snapshot.board.rows[y].includes('gb')).length,allClear:data.allClear};
        original.call(this,type,data);
      };
      try{
        if(executionModel===PLACEMENT_MODEL){
          assertPlacementContract(e.state);e.beginFrame([]);
          if((frame+1)%framesPerPiece===0){
            e.advanceSegment(.5);
            const actual=commitPlacement(e,plans[i].proof,frame);parity[i].placements++;
            record?.({type:'parity',kind:'placement',seat:i,frame,intent:plans[i].action,validated:plans[i].proof,actual});
          }
          e.finishFrame();
        }else{
          const inputs=transport.inputsForFrame(plans[i].inputs,frame);
          record?.({type:'inputs',seat:i,frame,inputs:structuredClone(inputs)});e.step(inputs);
        }
      }catch(error){failure(i,error);}finally{e.emit=original;}
      for(const packet of e.state.attack.outbox.splice(0)){deliveries[1-i].push(packet);sent[i]+=packet.amt;}
      e.trace=[];
    }
    if((frame+1)%framesPerPiece===0){
      for(let i=0;i<2;i++)if(!failures[i]){
        const p=plans[i],lock=p.locks[0];
        const target=p.action.move,clear=p.clear??{rows:[],lines:0,garbageRows:0,allClear:false};
        if(p.locks.length!==1||lock.frame!==frame||lock.subframe!==.5||lock.piece!==target.piece||
          lock.x!==target.x||lock.y!==target.y||lock.rotation!==target.rotation||key(lock.cells)!==key(target.cells)||
          lock.spin!==p.action.execution.spin||JSON.stringify(clear)!==JSON.stringify(p.proof.clear))
          failure(i,Object.assign(new Error('Authority execution did not match committed placement'),{details:{actual:{locks:p.locks,clear}}}));
        else if(executionModel==='physical-input-v1')parity[i].placements++;
      }
    }
    frame++;
    if(record&&frame%framesPerPiece===0)engines.forEach((e,seat)=>record({type:'anchor',seat,frame,state:structuredClone(e.state)}));
    if(frame%(framesPerPiece*25)===0)await onProgress({frame,pieces:engines.map(e=>e.state.stats.pieces)});
  }
  const ko=engines.map(e=>!e.state.playing);
  const technical=failures.some(Boolean)||!ko.some(Boolean)&&maxFrames===null;
  const lost=engines.map(e=>!e.state.playing);
  const winner=lost[0]===lost[1]?null:lost[0]?1:0;
  if(record)engines.forEach((e,seat)=>record({type:'end',seat,frame,winner:technical?null:winner,state:structuredClone(e.state)}));
  return {winner:technical?null:winner,reason:failures.some(Boolean)?'policy-or-transport-failure':ko.some(Boolean)?'topout':maxFrames===null?'watchdog':'frame-cap',
    ko,deathReasons:engines.map(e=>e.state.reason),
    executionModel,parity,frames:frame,seeds,holeSeeds,framesPerPiece,maxFrames,watchdogFrames,failures,decisions,holds,sent,latencies,transportStats,
    pieces:engines.map(e=>e.state.stats.pieces),totals:engines.map(e=>e.state.attack.totals),
    ...(startCheckpoint?{startFrame,initialPieces}: {})};
}

/** KO-only series. Technical failures and simultaneous KO never award points. */
export async function firstTo(bots,{target=7,seed=20260922,watchdogFrames=360000,onEvent=()=>{},playMatch=match,stopOnTechnical=false}={}){
  const score=[0,0],games=[];let technicalStreak=0;
  while(Math.max(...score)<target){
    const attempt=games.length+1,swapped=attempt%2===0;
    const seeds=[seed+4*(attempt-1),seed+4*(attempt-1)+1],holeSeeds=[seed+4*(attempt-1)+2,seed+4*(attempt-1)+3];
    await onEvent({type:'game-start',attempt,swapped,seeds,holeSeeds,score:[...score]});
    const result=await playMatch(swapped?[...bots].reverse():bots,{seeds,holeSeeds,framesPerPiece:24,maxFrames:null,watchdogFrames,
      onProgress:p=>onEvent({type:'progress',attempt,swapped,score:[...score],...p})});
    const validKO=result.reason==='topout'&&result.failures.every(f=>f===null)&&result.ko.some(Boolean);
    const scored=validKO&&result.ko[0]!==result.ko[1];
    const winner=scored?(swapped?1-result.winner:result.winner):null;
    if(scored)score[winner]++;
    technicalStreak=validKO?0:technicalStreak+1;
    const game={attempt,swapped,...result,seriesWinner:winner,scored,score:[...score]};games.push(game);
    await onEvent({type:'game-end',game,score:[...score]});
    if(!validKO&&stopOnTechnical)return {complete:false,reason:'technical-failure',score,games};
    // Repeated technical faults require repair, not an endless stream of discarded games.
    if(technicalStreak>=3)return {complete:false,reason:'repeated-technical-failure',score,games};
  }
  return {complete:true,winner:score[0]===target?0:1,score,games};
}

export async function pairedMatches(bots,{pairs=1,seed=1,...options}={}){
  const games=[];
  for(let p=0;p<pairs;p++){
    const seeds=[seed+2*p,seed+2*p+1],holeSeeds=[seed+100000+2*p,seed+100001+2*p];
    games.push(await match(bots,{...options,seeds,holeSeeds}));
    const reverse=await match([...bots].reverse(),{...options,seeds,holeSeeds});
    // Policy identity swaps seats; each policy now gets the other private stream.
    games.push({...reverse,swapped:true});
  }
  const points=games.map(g=>g.reason!=='topout'||g.failures.some(Boolean)||g.winner===null?null:(g.swapped?1-g.winner:g.winner)===0?1:0);
  const scored=points.filter(p=>p!==null);
  return {games,points,score:scored.length?scored.reduce((a,b)=>a+b,0)/scored.length:null,
    scoredGames:scored.length,unscoredGames:games.length-scored.length,
    failureGames:games.filter(g=>g.failures.some(Boolean)).length};
}
