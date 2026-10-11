// Bounded constraint-guided inverse setup search for a Full T spin with the
// next 3-5 *publicly known* non-T pieces before the known T. Experimental.
// No private bag, opponent future, or speculative attack without SRS+ proof.
import * as B from '../board.js';
import spins from '../data/spins.json' with {type:'json'};
import {enumerateReachable} from './rook.js';
import {reverseAttackGoals} from './rook-reverse-planner.js';
import {visibleCombat,projectCombat} from './rook-combat.js';

const copy=b=>({...b,rows:b.rows.map(row=>row.slice())});
const cellKey=(x,y)=>x+','+y;
const cells=p=>B.cells(p).map(([x,y])=>[x,Math.ceil(y)]);
const boardKey=b=>b.rows.map(r=>r.map(c=>c===null?'.':c==='gb'?'g':'#').join('')).join('');
const spawn=(type,b)=>({type,x:Math.ceil(b.width/2)-1,y:b.buffer-2.04,hy:b.buffer-2,r:0,
  kick:0,rotated:false,spin:'none',wall:false,sleeping:false,locking:0,resets:0,
  rotationResets:0,totalRotations:0,safelock:0,keys:0,softDropped:false,forceLock:false});
const action=m=>({kind:'place',move:{piece:m.piece.type,x:m.piece.x,y:Math.ceil(m.piece.y),
  rotation:m.piece.r,useHold:false,cells:cells(m.piece)},execution:{moves:m.path,spin:m.spin}});

function progress(board,goal){
  const required=goal.requiredRows;
  let unfilled=0;
  for(const c of required){const [x,y]=c.split(',').map(Number);
    if(board.rows[y]?.[x]===null)unfilled++;}
  const data=spins.cornerTable.t[goal.rotation],cx=goal.x,cy=goal.y;
  const corners=data.map(([dx,dy,...front])=>({x:cx+dx,y:cy+dy,front:front.includes(goal.rotation),
    covered:B.occupied(board,cx+dx,cy+dy)}));
  const filled=corners.filter(c=>c.covered),front=filled.filter(c=>c.front).length;
  const minCorner=Math.max(0,3-filled.length,2-front);
  return {unfilled,minCorner,required:unfilled+minCorner,
    cornerTargets:corners.filter(c=>!c.covered).map(c=>cellKey(c.x,c.y))};
}
function fill(board,m){
  if(!B.legal(board,m.piece))return null;
  const next=copy(board);B.commit(next,m.piece);
  // Row removal would change the goal's coordinate system. Leave it to the
  // next milestone instead of silently pretending the rows did not shift.
  if(B.fullLines(next).length)return null;
  return next;
}
function overlapGoal(m,blocked){
  return cells(m.piece).some(([x,y])=>blocked.has(cellKey(x,y)));
}
function fullSpin(board,t,goal){
  if(t.spin!=='full'||t.piece.x!==goal.x||Math.ceil(t.piece.y)!==goal.y||
    t.piece.r!==goal.rotation)return false;
  const copyBoard=copy(board);B.commit(copyBoard,t.piece);
  return B.fullLines(copyBoard).length===goal.lines;
}
export function searchLongReverseAttacks(visible,{maxSetupPieces=5,maxGoals=18,
  beamWidth=10,maxCandidates=1000,maxStates=950,maxSteps=70,
  maxPlans=3,goalTypes=['TSS','TSD'],goalScanRows=6}={}){
  if(!visible?.playing||!visible?.board||!visible.current||!visible.rules||
    !Array.isArray(visible.next)||visible.next.length!==5)
    throw Error('Long inverse planner requires exactly public current and NEXT5');
  const known=[visible.current.type,...visible.next];
  const pre=known.indexOf('t');
  const stats={goals:0,setupCandidates:0,forwardProofs:0,firstFoundAt:null,
    prunedByConstraint:0,budgetExceeded:false,stageWidths:[]};
  if(pre<3||pre>Math.min(5,maxSetupPieces))
    return {plans:[],stats,scope:'only 3-5 publicly known non-T setup pieces before T'};
  const initialGoals=reverseAttackGoals(visible.board,visible.rules,{
    targets:goalTypes,maxGoals:4000,maxMissing:Math.min(20,pre*4),scanRows:goalScanRows});
  // TSS has easier deficits, but excluding it in favor of only TSD also
  // wastes Full Single / B2B options. Keep a minimum pool for each.
  const tsd=initialGoals.filter(g=>g.kind==='TSD');
  const tss=initialGoals.filter(g=>g.kind==='TSS');
  const tsdSlots=tss.length?Math.max(1,Math.ceil(maxGoals*.72)):maxGoals;
  const ordered=[...tsd.slice(0,tsdSlots),...tss.slice(0,maxGoals-tsdSlots),
    ...tsd.slice(tsdSlots),...tss.slice(Math.max(0,maxGoals-tsdSlots))];
  const chosen=[],seen=new Set();
  for(const goal of ordered){
    const k=[goal.kind,goal.x,goal.y,goal.rotation].join(':');
    if(seen.has(k))continue;
    seen.add(k);chosen.push(goal);
    if(chosen.length>=maxGoals)break;
  }
  stats.goals=chosen.length;
  if(!chosen.length)return {plans:[],stats,scope:'no attainable row/corner preimages'};
  const output=[],seenPlan=new Set();
  const dualGoal=tsd.length>0&&tss.length>0;
  const tssBudget=dualGoal?Math.max(1,Math.floor(maxCandidates*.25)):maxCandidates;
  const tsdBudget=dualGoal?maxCandidates-tssBudget:maxCandidates;
  const usedByType={TSD:0,TSS:0};
  const capFor=kind=>dualGoal?(kind==='TSD'?tsdBudget:tssBudget):maxCandidates;
  const combat=visibleCombat({piecesPlaced:visible.piecesPlaced,attack:visible.attack});
  const witnessCache=new Map();
  function moves(board,index){
    const key=boardKey(board)+'|'+known[index]+'|'+index;
    const old=witnessCache.get(key);
    if(old)return old;
    const piece=index===0?visible.current:spawn(known[index],board);
    const next=enumerateReachable(board,piece,visible.rules,{maxStates,maxSteps});
    if(witnessCache.size<750)witnessCache.set(key,next);
    return next;
  }
  for(const goal of chosen){
    if(stats.setupCandidates>=maxCandidates||output.length>=maxPlans)break;
    if(usedByType[goal.kind]>=capFor(goal.kind))continue;
    const forbidden=new Set(goal.blockedCells);
    let beam=[{board:visible.board,history:[],score:0}];
    for(let step=0;step<pre&&beam.length;step++){
      const next=[],dedup=new Set();
      for(const node of beam){
        if(stats.setupCandidates>=maxCandidates||usedByType[goal.kind]>=capFor(goal.kind))break;
        const was=progress(node.board,goal),remain=pre-step;
        for(const move of moves(node.board,step)){
          if(usedByType[goal.kind]>=capFor(goal.kind))break;
          usedByType[goal.kind]++;stats.setupCandidates++;
          if(stats.setupCandidates>maxCandidates)break;
          if(overlapGoal(move,forbidden)){stats.prunedByConstraint++;continue;}
          const board=fill(node.board,move);
          if(!board)continue;
          const now=progress(board,goal);
          const decrease=was.required-now.required;
          if(decrease<=0||now.required>(remain-1)*4){stats.prunedByConstraint++;continue;}
          const k=boardKey(board);
          if(dedup.has(k))continue;
          dedup.add(k);
          // Constraint satisfaction first; minor overhead penalty to avoid
          // filling meaningless cells when two lines still need completion.
          const overhead=4-decrease;
          const score=node.score+decrease*7-overhead*1.1-now.required*0.22;
          next.push({board,history:[...node.history,move],score});
        }
      }
      next.sort((a,b)=>b.score-a.score);
      beam=next.slice(0,beamWidth);
      stats.stageWidths.push(beam.length);
    }
    for(const node of beam){
      if(output.length>=maxPlans)break;
      const remain=progress(node.board,goal);
      if(remain.unfilled||remain.minCorner)continue;
      stats.forwardProofs++;
      const tMoves=moves(node.board,pre);
      const completed=tMoves.find(m=>fullSpin(node.board,m,goal));
      if(!completed)continue;
      const history=[...node.history,completed];
      const signature=history.map(m=>cells(m.piece).map(([x,y])=>cellKey(x,y)).sort().join(';')+'/'+m.spin).join('|');
      if(seenPlan.has(signature))continue;
      seenPlan.add(signature);
      let active=combat;
      for(let step=0;step<pre;step++)active=projectCombat(active,
        {lines:0,spin:'none',allClear:false,garbageRows:0},visible.rules).combat;
      const finalBoard=copy(node.board);B.commit(finalBoard,completed.piece);
      const rows=B.fullLines(finalBoard),garbageRows=rows.filter(y=>finalBoard.rows[y].includes('gb')).length;
      B.removeLines(finalBoard,rows);
      const allClear=rows.length>0&&B.emptyWithPerma(finalBoard);
      const attack=projectCombat(active,
        {lines:rows.length,spin:'full',allClear,garbageRows},visible.rules);
      if(stats.firstFoundAt===null)stats.firstFoundAt=stats.setupCandidates;
      output.push({goal:{kind:goal.kind,lines:goal.lines,x:goal.x,y:goal.y,
          rotation:goal.rotation,requiredRows:goal.requiredRows,minMissing:goal.minMissing},
        actions:history.map(action),witnesses:history.map(m=>({piece:m.piece,
          path:m.path,spin:m.spin,softdrop:m.softdrop})),
        evidence:{reachable:true,actualAuthorityExecuted:false,spin:'full',
          lines:rows.length,attack:attack.generated,sent:attack.offensive,
          btb:attack.btb,allClear},planLength:history.length});
    }
  }
  stats.byType=usedByType;
  stats.budgetExceeded=stats.setupCandidates>=maxCandidates;
  output.sort((a,b)=>b.evidence.sent-a.evidence.sent||b.evidence.attack-a.evidence.attack||a.planLength-b.planLength);
  return {plans:output,stats,scope:'4-6 piece inverse Full TSS/TSD, no Hold or intermediate clears'};
}