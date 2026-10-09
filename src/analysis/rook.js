// ROOK: independent Tetrp search engine. No Cold Clear / Kiwi evaluator or DAG.
// Tetrp owns SRS+, spin classification, board physics and canonical match rules.
import * as B from '../board.js';
import * as R from '../rotation.js';
import {visibleCombat,projectCombat} from './rook-combat.js';
import spinTables from '../data/spins.json' with { type: 'json' };
import {tsdScaffolds} from './rook-tsd.js';
import {searchReverseAttacks} from './rook-reverse-planner.js';
import {searchLongReverseAttacks} from './rook-long-planner.js';
import {searchOpenTSD} from './rook-open-slot.js';

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

// Future known pieces are used for board evaluation, not forwarded as inputs.
// Reserve the expensive Tetrp-legal SRS+ reachability BFS for the real root.
// Later plies use exact *non-spin* hard-drop geometry, so their speculative
// moves can never silently become executable without fresh root verification.
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
      if(row[x]!==null||row.some((v,i)=>i!==x&&v===null))break;
      streak++;tetrisReady=Math.max(tetrisReady,Math.min(4,streak));
    }
  }
  let tetrisConstruction=0;
  for(let x=0;x<W;x++){
    let support=0;
    for(let y=H-1;y>=Math.max(0,H-7);y--){
      const row=board.rows[y];
      if(row[x]!==null)break;
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

function evaluateBoard(board,ctx){
  const a=surface(board),danger=ctx.pending>0?1+Math.min(1.5,ctx.pending/9):1;
  const urgency=Math.max(0,a.max-(board.height+board.buffer-18));
  return -a.holes*8.6*danger-a.covered*.27*danger
    -a.max*1.05-a.rough*.42-a.transitions*.16
    -Math.max(0,a.max-12)*.35*danger-urgency*urgency*2.5*danger
    +Math.min(5,a.well)*.38 +Math.min(4,a.tspots)*.85
    +a.tetrisReady*a.tetrisReady*0.55
    +a.tetrisConstruction*4.2
    -a.garbage*.04
    +Math.min(10,ctx.btb)*.75 +Math.min(5,ctx.combo)*.43;
}

function applyPlacement(node,placement,rules){
  const board=copyBoard(node.board);
  if(!B.legal(board,placement.piece))return null;
  const toppedOut=B.commit(board,placement.piece);
  const full=B.fullLines(board);
  const garbageRows=full.filter(y=>board.rows[y].includes('gb')).length;
  B.removeLines(board,full);
  const allClear=full.length>0&&B.emptyWithPerma(board);
  const attack=projectCombat(node.combat,
    {lines:full.length,spin:placement.spin,allClear,garbageRows},rules);
  // Tetrp only declares a lockout KO when nolockout is disabled and no
  // clutch clear saved it. Above-visible locks may still be legal in TL.
  const lockout=toppedOut&&!rules.nolockout&&(!full.length||!rules.clutch);
  const reward=attack.offensive*4.8+attack.defensive*5.1+
    (placement.spin==='full'&&full.length?2.1:0)+
    (allClear?12:0)+(full.length&&attack.btb>0?1.0:0)-
    (lockout?100000:0)-placement.softdrop*.035;
  return {board,...attack,reward,topout:lockout,lines:full.length,
    spin:placement.spin,allClear};
}
const boardKey=(b)=>b.rows.map(row=>row.map(v=>v===null?'.':v==='gb'?'g':'#').join('')).join('');

export function chooseMove(visible,{depth=4,beamWidth=24,maxNodes=8000,
  maxStates=1200,maxSteps=42,includeRanked=false,spinForecast=true,spinForecastPly=2,spinForecastStates=1400,spinForecastProbes=8,tsdTacticalProbes=12,tsdTacticalStates=2200,reversePlanner=false,reverseMaxCandidates=250,reverseMaxGoals=80,reverseMaxPlans=2,reverseReserve=2,
  reverseLongMaxCandidates=600,reverseLongMaxGoals=15,reverseLongBeamWidth=10,
  reverseOpenMaxGoals=8,reverseOpenMaxTileNodes=1200,reverseOpenMaxProofs=12,
  reverseOnlyOpen=false,reversePressureGuard=true}={}){
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
    !Number.isInteger(maxNodes)||maxNodes<1)throw Error('invalid search budget');
  const pending=[...(visible.attack?.are??[]),...(visible.attack?.pending??[])]
    .reduce((n,p)=>n+(p.amt??0),0);
  const initial={board:visible.board,queue,hold:visible.hold?.piece??null,
    holdLocked:!!visible.hold?.locked,combo:visible.attack?.combo??0,
    btb:visible.attack?.btb??0,multiplier:visible.attack?.multiplier??1,
    pending,combat:visibleCombat(visible),score:0,rootAction:null};
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
        score:node.score+p.reward*Math.pow(.94,ply),
        rootAction:plan.actions[0],tacticalGoal:plan.goal.kind};
      next.evalScore=next.score+evaluateBoard(next.board,next)*Math.pow(.88,ply+1);
      if(!tacticalPrefixes.has(ply))tacticalPrefixes.set(ply,[]);
      tacticalPrefixes.get(ply).push(next);
      node=next;
    }
  }
  let beam=[initial],evaluated=0,cache=new Map(),best=null;
  const rootChoices=new Map();
  let evaluatedFast=0,spinProbes=0,forecastedSpinClears=0;
  const tsdCandidates=[];let tsdProbes=0,tsdProven=0;
  // Known T may be the fifth NEXT piece; six placements are publicly
  // visible but only an actual proven tactical continuation expands ply six.
  const completedTactic=Math.max(0,...reverseReport.plans.map(p=>p.witnesses.length));
  const clamp=Math.min(queue.length,Math.max(depth,completedTactic));
  for(let ply=0;ply<clamp;ply++){
    const candidates=[],transposed=new Map();
    for(const node of beam){
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
            moves=forecastHardDrops(node.board,option.type,visible.rules);
            if(spinForecast&&ply<=spinForecastPly&&spinProbes<spinForecastProbes&&
               hasSpinClearGeometry(node.board,option.type,visible.rules)){
              spinProbes++;
              const spins=forecastSpinClears(node.board,option.type,visible.rules,
                {maxStates:spinForecastStates,maxSteps});
              forecastedSpinClears+=spins.length;
              // Forecast spin paths are SRS+-reachable but not accepted as
              // root actions. The next real piece is always revalidated by
              // the Tetrp atomic legal-placement authority.
              moves.push(...spins);
            }
            evaluatedFast+=moves.length;
          }
          cache.set(key,moves);
        }
        for(const move of moves){
          if(evaluated++>=reverseBudget)break;
          const p=applyPlacement(node,move,visible.rules);
          if(!p||p.topout)continue;
          const rootAction=node.rootAction??(option.hold?{kind:'hold',mode:node.hold===null?'empty':'occupied',samePiece:option.type===node.queue[0],requiresReanalysis:true}:
            {kind:'place',move:{piece:move.piece.type,x:move.piece.x,
              y:Math.ceil(move.piece.y),rotation:move.piece.r,useHold:false,
              cells:B.cells(move.piece).map(([x,y])=>[x,Math.ceil(y)])},
              execution:{moves:move.path,spin:move.spin}});
          const next={
            board:p.board,queue:option.rest,hold:option.holdValue,holdLocked:false,
            combo:p.combo,btb:p.btb,multiplier:node.multiplier,pending:p.pending,combat:p.combat,
            score:node.score+p.reward*Math.pow(.94,ply),rootAction,
            tacticalGoal:node.tacticalGoal??null
          };
          const evalScore=next.score+evaluateBoard(next.board,next)*Math.pow(.88,ply+1);
          if(ply===0&&rootAction.kind==='place'&&
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
            '|'+JSON.stringify(next.combat);
          const old=transposed.get(hash);
          if(!old||evalScore>old.evalScore)
            transposed.set(hash,{...next,evalScore});
        }
        if(evaluated>=reverseBudget)break;
      }
    }
    // Inject fully forward-proven tactical prefixes at their exact ply.
    // No T-slot shape earns attack until a reachable Full Spin clears rows.
    const forced=tacticalPrefixes.get(ply)??[];
    for(const node of forced){
      const hash=boardKey(node.board)+'|'+node.hold+'|'+node.queue.join('')+
        '|'+JSON.stringify(node.combat);
      const old=transposed.get(hash);
      if(!old||node.evalScore>old.evalScore)transposed.set(hash,node);
      if(ply===0){
        const key=JSON.stringify(node.rootAction);
        const oldRoot=rootChoices.get(key);
        if(!oldRoot||node.evalScore>oldRoot.value)
          rootChoices.set(key,{action:node.rootAction,value:node.evalScore});
      }
    }
    candidates.push(...transposed.values());
    if(!candidates.length)break;
    candidates.sort((a,b)=>b.evalScore-a.evalScore);
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
    for(let round=0;beam.length<beamWidth;round++){
      let appended=0;
      for(const group of roots){
        if(group[round]){beam.push(group[round]);appended++;}
        if(beam.length>=beamWidth)break;
      }
      if(!appended)break;
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
    beam.sort((a,b)=>b.evalScore-a.evalScore);
    best=beam[0];
  }
  if(!best)throw Error('ROOK found no legal placement');
  const result={...best.rootAction,diagnostics:{evaluated,depth,beamWidth,
    value:Number(best.evalScore.toFixed(3)),pending,evaluatedFast,spinProbes,
    forecastedSpinClears,tsdProbes,tsdProven,
    reverseGoals:reverseReport.stats.goals,
    reversePlans:reverseReport.plans.length,
    reverseCandidates:reverseReport.stats.setupCandidates??reverseReport.stats.tileNodes??0,
    reverseTilings:reverseReport.stats.tilings??0,
    reverseProbes:reverseReport.stats.forwardProofs,
    reverseSelectedGoal:best.tacticalGoal??null,reverseBudget,
    reverseBudgetExceeded:reverseReport.stats.budgetExceeded,
    reverseSkippedPressure,reverseThreat,
    effectiveDepth:clamp,
    reason:'root-diverse beam + forward-proofed inverse attack portfolio'}};
  if(includeRanked){
    const bestKey=JSON.stringify(best.rootAction);
    const alternatives=[...rootChoices.entries()]
      .filter(([key])=>key!==bestKey).map(([,candidate])=>candidate)
      .sort((a,b)=>b.value-a.value||JSON.stringify(a.action).localeCompare(JSON.stringify(b.action)));
    result.ranked=[best.rootAction,...alternatives.map(x=>x.action)];
  }
  return result;
}
