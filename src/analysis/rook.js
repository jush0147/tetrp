// ROOK: independent Tetrp search engine. No Cold Clear / Kiwi evaluator or DAG.
// Tetrp owns SRS+, spin classification, board physics and canonical match rules.
import * as B from '../board.js';
import * as R from '../rotation.js';
import {baseAttack} from '../attack.js';

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

export function enumerateReachable(board,piece,rules,{maxStates=900,maxSteps=19}={}){
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
      if(act==='down'&&path.filter(a=>a==='down').length>=8)continue;
      const next=step(board,p,act,rules);
      if(next&&!seen.has(poseKey(next)))fifo.push({p:next,path:[...path,act]});
    }
  }
  return [...results.values()];
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
    covered:covered.reduce((a,b)=>a+b,0),rough,transitions,well,tspots,filled,garbage};
}

function predictAttack(state,lines,spin,allClear,garbageRows,rules){
  const chain=lines>=4||(lines>0&&spin!=='none')||(allClear&&rules.allclear_b2b);
  const oldBtb=state.btb;
  let btb=oldBtb,surge=0;
  if(chain)btb++;
  else if(lines){
    if(rules.b2bcharging&&oldBtb>rules.b2bcharge_at)
      surge=Math.floor((oldBtb-rules.b2bcharge_at+rules.b2bcharge_base)*state.multiplier);
    btb=0;
  }
  const combo=lines?state.combo+1:0;
  let raw=baseAttack(lines,spin);
  if(lines>0&&btb>1&&!(allClear&&rules.allclear_b2b)){
    if(rules.b2bchaining){
      const log=Math.log1p((btb-1)*.8);
      raw+=Math.floor(1+log)+(btb===2?0:(1+log%1)/3);
    }else raw++;
  }
  if(combo>1)raw=Math.max(raw*(1+.25*(combo-1)),
    combo>2?Math.log1p(1.25*(combo-1)):0);
  let attack=Math.floor(raw*state.multiplier);
  if(rules.garbagespecialbonus&&garbageRows>0&&(lines===4||spin!=='none'))attack++;
  if(rules.garbageattackcap>0)attack=Math.min(attack,rules.garbageattackcap);
  attack+=surge;
  if(allClear&&rules.allclears)attack+=Math.floor(rules.allclear_garbage*state.multiplier);
  const defensive=rules.garbageblocking==='none'?0:Math.min(attack,state.pending);
  return {btb,combo,attack,defensive,offensive:attack-defensive,
    pending:Math.max(0,state.pending-attack),surge};
}
function evaluateBoard(board,ctx){
  const a=surface(board),danger=ctx.pending>0?1+Math.min(1.5,ctx.pending/9):1;
  const urgency=Math.max(0,a.max-(board.height+board.buffer-18));
  return -a.holes*8.6*danger-a.covered*.27*danger
    -a.max*1.05-a.rough*.42-a.transitions*.16
    -Math.max(0,a.max-12)*.35*danger-urgency*urgency*2.5*danger
    +Math.min(5,a.well)*.45 +Math.min(4,a.tspots)*.85
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
  const attack=predictAttack(node,full.length,placement.spin,allClear,garbageRows,rules);
  const reward=attack.offensive*4.8+attack.defensive*5.1+
    (placement.spin==='full'&&full.length?2.1:0)+
    (allClear?12:0)+(full.length&&attack.btb>0?1.0:0)-
    (toppedOut?100000:0)-placement.softdrop*.035;
  return {board,...attack,reward,topout:toppedOut,lines:full.length,
    spin:placement.spin,allClear};
}
const boardKey=(b)=>b.rows.map(row=>row.map(v=>v===null?'.':v==='gb'?'g':'#').join('')).join('');

export function chooseMove(visible,{depth=3,beamWidth=12,maxNodes=8000,
  maxStates=900,maxSteps=19}={}){
  if(!visible?.playing||!visible?.current||!visible?.board||!visible.rules)
    throw Error('ROOK requires Tetrp player-visible snapshot');
  // Enforce the product's information boundary even for direct API callers.
  // Re-project only fields a human player can see; never use extras from a
  // checkpoint, replay, RNG stream, opponent, or future bag tail.
  const safe={
    board:visible.board,current:visible.current,hold:visible.hold,
    next:Array.isArray(visible.next)?visible.next.slice(0,5):null,
    rules:visible.rules,playing:visible.playing,
    attack:visible.attack?{
      combo:visible.attack.combo,btb:visible.attack.btb,
      multiplier:visible.attack.multiplier,
      pending:visible.attack.pending,are:visible.attack.are,
    }:null,
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
    pending,score:0,rootAction:null};
  let beam=[initial],evaluated=0,cache=new Map(),best=null;
  const clamp=Math.min(depth,queue.length);
  for(let ply=0;ply<clamp;ply++){
    const candidates=[],transposed=new Map();
    for(const node of beam){
      if(!node.queue.length||evaluated>=maxNodes)break;
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
          moves=enumerateReachable(node.board,option.piece,visible.rules,{maxStates,maxSteps});
          cache.set(key,moves);
        }
        for(const move of moves){
          if(evaluated++>=maxNodes)break;
          const p=applyPlacement(node,move,visible.rules);
          if(!p||p.topout)continue;
          const rootAction=node.rootAction??(option.hold?{kind:'hold',mode:node.hold===null?'empty':'occupied'}:
            {kind:'place',move:{piece:move.piece.type,x:move.piece.x,
              y:Math.ceil(move.piece.y),rotation:move.piece.r,useHold:false,
              cells:B.cells(move.piece).map(([x,y])=>[x,Math.ceil(y)])},
              execution:{moves:move.path,spin:move.spin}});
          const next={
            board:p.board,queue:option.rest,hold:option.holdValue,holdLocked:false,
            combo:p.combo,btb:p.btb,multiplier:node.multiplier,pending:p.pending,
            score:node.score+p.reward*Math.pow(.94,ply),rootAction
          };
          const evalScore=next.score+evaluateBoard(next.board,next)*Math.pow(.88,ply+1);
          const hash=boardKey(next.board)+'|'+next.hold+'|'+next.queue.join('')+
            '|'+next.combo+'|'+next.btb+'|'+next.pending;
          const old=transposed.get(hash);
          if(!old||evalScore>old.evalScore)
            transposed.set(hash,{...next,evalScore});
        }
        if(evaluated>=maxNodes)break;
      }
    }
    candidates.push(...transposed.values());
    if(!candidates.length)break;
    candidates.sort((a,b)=>b.evalScore-a.evalScore);
    beam=candidates.slice(0,beamWidth);
    best=beam[0];
  }
  if(!best)throw Error('ROOK found no legal placement');
  return {...best.rootAction,diagnostics:{evaluated,depth,beamWidth,
    value:Number(best.evalScore.toFixed(3)),pending,reason:'stateless Tetrp-native beam search'}};
}
