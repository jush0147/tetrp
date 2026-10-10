// ROOK: independent Tetrp search engine. No Cold Clear / Kiwi evaluator or DAG.
// Tetrp owns SRS+, spin classification, board physics and canonical match rules.
import * as B from '../board.js';
import * as R from '../rotation.js';
import {visibleCombat,advanceCombatClock,forecastPublicTank,projectCombat} from './rook-combat.js';
import spinTables from '../data/spins.json' with { type: 'json' };
import {tsdScaffolds} from './rook-tsd.js';
import {searchReverseAttacks} from './rook-reverse-planner.js';
import {searchLongReverseAttacks} from './rook-long-planner.js';
import {searchOpenTSD} from './rook-open-slot.js';
import {recoveryBoardPenalty,clearedGarbageReward} from './rook-recovery.js';
import {evaluatePublicTankBelief} from './rook-belief.js';

const ACTIONS=['moveLeft','moveRight','rotateCW','rotateCCW','rotate180','down'];
const DIR={rotateCW:1,rotateCCW:3,rotate180:2};
const PIECES=new Set(['z','l','o','s','i','j','t']);
const copyBoard=b=>({...b,rows:b.rows.map(r=>r.slice())});
const fmtCells=p=>B.cells(p).map(([x,y])=>x+','+Math.ceil(y)).sort().join(';');
const poseKey=p=>[p.x,Math.ceil(p.y),p.r,p.rotated?1:0,p.spin,p.kick].join(':');
const spawn=(type,board)=>({
  type,x:Math.ceil(board.width/2)-1,y:board.buffer-2.04,
  hy:board.buffer-2,r:0,kick:0,rotated:false,spin:'none',
  wall:false,sleeping:false,locking:0,resets:0,rotationResets:0,
  totalRotations:0,safelock:0,keys:0,softDropped:false,forceLock:false
});

function step(board,p,act,rules){
  if(act==='moveLeft'||act==='moveRight'){
    const x=p.x+(act==='moveLeft'?-1:1);
    if(!B.legal(board,{...p,x}))return null;
    return {...p,x,rotated:false,spin:'none',kick:0};
  }
  if(act==='down'){
    if(!B.legal(board,{...p,y:p.y+1}))return null;
    return {...p,y:p.y+1,rotated:false,spin:'none',kick:0};
  }
  const direction=DIR[act];
  if(!direction||(direction===2&&!rules.allow180))return null;
  const q=R.rotate(board,p,direction,rules.lockresets);
  if(!q)return null;
  const next={...q,rotated:true,totalRotations:p.totalRotations+1,
    rotationResets:Math.min(63,(p.rotationResets??0)+1)};
  next.spin=R.classifySpin(board,next,rules.spinbonuses);
  return next;
}
function land(board,p){
  const q={...p};
  let steps=0;
  while(steps++<board.rows.length&&B.legal(board,{...q,y:q.y+1}))q.y++;
  return q;
}

export function enumerateReachable(board,piece,rules,{maxStates=1200,maxSteps=42}={}){
  if(!B.legal(board,piece))return [];
  const fifo=[{p:{...piece},path:[]}],seen=new Set(),results=new Map();
  for(let head=0;head<fifo.length&&seen.size<maxStates;head++){
    const {p,path}=fifo[head],key=poseKey(p);
    if(seen.has(key))continue;
    seen.add(key);
    const end=land(board,p),signature=fmtCells(end)+'|'+end.spin;
    const earlier=results.get(signature);
    if(!earlier||path.length<earlier.path.length){
      results.set(signature,{piece:end,path:[...path,'hardDrop'],
        spin:end.spin,softdrop:path.filter(m=>m==='down').length});
    }
    if(path.length>=maxSteps)continue;
    for(const act of ACTIONS){
      if(act!=='down'){
        const next=step(board,p,act,rules);
        if(next&&!seen.has(poseKey(next)))fifo.push({p:next,path:[...path,act]});
        continue;
      }
      // T-spin slots can be twenty rows below spawn. A single-row BFS with
      // a short path bound silently excludes them. Explore legal vertical
      // corridors with macro drops; the executable witness still contains
      // every individual down input and Tetrp must validate its timing.
      for(const count of [1,4,8,16,24]){
        if(path.length+count>maxSteps)continue;
        let dropped=p,legal=true;
        for(let i=0;i<count;i++){
          dropped=step(board,dropped,'down',rules);
          if(!dropped){legal=false;break}
        }
        if(legal&&!seen.has(poseKey(dropped)))
          fifo.push({p:dropped,path:[...path,...Array(count).fill('down')]});
      }
    }
  }
  return [...results.values()];
}

// Cheap geometric fallback for future plies when the forward SRS+ budget is
// exhausted. A geometry-only proposal does NOT certify an executable path;
// after re-analysis every actual root placement requires an authority witness.
function forecastHardDrops(board,kind,rules){
  const start=spawn(kind,board);
  if(!B.legal(board,start))return [];
  const rotations=[start];
  for(let dir=1;dir<=3;dir++){
    if(dir===2&&!rules.allow180)continue;
    const p=R.rotate(board,start,dir,rules.lockresets);
    if(p)rotations.push({...p,rotated:true});
  }
  const output=new Map();
  for(const rotated of rotations){
    let left=rotated;
    while(B.legal(board,{...left,x:left.x-1}))left={...left,x:left.x-1};
    let pos=left;
    while(B.legal(board,pos)){
      const landed=land(board,pos);
      // Dropping vertically after a spawn rotation is not a T-Spin.
      landed.spin='none';landed.rotated=false;
      const key=fmtCells(landed)+'|none';
      if(!output.has(key))output.set(key,{piece:landed,path:[],spin:'none',softdrop:0});
      pos={...pos,x:pos.x+1};
    }
  }
  return [...output.values()];
}

// A future spin must be proved geometrically, not guessed from a cavity's
// appearance. The cheap local probe only decides *whether to run* an actual
// SRS+ reachability search. It never creates a fake scored spin placement.
function spinClearRows(board,piece){
  const positions=B.cells(piece).map(([x,y])=>[x,Math.ceil(y)]);
  const used=new Set(positions.map(([x,y])=>y*board.width+x));
  let cleared=0;
  for(const y of new Set(positions.map(([,y])=>y))){
    if(y<0||y>=board.rows.length)continue;
    const row=board.rows[y];
    if(row.every((cell,x)=>cell!==null&&cell!=='gbd'||used.has(y*board.width+x)))cleared++;
  }
  return cleared;
}

export function hasSpinClearGeometry(board,kind,rules){
  const eligible=spinTables.spinbonuses_rules[rules.spinbonuses]?.types;
  if(!eligible?.includes(kind))return false;
  const base=spawn(kind,board);
  // Start with rows that could be completed by one tetromino. Anchoring a
  // mino in each remaining cell avoids scanning every 40x10x4 pose.
  for(let rowY=Math.max(board.buffer-2,board.rows.length-18);rowY<board.rows.length;rowY++){
    const row=board.rows[rowY],empty=[];
    for(let x=0;x<board.width;x++)if(row[x]===null)empty.push(x);
    if(empty.length<1||empty.length>4||row.includes('gbd'))continue;
    for(let r=0;r<4;r++){
      const template=B.cells({...base,x:0,r});
      for(const targetX of empty){
        for(const [cx,cy] of template){
          const pose={...base,x:targetX-cx,y:base.y+rowY-Math.ceil(cy),r,
            rotated:true,spin:'none',kick:0};
          if(!B.legal(board,pose)||B.legal(board,{...pose,y:pose.y+1}))continue;
          if(R.classifySpin(board,pose,rules.spinbonuses)==='none')continue;
          if(spinClearRows(board,pose)>0)return true;
        }
      }
    }
  }
  return false;
}

export function forecastSpinClears(board,kind,rules,{maxStates=1400,maxSteps=42}={}){
  if(!hasSpinClearGeometry(board,kind,rules))return [];
  // A forecast receives only a known piece type, the hypothetical board made
  // from visible moves and public SRS+ rules. No hidden NEXT or RNG is read.
  const moves=enumerateReachable(board,spawn(kind,board),rules,{maxStates,maxSteps});
  return moves.filter(m=>m.spin!=='none'&&spinClearRows(board,m.piece)>0);
}

function surface(board){
  const H=board.rows.length,W=board.width,heights=[],holes=[],covered=[];
  let rough=0,transitions=0,filled=0,garbage=0;
  for(let x=0;x<W;x++){
    let top=H,voids=0,buried=0,seen=false;
    for(let y=0;y<H;y++){
      const cell=board.rows[y][x];
      if(cell!==null){if(!seen)top=y;seen=true;filled++;if(cell==='gb'||cell==='gbd')garbage++;}
      else if(seen){voids++;buried+=Math.min(8,H-y);}
    }
    heights.push(H-top);holes.push(voids);covered.push(buried);
  }
  for(let x=1;x<W;x++)rough+=Math.abs(heights[x]-heights[x-1]);
  // Local border transitions heavily penalize sealed roofs and uneven stacks.
  for(let y=0;y<H;y++){
    let last=1;
    for(let x=0;x<W;x++){
      const now=board.rows[y][x]===null?0:1;
      if(now!==last)transitions++;last=now;
    }
    if(last!==1)transitions++;
  }
  const max=Math.max(...heights),min=Math.min(...heights);
  const well=heights.reduce((best,h,x)=>{
    const left=x===0?H:heights[x-1],right=x===W-1?H:heights[x+1];
    return Math.max(best,Math.min(left,right)-h);
  },0);
  // Two distinct signals: an actually complete Tetris-ready four-high
  // well, and gradual progress toward that well while the stack is built.
  // Both use only the currently visible board, never the future bag.
  let tetrisReady=0;
  for(let x=0;x<W;x++){
    let streak=0;
    for(let y=H-1;y>=Math.max(0,H-10);y--){
      const row=board.rows[y];
      if(row[x]!==null||row.includes('gbd')||row.some((v,i)=>i!==x&&v===null))break;
      streak++;tetrisReady=Math.max(tetrisReady,Math.min(4,streak));
    }
  }
  let tetrisConstruction=0;
  for(let x=0;x<W;x++){
    let support=0;
    for(let y=H-1;y>=Math.max(0,H-7);y--){
      const row=board.rows[y];
      // An uncleareable line is never progress toward a four-line attack.
      if(row[x]!==null||row.includes('gbd'))break;
      let filled=0;
      for(let z=0;z<W;z++)if(z!==x&&row[z]!==null)filled++;
      if(filled<3)break;
      support+=Math.pow(filled/9,2);
    }
    tetrisConstruction=Math.max(tetrisConstruction,support);
  }
  let tspots=0;
  // Only reachable-ish empty cells near the surface; speculative T-slot
  // potential is a *small* feature, not a fake guaranteed T-spin.
  for(let y=Math.max(board.buffer,H-max-4);y<H;y++)for(let x=1;x<W-1;x++){
    if(board.rows[y][x]!==null)continue;
    const occupied=(xx,yy)=> yy>=H||xx<0||xx>=W||
      (yy>=0&&board.rows[yy][xx]!==null);
    const corners=Number(occupied(x-1,y-1))+Number(occupied(x+1,y-1))+
      Number(occupied(x-1,y+1))+Number(occupied(x+1,y+1));
    if(corners>=3&&heights[x]<=H-y+3)tspots++;
  }
  return {max,min,heights,holes:holes.reduce((a,b)=>a+b,0),
    covered:covered.reduce((a,b)=>a+b,0),rough,transitions,well,tetrisReady,tetrisConstruction,tspots,filled,garbage};
}

function evaluateBoard(board,ctx,details=null){
  const a=surface(board),danger=ctx.pending>0?1+Math.min(1.5,ctx.pending/9):1;
  // Optional out-parameter reuses the surface scan for experimental beam
  // ranking. In the default evaluator this allocates nothing extra.
  if(details){details.holes=a.holes;details.danger=danger;}
  const urgency=Math.max(0,a.max-(board.height+board.buffer-18));
  const recovery=ctx.recoveryActive
    ?recoveryBoardPenalty(a,{pending:ctx.pending,weight:ctx.recoveryWeight})
    :0;
  return -recovery-a.holes*8.6*danger-a.covered*.27*danger
    -a.max*1.05-a.rough*.42-a.transitions*.16
    -Math.max(0,a.max-12)*.35*danger-urgency*urgency*2.5*danger
    +Math.min(5,a.well)*.38 +Math.min(4,a.tspots)*.85
    +a.tetrisReady*a.tetrisReady*0.55
    +a.tetrisConstruction*4.2
    -a.garbage*.04
    +Math.min(10,ctx.btb)*.75 +Math.min(5,ctx.combo)*.43;
}

// Explainability path only; the hot-path evaluator above is unchanged.
// Independently reconstruct all board-score components for each finalist.
export function explainBoardEvaluation(board,ctx){
  const a=surface(board),danger=ctx.pending>0?1+Math.min(1.5,ctx.pending/9):1;
  const urgency=Math.max(0,a.max-(board.height+board.buffer-18));
  const recovery=ctx.recoveryActive
    ?recoveryBoardPenalty(a,{pending:ctx.pending,weight:ctx.recoveryWeight})
    :0;
  const terms={
    recovery:-recovery,
    holes:-a.holes*8.6*danger,
    covered:-a.covered*.27*danger,
    height:-a.max*1.05,
    roughness:-a.rough*.42,
    transitions:-a.transitions*.16,
    highStack:-Math.max(0,a.max-12)*.35*danger,
    urgency:-urgency*urgency*2.5*danger,
    well:Math.min(5,a.well)*.38,
    tSpots:Math.min(4,a.tspots)*.85,
    tetrisReady:a.tetrisReady*a.tetrisReady*.55,
    tetrisConstruction:a.tetrisConstruction*4.2,
    garbage:-a.garbage*.04,
    btb:Math.min(10,ctx.btb)*.75,
    combo:Math.min(5,ctx.combo)*.43,
  };
  const boardValue=evaluateBoard(board,ctx);
  const reconstructed=Object.values(terms).reduce((sum,v)=>sum+v,0);
  return {boardValue,reconstructed,reconstructionError:reconstructed-boardValue,
    features:{height:a.max,holes:a.holes,covered:a.covered,
      rough:a.rough,transitions:a.transitions,tSpots:a.tspots,
      tetrisReady:a.tetrisReady,tetrisConstruction:a.tetrisConstruction,
      garbage:a.garbage,btb:ctx.btb,combo:ctx.combo,
      pending:ctx.pending,danger},
    terms};
}

function applyPlacement(node,placement,rules){
  const board=copyBoard(node.board);
  if(!B.legal(board,placement.piece))return null;
  const toppedOut=B.commit(board,placement.piece);
  const full=B.fullLines(board);
  const garbageRows=full.filter(y=>board.rows[y].includes('gb')).length;
  // Only compute expensive pre-lock height when an actual garbage row clears.
  const beforeMax=node.recoveryActive&&garbageRows>0?surface(node.board).max:0;
  B.removeLines(board,full);
  const allClear=full.length>0&&B.emptyWithPerma(board);
  // Atomic Tetrp advances 24 battle frames before the lock.
  const lockFrame=node.frame+24;
  const atLock=advanceCombatClock(node.combat,node.frame,24,rules);
  const attack=projectCombat(atLock,
    {lines:full.length,spin:placement.spin,allClear,garbageRows},rules);
  // An ARE wait can activate a packet before the next public piece spawns.
  // Unknown garbage holes must never be guessed from hidden game state.
  const delay=full.length?rules.lineclear_are:rules.are;
  const atReady=advanceCombatClock(attack.combat,lockFrame,delay,rules);
  const tank=forecastPublicTank(
    rules.garbageentry==='delayed'?attack.combat:atReady,attack.blocked,rules);
  const readyFrame=lockFrame+(rules.garbageentry==='delayed'
    ?Math.max(delay,tank.amount*rules.garbageare):delay);
  // Tetrp only declares a lockout KO when nolockout is disabled and no
  // clutch clear saved it. Above-visible locks may still be legal in TL.
  const lockout=toppedOut&&!rules.nolockout&&(!full.length||!rules.clutch);
  const recoveryReward=node.recoveryActive
    ?clearedGarbageReward(garbageRows,{maxHeight:beforeMax,
      pending:node.pending,weight:node.recoveryWeight}):0;
  const reward=recoveryReward+attack.offensive*(node.offenseWeight??4.8)+attack.defensive*5.1+
    (placement.spin==='full'&&full.length?2.1:0)+
    (allClear?12:0)+(full.length&&attack.btb>0?1.0:0)-
    (lockout?100000:0)-placement.softdrop*.035;
  const combat=readyFrame===lockFrame+delay?atReady:
    advanceCombatClock(attack.combat,lockFrame,readyFrame-lockFrame,rules);
  return {board,...attack,combat,frame:readyFrame,
    unresolvedGarbage:tank.amount>0,forecastTank:tank.amount,
    reward,topout:lockout,lines:full.length,spin:placement.spin,allClear};
}
// A permanent garbage cell (gbd) prevents line clears. Collapsing it into
// ordinary occupancy silently transposes states with different physics.
export const rookBoardKey=(b)=>b.rows.map(row=>row.map(v=>
  v===null?'.':v==='gb'?'g':v==='gbd'?'d':'#').join('')).join('');
const boardKey=rookBoardKey;

// An unknown garbage hole forces conditional evaluation of potential boards.
// Since beam pruning may include an intermediate-only shaping bonus, both
// scores must move together when the expected value changes. Changing only
// evalScore caused beam selection to keep using a stale, pre-belief rank.
export function revalueBeliefCandidate(candidate,beliefValue){
  if(!Number.isFinite(beliefValue)||!Number.isFinite(candidate.evalScore))
    throw new TypeError('invalid belief revaluation');
  const shapeDelta=(candidate.beamScore??candidate.evalScore)-candidate.evalScore;
  candidate.evalScore=beliefValue;
  candidate.beamScore=beliefValue+shapeDelta;
  return candidate;
}

// Counterfactual NEXT decisions, conditional on observing each possible hole.
// Every hypothetical continuation is re-planned after that outcome is known,
// never selected by cherry-picking the one best hidden RNG result.
// Prototype: conditionally re-plan to the SAME final ply as an ordinary
// beam leaf. Every enumerated public-hole outcome uses its own legal SRS+
// continuation. No private hole column or unseen bag piece is sampled.
function conditionalGarbageHorizon(state,rules,firstPly,horizon,{
  maxStates,maxSteps,maxNodes,beamWidth,onEvaluate
}){
  let beam=[state],evaluated=0,budgetHit=false;
  for(let ply=firstPly;ply<horizon;ply++){
    const candidates=[];
    for(const node of beam){
      if(!node.queue.length)
        throw new RangeError('public NEXT exhausted before horizon');
      // In TL an already blocked spawn is KO before Hold can rescue it.
      if(!B.legal(node.board,spawn(node.queue[0],node.board)))continue;
      const options=[{type:node.queue[0],hold:node.hold,
        rest:node.queue.slice(1)}];
      if(!node.holdLocked&&rules.hold){
        const empty=node.hold===null,chosen=empty?node.queue[1]:node.hold;
        if(chosen)options.push({type:chosen,hold:node.queue[0],
          rest:node.queue.slice(empty?2:1)});
      }
      for(const option of options){
        const moves=enumerateReachable(node.board,spawn(option.type,node.board),
          rules,{maxStates,maxSteps});
        for(const move of moves){
          if(evaluated>=maxNodes){budgetHit=true;break;}
          evaluated++;onEvaluate();
          const p=applyPlacement(node,move,rules);
          if(!p||p.topout)continue;
          // A second hidden hole needs another probability tree. Abort the
          // ranking change rather than valuing a fabricated future board.
          if(p.unresolvedGarbage)
            throw new RangeError('another unresolved public garbage event');
          const next={...node,board:p.board,queue:option.rest,hold:option.hold,
            holdLocked:false,combat:p.combat,pending:p.pending,combo:p.combo,
            btb:p.btb,frame:p.frame,unresolvedGarbage:false,forecastTank:0,
            score:node.score+p.reward*Math.pow(.94,ply)};
          next.evalScore=next.score+
            evaluateBoard(next.board,next)*Math.pow(.88,ply+1);
          candidates.push(next);
        }
        if(budgetHit)break;
      }
      if(budgetHit)break;
    }
    // A partially explored final ply is NOT a fair common-horizon value.
    if(budgetHit)
      throw new RangeError('conditional horizon node budget exhausted');
    if(!candidates.length){
      return -100000;
    }
    candidates.sort((a,b)=>b.evalScore-a.evalScore);
    const distinct=new Set();
    beam=[];
    for(const candidate of candidates){
      const key=boardKey(candidate.board)+'|'+candidate.queue.join('')+
        '|'+candidate.hold+'|'+JSON.stringify(candidate.combat);
      if(distinct.has(key))continue;
      distinct.add(key);beam.push(candidate);
      if(beam.length>=beamWidth)break;
    }
  }
  return beam[0].evalScore;
}

function beliefContinuationValue(node,rules,ply,{maxOutcomes,riskWeight,maxStates,maxSteps,
  commonHorizon=false,horizon=ply+2,horizonNodes=140,horizonBeam=3,
  onConditionalEvaluate=()=>{}}){
  let conditionalEvaluated=0;
  const belief=evaluatePublicTankBelief(node.board,node.combat,rules,{
    maxOutcomes,riskWeight,score:outcome=>{
      const pending=[...outcome.combat.pending,...outcome.combat.are]
        .reduce((total,p)=>total+p.amt,0);
      const state={...node,board:outcome.board,combat:outcome.combat,
        pending,unresolvedGarbage:false,forecastTank:0};
      const terminal=()=>node.score+
        evaluateBoard(state.board,state)*Math.pow(.88,ply+1);
      if(commonHorizon){
        if(ply+1>=horizon)return terminal();
        return conditionalGarbageHorizon(state,rules,ply+1,horizon,{
          maxStates,maxSteps,maxNodes:horizonNodes,beamWidth:horizonBeam,
          onEvaluate:()=>{conditionalEvaluated++;onConditionalEvaluate();}
        });
      }
      if(!node.queue.length)return terminal();
      // Canonical Engine.spawn checks blockout before a new Hold is allowed.
      // A fortunate held piece cannot revive an already blocked spawn.
      if(!B.legal(state.board,spawn(node.queue[0],state.board)))
        return -100000;
      const options=[node.queue[0]];
      if(!node.holdLocked&&rules.hold){
        const chosen=node.hold===null?node.queue[1]:node.hold;
        if(chosen)options.push(chosen);
      }
      let best=-Infinity;
      for(const kind of new Set(options)){
        const reached=enumerateReachable(state.board,spawn(kind,state.board),
          rules,{maxStates,maxSteps});
        for(const move of reached){
          const p=applyPlacement(state,move,rules);
          if(!p||p.topout)continue;
          const next={...state,board:p.board,combat:p.combat,
            pending:p.pending,combo:p.combo,btb:p.btb,frame:p.frame};
          const value=node.score+p.reward*Math.pow(.94,ply+1)+
            evaluateBoard(next.board,next)*Math.pow(.88,ply+2)-
            (p.unresolvedGarbage?p.forecastTank*7:0);
          if(value>best)best=value;
        }
      }
      // All reachable placements failed; this conditional future is KO.
      return Number.isFinite(best)?best:-100000;
    }
  });
  return {...belief,conditionalEvaluated};
}

export function chooseMove(visible,{depth=4,beamWidth=24,maxNodes=8000,
  maxStates=1200,maxSteps=42,includeRanked=false,includeForecastPlan=false,spinForecast=true,spinForecastPly=2,spinForecastStates=1400,spinForecastProbes=8,
  futureReachable=true,futureReachablePly=5,futureReachableProbes=9,futureReachableStates=800,
  futureProofSpread='legacy',
  traceRootSurvival=false,traceRootScores=false,beamRootReserve=null,offenseWeight=4.8,
  intermediateHoleRelief=0,includeHoldPlan=false,
  tsdTacticalProbes=0,tsdTacticalStates=2200,reversePlanner=false,reverseMaxCandidates=250,reverseMaxGoals=80,reverseMaxPlans=2,reverseReserve=2,
  reverseLongMaxCandidates=600,reverseLongMaxGoals=15,reverseLongBeamWidth=10,
  reverseOpenMaxGoals=8,reverseOpenMaxTileNodes=1200,reverseOpenMaxProofs=12,
  reverseOnlyOpen=false,reversePressureGuard=true,
  garbageRecovery=false,garbageRecoveryWeight=1,
  garbageBelief=false,beliefProbes=3,beliefMaxOutcomes=10,
  beliefRiskWeight=.2,beliefReachableStates=300,
  beliefCommonHorizon=false,beliefHorizonNodes=140,beliefHorizonBeam=3,
  exactLeafExtension=false,leafExtensionBudget=5000,leafExtensionStates=800}={}){
  if(!visible?.playing||!visible?.current||!visible?.board||!visible.rules)
    throw Error('ROOK requires Tetrp player-visible snapshot');
  // Enforce the product's information boundary even for direct API callers.
  // Re-project only fields a human player can see; never use extras from a
  // checkpoint, replay, RNG stream, opponent, or future bag tail.
  const safe={
    board:visible.board,current:visible.current,hold:visible.hold,
    frame:visible.frame,
    next:Array.isArray(visible.next)?visible.next.slice(0,5):null,
    rules:visible.rules,playing:visible.playing,
    attack:visible.attack?{
      combo:visible.attack.combo,btb:visible.attack.btb,
      multiplier:visible.attack.multiplier,
      cumulativeSent:visible.attack.cumulativeSent,
      pending:visible.attack.pending,are:visible.attack.are,
    }:null,
    piecesPlaced:visible.piecesPlaced,
  };
  if(!Array.isArray(visible.next)||visible.next.length!==5)
    throw Error('ROOK requires exactly five publicly visible NEXT pieces');
  visible=safe;
  const queue=[visible.current.type,...visible.next];
  if(!queue.length||queue.some(p=>!PIECES.has(p)))throw Error('invalid visible bag');
  if(!Number.isInteger(depth)||depth<1||depth>5||!Number.isInteger(beamWidth)||beamWidth<1||
    !Number.isInteger(maxNodes)||maxNodes<1||!Number.isInteger(futureReachablePly)||
    futureReachablePly<0||futureReachablePly>5||!Number.isInteger(futureReachableProbes)||
    futureReachableProbes<0||futureReachableProbes>100||
    !['legacy','balanced','root-diverse'].includes(futureProofSpread)||
    !Number.isInteger(futureReachableStates)||futureReachableStates<1||
    !Number.isInteger(tsdTacticalProbes)||tsdTacticalProbes<0||
    !Number.isInteger(beliefProbes)||beliefProbes<0||beliefProbes>20||
    !Number.isInteger(beliefMaxOutcomes)||beliefMaxOutcomes<1||beliefMaxOutcomes>100||
    !Number.isFinite(beliefRiskWeight)||beliefRiskWeight<0||beliefRiskWeight>1||
    !Number.isInteger(beliefReachableStates)||beliefReachableStates<1||
    typeof beliefCommonHorizon!=='boolean'||
    typeof exactLeafExtension!=='boolean'||
    !Number.isInteger(leafExtensionBudget)||leafExtensionBudget<1||leafExtensionBudget>100000||
    !Number.isInteger(leafExtensionStates)||leafExtensionStates<1||leafExtensionStates>10000||
    !Number.isInteger(beliefHorizonNodes)||beliefHorizonNodes<1||beliefHorizonNodes>5000||
    !Number.isInteger(beliefHorizonBeam)||beliefHorizonBeam<1||beliefHorizonBeam>24||
    (beamRootReserve!==null&&(!Number.isInteger(beamRootReserve)||
      beamRootReserve<1||beamRootReserve>beamWidth))||
    !Number.isFinite(offenseWeight)||offenseWeight<0||offenseWeight>24||
    !Number.isFinite(intermediateHoleRelief)||
    intermediateHoleRelief<0||intermediateHoleRelief>1)
    throw Error('invalid search budget');
  const pending=[...(visible.attack?.are??[]),...(visible.attack?.pending??[])]
    .reduce((n,p)=>n+(p.amt??0),0);
  if(!Number.isFinite(garbageRecoveryWeight)||garbageRecoveryWeight<0||
    garbageRecoveryWeight>4)throw Error('Invalid garbage recovery weight');
  // Risk-only experimental mode. Do not perturb clean openers, and never
  // infer future opponent garbage or hidden hole columns.
  const recoveryActive=garbageRecovery&&
    (pending>0||visible.board.rows.some(row=>
      row.some(cell=>cell==='gb'||cell==='gbd')));
  const initial={board:visible.board,queue,hold:visible.hold?.piece??null,
    holdLocked:!!visible.hold?.locked,combo:visible.attack?.combo??0,
    btb:visible.attack?.btb??0,multiplier:visible.attack?.multiplier??1,
    pending,combat:visibleCombat(visible),frame:visible.frame,
    unresolvedGarbage:false,forecastTank:0,score:0,rootAction:null,
    recoveryActive,recoveryWeight:garbageRecoveryWeight,
    offenseWeight};
  // M1 inverse attack goal portfolio: only verified SRS+ continuations.
  // This experimental module stays opt-in until APP and KO improve.
  // Optional tactical CPU is tracked separately from the ordinary beam budget.
  const firstT=queue.indexOf('t');
  // The public packet activation clock can invalidate a speculative
  // no-clear setup BEFORE its final TSD. Do not pretend the board remains
  // untouched while real Tetrp would already be tanking garbage.
  const spinDeadline=Number.isFinite(visible.frame)?
    visible.frame+Math.max(0,firstT)*24:null;
  const reverseThreat=firstT>0?(visible.attack?.pending??[]).reduce((sum,p)=>
    sum+(p.amt>0&&(p.active===true||
      (spinDeadline!==null&&Number.isFinite(p.activeFrame)&&
       p.activeFrame<=spinDeadline))?p.amt:0),0):0;
  const reverseSkippedPressure=reversePlanner&&reversePressureGuard&&reverseThreat>0;
  const reverseEligible=reversePlanner&&!reverseSkippedPressure&&depth>=2&&
    firstT>=1&&firstT<=5&&Number.isInteger(reverseMaxCandidates)&&
    reverseMaxCandidates>0;
  // Exact-cover openers are for non-garbage low stacks. Keep the existing
  // inverse Full TSS/TSD/TST experts on garbage and overhang puzzles, and
  // fall back to them when the opener finds no legal TSD continuation.
  const nonGarbage=visible.board.rows.every(row=>
    row.every(c=>c!=='gb'&&c!=='gbd'));
  const lowStack=visible.board.rows.reduce((n,row)=>n+
    row.filter(c=>c!==null).length,0)<=20;
  const openerReport=reverseEligible&&nonGarbage&&lowStack
    ?searchOpenTSD(visible,{maxGoals:reverseOpenMaxGoals,
      maxTileNodes:reverseOpenMaxTileNodes,maxProofs:reverseOpenMaxProofs,
      maxStates:Math.max(1800,maxStates),maxPlans:reverseMaxPlans})
    :null;
  const emptyReverse={plans:[],stats:{goals:0,setupCandidates:0,
    forwardProofs:0,budgetExceeded:false}};
  const reverseReport=!reverseEligible?emptyReverse
    :openerReport?.plans.length?openerReport
    :reverseOnlyOpen?(openerReport??emptyReverse)
    :firstT<=2?searchReverseAttacks(visible,{
      targets:['TSS','TSD','TST'],maxGoals:reverseMaxGoals,
      maxCandidates:Math.min(maxNodes,reverseMaxCandidates),
      maxStates:Math.min(1600,maxStates),maxSteps:Math.max(maxSteps,70),
      maxPlans:reverseMaxPlans
    })
    :searchLongReverseAttacks(visible,{
      goalTypes:['TSS','TSD'],maxGoals:reverseLongMaxGoals,
      maxCandidates:Math.min(maxNodes-1,reverseLongMaxCandidates),
      maxStates:Math.min(1400,maxStates),maxSteps:Math.max(maxSteps,70),
      beamWidth:reverseLongBeamWidth,maxPlans:reverseMaxPlans
    });
  // Tactical BFS proposals are not equivalent in cost to a regular
  // candidate evaluation. Preserve all ordinary beam nodes to avoid
  // degrading good baseline moves when an optional goal search finds
  // nothing. Record extra tactical work and real elapsed time separately:
  // this is an equal BASE search budget, not equal total CPU.
  const reverseBudget=maxNodes;
  const tacticalPrefixes=new Map();
  for(const plan of reverseReport.plans){
    if(plan.actions[0]?.kind!=='place'||!plan.witnesses?.length)continue;
    let node=initial;
    for(let ply=0;ply<plan.witnesses.length;ply++){
      const p=applyPlacement(node,plan.witnesses[ply],visible.rules);
      if(!p||p.topout)break;
      const next={board:p.board,queue:initial.queue.slice(ply+1),
        hold:initial.hold,holdLocked:false,combo:p.combo,btb:p.btb,
        multiplier:p.combat.multiplier,pending:p.pending,combat:p.combat,
        frame:p.frame,unresolvedGarbage:p.unresolvedGarbage,forecastTank:p.forecastTank,
        score:node.score+p.reward*Math.pow(.94,ply),
        rootAction:plan.actions[0],tacticalGoal:plan.goal.kind,
        ...(traceRootScores?{forecastLocks:[...(node.forecastLocks??[]),{
          piece:plan.witnesses[ply].piece.type,lines:p.lines,spin:p.spin,
          proof:plan.witnesses[ply].path?.at(-1)==='hardDrop'?'srs':'geometry',
          generated:p.generated,sent:p.offensive,cancelled:p.defensive,
          btb:p.btb,combo:p.combo}]}:{}),
        recoveryActive:node.recoveryActive,recoveryWeight:node.recoveryWeight};
      next.evalScore=next.score+evaluateBoard(next.board,next)*Math.pow(.88,ply+1);
      if(!tacticalPrefixes.has(ply))tacticalPrefixes.set(ply,[]);
      tacticalPrefixes.get(ply).push(next);
      node=next;
      if(next.unresolvedGarbage)break;
    }
  }
  let beam=[initial],evaluated=0,cache=new Map(),best=null;
  const rootChoices=new Map();
  let evaluatedFast=0,spinProbes=0,forecastedSpinClears=0;
  let futureProbes=0,futureMoves=0,futureSpinClears=0;
  let unresolvedTankNodes=0;
  const rootSurvival=[];
  let beliefAttempts=0,beliefEvaluations=0,beliefOutcomes=0,beliefOverBudget=0;
  let beliefHorizonEvaluated=0,beliefHorizonAborted=0;
  const beliefHorizonAbortReasons={budget:0,secondGarbage:0,publicNext:0};
  const futureReachableByPly=Array(depth+1).fill(0);
  const futureProofNodeIndices=Array.from({length:depth+1},()=>[]);
  const tsdCandidates=[];let tsdProbes=0,tsdProven=0;
  // Known T may be the fifth NEXT piece; six placements are publicly
  // visible but only an actual proven tactical continuation expands ply six.
  const completedTactic=Math.max(0,...reverseReport.plans.map(p=>p.witnesses.length));
  const clamp=Math.min(queue.length,Math.max(depth,completedTactic));
  for(let ply=0;ply<clamp;ply++){
    const candidates=[],transposed=new Map();
    // Divide the bounded full-action probes across the public future plies.
    // Default compatibility: ceil spends all 9 on the first 3 future plies
    // when depth=5; balanced reserves real SRS+ proof for final public ply.
    // This is diagnostic/opt-in. Neither option sees hidden NEXT6 or bag.
    const proofPlies=Math.max(1,Math.min(clamp-1,futureReachablePly));
    const baseProofCap=Math.floor(futureReachableProbes/proofPlies);
    const extraProofs=futureReachableProbes%proofPlies;
    const plyProofCap=futureProofSpread==='balanced'
      ?baseProofCap+Number(ply-1>=proofPlies-extraProofs)
      :Math.ceil(futureReachableProbes/Math.max(1,clamp-1));
    // Same SRS proof budget, different root coverage. Search order should not
    // concentrate every future-spin witness on the first few beam roots.
    const probeNodeIndices=new Set();
    if(futureProofSpread==='root-diverse'&&ply>0&&plyProofCap>0){
      const distinctRoots=new Map();
      for(let i=0;i<beam.length;i++){
        const root=JSON.stringify(beam[i].rootAction);
        if(!distinctRoots.has(root))distinctRoots.set(root,i);
      }
      const rootSlots=[...distinctRoots.values()];
      for(let i=0;i<Math.min(plyProofCap,rootSlots.length);i++){
        const index=Math.floor(i*rootSlots.length/
          Math.min(plyProofCap,rootSlots.length));
        probeNodeIndices.add(rootSlots[index]);
      }
    }
    const proofUsedNodes=new Set();
    for(let nodeIndex=0;nodeIndex<beam.length;nodeIndex++){
      const node=beam[nodeIndex];
      if(node.unresolvedGarbage){
        // Stop at the first hidden-hole insertion; no phantom future board.
        candidates.push(node);
        continue;
      }
      if(!node.queue.length||evaluated>=reverseBudget)break;
      const options=[{type:node.queue[0],hold:false,holdValue:node.hold,
        rest:node.queue.slice(1),piece:ply===0?visible.current:spawn(node.queue[0],node.board)}];
      if(!node.holdLocked&&visible.rules.hold){
        const empty=node.hold===null;
        const chosen=empty?node.queue[1]:node.hold;
        if(chosen)options.push({type:chosen,hold:true,holdValue:node.queue[0],
          rest:node.queue.slice(empty?2:1),piece:spawn(chosen,node.board)});
      }
      for(const option of options){
        const key=boardKey(node.board)+'|'+option.type+'|'+(ply===0?poseKey(option.piece):'spawn');
        let moves=cache.get(key);
        if(!moves){
          if(ply===0){
            moves=enumerateReachable(node.board,option.piece,visible.rules,{maxStates,maxSteps});
          }else{
            // Look for actual SRS+ tucks, kicks, Spin and non-Spin landings
            // at *every* visible future ply. Keep geometry-only Hard Drops
            // when bounded reachability misses an ordinary fallback.
            const fast=forecastHardDrops(node.board,option.type,visible.rules);
            const prove=futureReachable&&ply<=futureReachablePly&&
              futureProbes<futureReachableProbes&&
              futureReachableByPly[ply]<plyProofCap&&
              (futureProofSpread!=='root-diverse'||
                (probeNodeIndices.has(nodeIndex)&&!proofUsedNodes.has(nodeIndex)));
            if(prove){
              futureProbes++;futureReachableByPly[ply]++;
              if(futureProofSpread==='root-diverse'){
                proofUsedNodes.add(nodeIndex);
                futureProofNodeIndices[ply].push(nodeIndex);
              }
              const reached=enumerateReachable(node.board,option.piece,visible.rules,
                {maxStates:futureReachableStates,maxSteps});
              futureMoves+=reached.length;
              futureSpinClears+=reached.filter(m=>
                m.spin!=='none'&&spinClearRows(node.board,m.piece)>0).length;
              const known=new Set(reached.map(m=>fmtCells(m.piece)+'|'+m.spin));
              moves=[...reached,...fast.filter(m=>
                !known.has(fmtCells(m.piece)+'|'+m.spin))];
            }else{
              moves=fast;
              if(spinForecast&&ply<=spinForecastPly&&spinProbes<spinForecastProbes&&
                 hasSpinClearGeometry(node.board,option.type,visible.rules)){
                spinProbes++;
                const spins=forecastSpinClears(node.board,option.type,visible.rules,
                  {maxStates:spinForecastStates,maxSteps});
                forecastedSpinClears+=spins.length;
                const known=new Set(moves.map(m=>fmtCells(m.piece)+'|'+m.spin));
                moves=[...moves,...spins.filter(m=>
                  !known.has(fmtCells(m.piece)+'|'+m.spin))];
              }
              evaluatedFast+=moves.length;
            }
          }
          cache.set(key,moves);
        }
        for(const move of moves){
          // Do not increment the accounting counter for an unevaluated
          // candidate when the configured bound is already exhausted.
          if(evaluated>=reverseBudget)break;
          evaluated++;
          const p=applyPlacement(node,move,visible.rules);
          if(!p||p.topout)continue;
          if(p.unresolvedGarbage)unresolvedTankNodes++;
          const planned={kind:'place',move:{piece:move.piece.type,x:move.piece.x,
              y:Math.ceil(move.piece.y),rotation:move.piece.r,useHold:false,
              cells:B.cells(move.piece).map(([x,y])=>[x,Math.ceil(y)])},
              execution:{moves:move.path,spin:move.spin}};
          const rootAction=node.rootAction??(option.hold?{kind:'hold',mode:node.hold===null?'empty':'occupied',samePiece:option.type===node.queue[0],requiresReanalysis:true}:
            {kind:'place',move:{piece:move.piece.type,x:move.piece.x,
              y:Math.ceil(move.piece.y),rotation:move.piece.r,useHold:false,
              cells:B.cells(move.piece).map(([x,y])=>[x,Math.ceil(y)])},
              execution:{moves:move.path,spin:move.spin}});
          const next={
            board:p.board,queue:option.rest,hold:option.holdValue,holdLocked:false,
            combo:p.combo,btb:p.btb,multiplier:p.combat.multiplier,
            pending:p.pending,combat:p.combat,frame:p.frame,
            unresolvedGarbage:p.unresolvedGarbage,forecastTank:p.forecastTank,
            score:node.score+p.reward*Math.pow(.94,ply),rootAction,
            rootHoldPlan:node.rootHoldPlan??(ply===0&&option.hold?planned:null),
            ...(includeForecastPlan?{forecastPlan:[...(node.forecastPlan??[]),{
              preBoardKey:boardKey(node.board),preCurrent:node.queue[0],
              preHold:node.hold,prePending:node.pending,
              preBtb:node.btb,preCombo:node.combo,
              useHold:option.hold,piece:move.piece.type,
              spin:move.spin,
              cells:B.cells(move.piece).map(([x,y])=>[x,Math.ceil(y)])
            }]}:{}),
            ...(traceRootScores?{
              forecastLocks:[...(node.forecastLocks??[]),{
                piece:move.piece.type,lines:p.lines,spin:p.spin,
                proof:move.path?.at(-1)==='hardDrop'?'srs':'geometry',
                generated:p.generated,sent:p.offensive,cancelled:p.defensive,
                btb:p.btb,combo:p.combo}],
              rootPly:ply+1,
              rootFirst:node.rootFirst??(ply===0?{
                reward:p.reward,sent:p.offensive,cancelled:p.defensive,
                generated:p.generated,lines:p.lines,spin:p.spin,
                allClear:p.allClear,forecastTank:p.forecastTank,
                valueAtPlyOne:null,
              }:null),
            }:{}),
            tacticalGoal:node.tacticalGoal??null,
            recoveryActive:node.recoveryActive,
            recoveryWeight:node.recoveryWeight,
            offenseWeight:node.offenseWeight
          };
          const discount=Math.pow(.88,ply+1);
          const holeDetails=(intermediateHoleRelief>0&&ply+1<clamp)?{}:null;
          const evalScore=next.score+
            evaluateBoard(next.board,next,holeDetails)*discount;
          // Relax temporary holes ONLY when deciding which intermediate
          // trajectories survive the beam. The final leaf always uses the
          // original uncompromised value function and all original rules.
          const holeShaping=holeDetails
            ?intermediateHoleRelief*holeDetails.holes*8.6*
              holeDetails.danger*discount
            :0;
          const beamScore=evalScore+holeShaping;
          if(ply===0&&tsdTacticalProbes>0&&rootAction.kind==='place'&&
             (option.rest[0]==='t'||option.holdValue==='t')){
            const patterns=tsdScaffolds(p.board,visible.rules,{maxMissing:0});
            if(patterns.some(t=>t.fullSpinGeometry))tsdCandidates.push({node:next,score:evalScore});
          }
          if(ply===0){
            const key=JSON.stringify(rootAction);
            const oldRoot=rootChoices.get(key);
            if(!oldRoot||evalScore>oldRoot.value)rootChoices.set(key,{action:rootAction,value:evalScore});
          }
          const hash=boardKey(next.board)+'|'+next.hold+'|'+next.queue.join('')+
            '|'+next.frame+'|'+next.unresolvedGarbage+'|'+JSON.stringify(next.combat);
          const old=transposed.get(hash);
          if(!old||beamScore>(old.beamScore??old.evalScore))
            transposed.set(hash,{...next,evalScore,beamScore});
        }
        if(evaluated>=reverseBudget)break;
      }
    }
    // Inject fully forward-proven tactical prefixes at their exact ply.
    // No T-slot shape earns attack until a reachable Full Spin clears rows.
    const forced=tacticalPrefixes.get(ply)??[];
    for(const node of forced){
      const hash=boardKey(node.board)+'|'+node.hold+'|'+node.queue.join('')+
        '|'+node.frame+'|'+node.unresolvedGarbage+'|'+JSON.stringify(node.combat);
      const old=transposed.get(hash);
      if(!old||(node.beamScore??node.evalScore)>
        (old.beamScore??old.evalScore))transposed.set(hash,node);
      if(ply===0){
        const key=JSON.stringify(node.rootAction);
        const oldRoot=rootChoices.get(key);
        if(!oldRoot||node.evalScore>oldRoot.value)
          rootChoices.set(key,{action:node.rootAction,value:node.evalScore});
      }
    }
    candidates.push(...transposed.values());
    if(!candidates.length)break;
    candidates.sort((a,b)=>(b.beamScore??b.evalScore)-
      (a.beamScore??a.evalScore));
    if(garbageBelief&&beliefAttempts<beliefProbes){
      // Re-rank root-diverse uncertain candidates under a shared public
      // hole distribution. Exact enumeration, not a lucky-hole sample.
      const probedRoots=new Set();
      for(const candidate of candidates){
        if(beliefAttempts>=beliefProbes)break;
        if(!candidate.unresolvedGarbage)continue;
        const root=JSON.stringify(candidate.rootAction);
        if(probedRoots.has(root))continue;
        probedRoots.add(root);
        beliefAttempts++;
        try{
          const belief=beliefContinuationValue(candidate,visible.rules,ply,{
            maxOutcomes:beliefMaxOutcomes,riskWeight:beliefRiskWeight,
            maxStates:beliefReachableStates,maxSteps,
            commonHorizon:beliefCommonHorizon,horizon:clamp,
            horizonNodes:beliefHorizonNodes,horizonBeam:beliefHorizonBeam,
            onConditionalEvaluate:()=>{beliefHorizonEvaluated++;}});
          beliefEvaluations++;beliefOutcomes+=belief.outcomes;
          // Accounted continuously, including abandoned conditional trees.
          revalueBeliefCandidate(candidate,belief.value);
          candidate.belief={expected:belief.expected,worst:belief.worst,
            topoutProbability:belief.topoutProbability,
            outcomes:belief.outcomes};
          if(ply===0)rootChoices.set(root,{action:candidate.rootAction,
            value:candidate.evalScore});
        }catch(error){
          if(!(error instanceof RangeError))throw error;
          if(/scenario limit/.test(error.message)){beliefOverBudget++;continue;}
          if(beliefCommonHorizon&&
            /public NEXT exhausted|another unresolved public garbage|conditional horizon node budget/.test(error.message)){
            beliefHorizonAborted++;
            const reason=/node budget/.test(error.message)?'budget':
              /another unresolved/.test(error.message)?'secondGarbage':'publicNext';
            beliefHorizonAbortReasons[reason]++;
            continue; // keep original rank if continuation is not comparable
          }
          throw error;
        }
      }
      candidates.sort((a,b)=>(b.beamScore??b.evalScore)-
      (a.beamScore??a.evalScore));
    }
    // Retain several different first moves across depths, rather than
    // allowing one locally smooth but strategically sterile root to consume
    // every beam slot.
    const grouped=new Map();
    for(const candidate of candidates){
      const key=JSON.stringify(candidate.rootAction);
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push(candidate);
    }
    const roots=[...grouped.values()];
    beam=[];
    if(beamRootReserve===null){
      // Legacy: fair round-robin over every first move. Keep this baseline
      // byte-for-byte unless the alternative policy is explicitly requested.
      for(let round=0;beam.length<beamWidth;round++){
        let appended=0;
        for(const group of roots){
          if(group[round]){beam.push(group[round]);appended++;}
          if(beam.length>=beamWidth)break;
        }
        if(!appended)break;
      }
    }else{
      // Reserve only N distinct promising first actions; spend the remaining
      // beam width on globally best continuations (even the same first move).
      // All candidates have identical evaluation semantics at this ply.
      const guaranteed=roots.slice(0,beamRootReserve).map(group=>group[0]);
      const selected=new Set(guaranteed);
      beam.push(...guaranteed);
      for(const candidate of candidates){
        if(beam.length>=beamWidth)break;
        if(selected.has(candidate))continue;
        beam.push(candidate);
      }
    }
    if(ply===0&&tsdCandidates.length&&tsdTacticalProbes>0){
      // Keep a few tactical roots whose exact next move is a PROVEN TSD.
      // A generic surface beam often prunes the setup before its payoff.
      tsdCandidates.sort((a,b)=>b.score-a.score);
      const checked=new Set();
      for(const candidate of tsdCandidates){
        if(tsdProbes>=tsdTacticalProbes)break;
        const key=JSON.stringify(candidate.node.rootAction);
        if(checked.has(key))continue;
        checked.add(key);tsdProbes++;
        const plan=forecastSpinClears(candidate.node.board,'t',visible.rules,
          {maxStates:tsdTacticalStates,maxSteps:Math.max(maxSteps,70)})
          .find(move=>{
            if(move.spin!=='full')return false;
            const board=copyBoard(candidate.node.board);
            B.commit(board,move.piece);
            return B.fullLines(board).length===2;
          });
        if(!plan)continue;
        tsdProven++;
        // Include the proven continuation in the next-ply search. Merely
        // preserving the setup root would not help if the faster generic
        // Hard Drop forecast ignores the actual T-Spin.
        const futureKey=boardKey(candidate.node.board)+'|t|spawn';
        const otherMoves=cache.get(futureKey)??forecastHardDrops(candidate.node.board,'t',visible.rules);
        cache.set(futureKey,[...otherMoves,plan]);
        const rootExists=beam.some(item=>JSON.stringify(item.rootAction)===key);
        if(!rootExists){
          if(beam.length>=beamWidth)beam.pop();
          beam.push(candidate.node);
        }
      }
    }
    // Preserve a small independent tactical portfolio through temporary
    // ugly setup boards. Ordinary survival/downstack owns other beam slots.
    const reserve=Math.min(Math.max(0,reverseReserve),Math.max(0,beamWidth-1));
    let reserved=0;
    for(const tactical of forced){
      if(reserved>=reserve)break;
      const already=beam.some(node=>boardKey(node.board)===boardKey(tactical.board)&&
        node.queue.join('')===tactical.queue.join('')&&
        node.tacticalGoal===tactical.tacticalGoal);
      if(already)continue;
      if(beam.length>=beamWidth)beam.pop();
      beam.push(tactical);reserved++;
    }
    beam.sort((a,b)=>(b.beamScore??b.evalScore)-
      (a.beamScore??a.evalScore));
    if(traceRootSurvival)
      rootSurvival.push({ply:ply+1,roots:[...new Set(beam.map(n=>
        JSON.stringify(n.rootAction)))]});
    best=beam[0];
  }
  // Opt-in tactical quiescence: the fifth lock is already inside publicly
  // visible NEXT5. Re-evaluate EVERY surviving final leaf using a genuine
  // SRS+ witness, including a legal Hold branch. This is a different policy,
  // not a substitute for the original beam or a hidden bag lookahead.
  let leafExtensionEvaluated=0,leafExtensionWitnesses=0;
  let leafExtensionApplied=false,leafExtensionAbort=null,leafExtensionChangesRoot=false;
  const defaultBest=best;
  if(exactLeafExtension){
    if(clamp!==4)leafExtensionAbort='depth-not-four';
    else{
      let work=0,aborted=false;
      const extensions=[];
      outer:for(const node of beam){
        if(node.unresolvedGarbage){leafExtensionAbort='unknown-hole';break;}
        if(!node.queue.length){leafExtensionAbort='public-next-exhausted';break;}
        // Block-out is tested at spawn before Hold, as in the real Engine.
        if(!B.legal(node.board,spawn(node.queue[0],node.board))){
          extensions.push({node,value:-100000,witnesses:0});continue;
        }
        const options=[{piece:node.queue[0]}];
        if(!node.holdLocked&&visible.rules.hold){
          const chosen=node.hold===null?node.queue[1]:node.hold;
          if(chosen)options.push({piece:chosen});
        }
        let bestScore=-100000,found=0;
        for(const choice of options){
          const moves=enumerateReachable(node.board,spawn(choice.piece,node.board),
            visible.rules,{maxStates:leafExtensionStates,maxSteps});
          for(const move of moves){
            if(work>=leafExtensionBudget){
              aborted=true;leafExtensionAbort='budget-exhausted';break outer;
            }
            work++;leafExtensionEvaluated++;
            const projected=applyPlacement(node,move,visible.rules);
            if(!projected||projected.topout)continue;
            if(projected.unresolvedGarbage){
              aborted=true;leafExtensionAbort='unknown-hole';break outer;
            }
            found++;leafExtensionWitnesses++;
            const state={...node,board:projected.board,combat:projected.combat,
              pending:projected.pending,btb:projected.btb,combo:projected.combo,
              frame:projected.frame};
            const score=node.score+projected.reward*Math.pow(.94,clamp)+
              evaluateBoard(projected.board,state)*Math.pow(.88,clamp+1);
            if(score>bestScore)bestScore=score;
          }
        }
        extensions.push({node,value:bestScore,witnesses:found});
      }
      // If any root is partially expanded, DON'T compare unfair horizons.
      if(!aborted&&!leafExtensionAbort&&extensions.length===beam.length){
        leafExtensionApplied=true;
        for(const x of extensions)x.node.leafExtendedScore=x.value;
        beam.sort((a,b)=>b.leafExtendedScore-a.leafExtendedScore);
        best=beam[0];
        leafExtensionChangesRoot=JSON.stringify(best.rootAction)!==
          JSON.stringify(defaultBest.rootAction);
      }
    }
  }
  if(!best)throw Error('ROOK found no legal placement');
  const result={...best.rootAction,diagnostics:{evaluated,depth,beamWidth,
    value:Number(best.evalScore.toFixed(3)),pending,evaluatedFast,spinProbes,
    ...(exactLeafExtension?{exactLeafExtension,leafExtensionEvaluated,
      leafExtensionWitnesses,leafExtensionApplied,leafExtensionAbort,
      leafExtensionChangesRoot,leafExtensionBudget,leafExtensionStates,
      leafExtendedValue:leafExtensionApplied?Number(best.leafExtendedScore.toFixed(3)):null}:{}),
    forecastedSpinClears,futureProbes,futureMoves,futureSpinClears,
    futureReachableByPly,unresolvedTankNodes,
    beliefAttempts,beliefEvaluations,beliefOutcomes,beliefOverBudget,
    ...(beliefCommonHorizon?{beliefCommonHorizon,beliefHorizonEvaluated,
      beliefHorizonAborted,beliefHorizonAbortReasons,
      beliefHorizonNodes,beliefHorizonBeam}:{}),
    selectedBelief:best.belief??null,
    selectedUnresolvedGarbage:best.unresolvedGarbage,
    selectedForecastTank:best.forecastTank,selectedFrame:best.frame,
    tsdProbes,tsdProven,
    reverseGoals:reverseReport.stats.goals,
    reversePlans:reverseReport.plans.length,
    reverseCandidates:reverseReport.stats.setupCandidates??reverseReport.stats.tileNodes??0,
    reverseTilings:reverseReport.stats.tilings??0,
    reverseProbes:reverseReport.stats.forwardProofs,
    reverseSelectedGoal:best.tacticalGoal??null,reverseBudget,
    reverseBudgetExceeded:reverseReport.stats.budgetExceeded,
    reverseSkippedPressure,reverseThreat,
    recoveryActive,recoveryWeight:garbageRecoveryWeight,
    effectiveDepth:clamp,beamRootReserve,offenseWeight,intermediateHoleRelief,
    futureProofSpread,
    ...(futureProofSpread==='root-diverse'?{futureProofNodeIndices}:{}),
    reason:'root-diverse beam + forward-proofed inverse attack portfolio'}};
  if(includeForecastPlan)result.forecastPlan=best.forecastPlan??[];
  if(includeHoldPlan&&result.kind==='hold')
    result.holdPlan=best.rootHoldPlan??null;
  if(traceRootScores){
    const byRoot=new Map();
    for(const node of beam){
      const key=JSON.stringify(node.rootAction);
      const prior=byRoot.get(key);
      if(prior&&(leafExtensionApplied
        ?prior.leaf.exactExtendedScore>=node.leafExtendedScore
        :prior.leaf.total>=node.evalScore))continue;
      const board=explainBoardEvaluation(node.board,node);
      const discount=Math.pow(.88,node.rootPly??clamp);
      byRoot.set(key,{action:node.rootAction,
        rootScore:rootChoices.get(key)?.value??null,
        first:node.rootFirst??null,
        leaf:{total:node.evalScore,cumulativeReward:node.score,
          boardDiscount:discount,
          discountedBoardValue:board.boardValue*discount,
          valueReconstructionError:node.evalScore-
            (node.score+board.boardValue*discount),
          ply:node.rootPly??clamp,board,
          ...(leafExtensionApplied?{exactExtendedScore:node.leafExtendedScore}:{}),
           // Diagnostic-only prediction of the selected beam continuation.
           // The bot may replan after every real lock; this is NOT guaranteed
           // future output and contains only publicly visible piece types.
           forecastLocks:node.forecastLocks??[]}});
    }
    result.rootScores=[...byRoot.values()].sort((a,b)=>leafExtensionApplied
      ?(b.leaf.exactExtendedScore??-Infinity)-(a.leaf.exactExtendedScore??-Infinity)
      :b.leaf.total-a.leaf.total);
  }
  if(traceRootSurvival)result.rootSurvival=rootSurvival;
  if(includeRanked){
    const bestKey=JSON.stringify(best.rootAction);
    const alternatives=[...rootChoices.entries()]
      .filter(([key])=>key!==bestKey).map(([,candidate])=>candidate)
      .sort((a,b)=>b.value-a.value||JSON.stringify(a.action).localeCompare(JSON.stringify(b.action)));
    result.ranked=[best.rootAction,...alternatives.map(x=>x.action)];
  }
  return result;
}
