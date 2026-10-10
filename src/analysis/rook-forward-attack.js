// Experimental multi-lock Full TSD candidate discovery from strictly public
// Current + NEXT5. Every setup and finishing move has a real SRS+ witness.
// Unlike reverse exact-cover, intermediate line clears are supported.
// Geometry is used ONLY to prune the beam, never as promised attack.
import * as B from '../board.js';
import {enumerateReachable} from './rook.js';
import {tsdScaffoldPotential} from './rook-tsd.js';
import {visibleCombat,advanceCombatClock,forecastPublicTank,projectCombat} from './rook-combat.js';

const clone=b=>({...b,rows:b.rows.map(row=>row.slice())});
const spawn=(type,b)=>({type,x:Math.ceil(b.width/2)-1,y:b.buffer-2.04,
  hy:b.buffer-2,r:0,kick:0,rotated:false,spin:'none',wall:false,
  sleeping:false,locking:0,resets:0,rotationResets:0,totalRotations:0,
  safelock:0,keys:0,softDropped:false,forceLock:false});
const gridKey=board=>board.rows.map(row=>row.map(x=>
  x===null?'.':x==='gb'?'g':x==='gbd'?'p':'#').join('')).join('');
const pointKey=move=>B.cells(move.piece).map(([x,y])=>[x,Math.ceil(y)]);
const moveRecord=move=>({type:move.piece.type,cells:pointKey(move),
  x:move.piece.x,y:Math.ceil(move.piece.y),rotation:move.piece.r,
  path:move.path,spin:move.spin});
const asAction=move=>({action:{kind:'place'},move:{piece:move.type,
  x:move.x,y:move.y,rotation:move.rotation,useHold:false,
  cells:move.cells},execution:{moves:move.path,spin:move.spin}});
function surface(board){
  let holes=0,peak=0,rough=0,last=0;
  for(let x=0;x<board.width;x++){
    let height=0,seen=false;
    for(let y=0;y<board.rows.length;y++){
      const solid=board.rows[y][x]!==null;
      if(solid&&!seen){seen=true;height=board.rows.length-y;}
      if(!solid&&seen)holes++;
    }
    peak=Math.max(peak,height);
    if(x)rough+=Math.abs(height-last);
    last=height;
  }
  return {holes,peak,rough};
}
function legalTransition(node,move,visible){
  const board=clone(node.board);
  if(!B.legal(board,move.piece)||B.commit(board,move.piece))return null;
  const clear=B.fullLines(board),
    garbageRows=clear.filter(y=>board.rows[y].includes('gb')).length;
  B.removeLines(board,clear);
  const allClear=clear.length>0&&B.emptyWithPerma(board);
  const projected=projectCombat(advanceCombatClock(node.combat,node.frame,24,
    visible.rules),{lines:clear.length,spin:move.spin,allClear,garbageRows},
    visible.rules);
  // A hidden hole after publicly known tanking invalidates future geometry.
  const tank=forecastPublicTank(projected.combat,projected.blocked,visible.rules);
  return {board,combat:projected.combat,frame:node.frame+24,
    unknownHole:tank.unknownHole,lines:clear.length,
    generated:projected.generated,sent:projected.offensive,
    cancelled:projected.defensive,btb:projected.btb};
}
export function searchPublicForwardTsd(visible,{
  minSetupPieces=2,maxSetupPieces=4,beamWidth=16,
  maxPlacementEvaluations=2500,maxProofCalls=100,
  maxStates=950,maxSteps=70,maxPlans=4,
  heldTFinish=false,heldTSetupPieces=3
}={}){
  if(!visible?.playing||!visible.current||!visible.board||!visible.rules||
    !Array.isArray(visible.next)||visible.next.length!==5||
    'bag' in visible||'rng' in visible||'holes' in visible)
    throw Error('Only player-visible Current/Hold/NEXT5 allowed');
  if(typeof heldTFinish!=='boolean'||
    !Number.isInteger(heldTSetupPieces)||heldTSetupPieces<2||
    heldTSetupPieces>5||
    ![minSetupPieces,maxSetupPieces,beamWidth,maxPlacementEvaluations,
    maxProofCalls,maxStates,maxSteps,maxPlans].every(Number.isInteger)||
    minSetupPieces<1||maxSetupPieces<minSetupPieces||maxSetupPieces>5||
    beamWidth<1||beamWidth>128||maxPlacementEvaluations<1||
    maxPlacementEvaluations>100000||maxProofCalls<1||maxProofCalls>10000||
    maxStates<1||maxStates>10000||maxSteps<1||maxSteps>150||
    maxPlans<1||maxPlans>100)
    throw new RangeError('Invalid public forward TSD search budget');
  const known=[visible.current.type,...visible.next];
  const viaHeldT=heldTFinish&&visible.hold?.piece==='t'&&
    visible.rules.hold===true;
  const targetIndex=viaHeldT?heldTSetupPieces:known.indexOf('t');
  const stats={targetIndex,viaHeldT,stageSizes:[],proofCalls:0,placements:0,
    candidateTerminals:0,garbageAborts:0,pruned:0,truncated:false};
  if(targetIndex<minSetupPieces||targetIndex>maxSetupPieces||
    (viaHeldT&&known[0]==='t'))
    return {plans:[],stats,scope:'only first publicly known T, no Hold'};
  let beam=[{board:clone(visible.board),combat:visibleCombat(visible),
    frame:visible.frame,firstKey:null,history:[],score:0,
    totalSent:0,totalGenerated:0}];
  for(let ply=0;ply<targetIndex;ply++){
    const candidates=new Map();
    for(const node of beam){
      if(stats.proofCalls>=maxProofCalls||
        stats.placements>=maxPlacementEvaluations){stats.truncated=true;break;}
      const piece=ply===0?visible.current:spawn(known[ply],node.board);
      if(!B.legal(node.board,piece))continue;
      stats.proofCalls++;
      const options=enumerateReachable(node.board,piece,visible.rules,
        {maxStates,maxSteps});
      for(const move of options){
        if(stats.placements>=maxPlacementEvaluations){stats.truncated=true;break;}
        stats.placements++;
        const p=legalTransition(node,move,visible);
        if(!p){stats.pruned++;continue;}
        if(p.unknownHole){stats.garbageAborts++;continue;}
        const firstKey=node.firstKey??JSON.stringify(pointKey(move));
        const potential=tsdScaffoldPotential(p.board,visible.rules);
        const shape=surface(p.board);
        // Beam ranking ONLY: scaffolds contribute no generated attack.
        const score=potential*2.4-shape.holes*2.8-shape.peak*.37-
          shape.rough*.16+(node.totalSent+p.sent)*2.2;
        const candidate={board:p.board,combat:p.combat,frame:p.frame,
          history:[...node.history,moveRecord(move)],score,firstKey,
          totalSent:node.totalSent+p.sent,
          totalGenerated:node.totalGenerated+p.generated};
        const key=gridKey(p.board)+'|'+p.combat.btb+'|'+p.combat.combo;
        const prior=candidates.get(key);
        if(!prior||candidate.score>prior.score)candidates.set(key,candidate);
      }
    }
    const sorted=[...candidates.values()].sort((a,b)=>b.score-a.score);
    // Retain multiple distinct initial choices before filling beam by score.
    const chosen=[],rootSeen=new Set(),reserve=Math.min(beamWidth,
      Math.ceil(beamWidth/3));
    for(const candidate of sorted){
      if(rootSeen.has(candidate.firstKey))continue;
      rootSeen.add(candidate.firstKey);chosen.push(candidate);
      if(chosen.length>=reserve)break;
    }
    const inBeam=new Set(chosen);
    for(const candidate of sorted){
      if(chosen.length>=beamWidth)break;
      if(!inBeam.has(candidate)){inBeam.add(candidate);chosen.push(candidate);}
    }
    beam=chosen;
    stats.stageSizes.push(beam.length);
    if(!beam.length)break;
  }
  const plans=[];
  for(const node of beam){
    if(stats.proofCalls>=maxProofCalls||
      stats.placements>=maxPlacementEvaluations){stats.truncated=true;break;}
    const t=spawn('t',node.board);
    if(!B.legal(node.board,t))continue;
    stats.proofCalls++;
    const moves=enumerateReachable(node.board,t,visible.rules,
      {maxStates,maxSteps});
    for(const move of moves){
      if(stats.placements>=maxPlacementEvaluations){stats.truncated=true;break;}
      stats.placements++;
      if(move.spin!=='full')continue;
      const projected=legalTransition(node,move,visible);
      if(!projected||projected.lines!==2)continue;
      stats.candidateTerminals++;
      const witnesses=[...node.history,moveRecord(move)];
      const actions=witnesses.map(asAction);
      if(viaHeldT)actions.splice(-1,0,{action:{kind:'hold',mode:'occupied'}});
      plans.push({witnesses,actions,
        evidence:{allMovesSrsWitnessed:true,terminalFullTsd:true,
          terminalLines:2,terminalGenerated:projected.generated,
          terminalSent:projected.sent,preTGenerated:node.totalGenerated,
          preTSent:node.totalSent,terminalBtb:projected.btb,
          publicNoNewGarbageAssumption:true,
          terminalUsesHeldT:viaHeldT},
        planLength:targetIndex+1,setupScore:node.score});
      if(plans.length>=maxPlans){stats.truncated=true;break;}
    }
    if(stats.truncated)break;
  }
  plans.sort((a,b)=>b.evidence.terminalSent-a.evidence.terminalSent||
    b.evidence.preTSent-a.evidence.preTSent||b.setupScore-a.setupScore);
  return {plans,stats,
    scope:viaHeldT?'public fixed known setup then occupied Hold T full spin':
      'public fixed known order, no Hold, bounded all-SRS+ forward portfolio'};
}
