// Experimental inverse attack-goal planner: preimages first, SRS+ proof last.
// The only inputs are a public Tetrp snapshot and explicit search limits.
// This M1 prototype handles Full TSS/TSD/TST with 0-2 non-T setup pieces.
import * as B from '../board.js';
import * as R from '../rotation.js';
import spins from '../data/spins.json' with {type:'json'};
import {enumerateReachable} from './rook.js';
import {visibleCombat,projectCombat} from './rook-combat.js';

const copy=b=>({...b,rows:b.rows.map(row=>row.slice())});
const key=(x,y)=>x+','+y;
const spawn=(type,board)=>({type,x:Math.ceil(board.width/2)-1,
  y:board.buffer-2.04,hy:board.buffer-2,r:0,kick:0,rotated:false,
  spin:'none',wall:false,sleeping:false,locking:0,resets:0,
  rotationResets:0,totalRotations:0,safelock:0,keys:0,
  softDropped:false,forceLock:false});
const cells=p=>B.cells(p).map(([x,y])=>[x,Math.ceil(y)]);
const uniq=xs=>[...new Set(xs)];
function subsets(xs,count){
  if(count===0)return [[]];
  if(xs.length<count)return [];
  return xs.flatMap((x,i)=>subsets(xs.slice(i+1),count-1).map(tail=>[x,...tail]));
}
function rowSupport(board,pose,rows){
  const target=new Set(cells(pose).map(([x,y])=>key(x,y)));
  const missing=[];
  for(const y of rows)for(let x=0;x<board.width;x++){
    if(board.rows[y][x]==='gbd')return null;
    if(!target.has(key(x,y))&&board.rows[y][x]===null)missing.push(key(x,y));
  }
  return missing;
}
function cornerObligations(board,pose){
  const data=spins.cornerTable.t[pose.r];
  const options=data.map(([dx,dy,...f])=>({x:pose.x+dx,y:Math.ceil(pose.y+dy),front:f.includes(pose.r)}));
  const target=new Set(cells(pose).map(([x,y])=>key(x,y)));
  const occupied=options.filter(c=>B.occupied(board,c.x,c.y));
  const optional=options.filter(c=>!B.occupied(board,c.x,c.y)&&!target.has(key(c.x,c.y)));
  const completions=[];
  for(let size=0;size<=optional.length;size++)for(const add of subsets(optional,size)){
    const all=[...occupied,...add];
    if(all.length>=3&&all.filter(c=>c.front).length===2)
      completions.push(add.map(c=>key(c.x,c.y)));
  }
  completions.sort((a,b)=>a.length-b.length);
  return {options:optional.map(c=>key(c.x,c.y)),completions};
}

export function reverseAttackGoals(board,rules,{targets=['TSS','TSD','TST'],
  maxMissing=8,maxGoals=160,scanRows=14}={}){
  if(!spins.spinbonuses_rules[rules.spinbonuses]?.types?.includes('t'))return [];
  const W=board.width,H=board.rows.length,out=[];
  for(let anchor=Math.max(2,board.buffer-1,H-scanRows);anchor<H;anchor++){
    for(let r=0;r<4;r++)for(let x=0;x<W;x++){
      const pose={type:'t',x,y:anchor-.04,r,kick:0,rotated:true,spin:'none'};
      if(!B.legal(board,pose))continue;
      const touched=uniq(cells(pose).map(([,y])=>y)).filter(y=>y>=0&&y<H);
      const corners=cornerObligations(board,pose);
      if(!corners.completions.length)continue;
      for(const lines of [1,2,3]){
        const kind=lines===1?'TSS':lines===2?'TSD':'TST';
        if(!targets.includes(kind))continue;
        for(const rows of subsets(touched,lines)){
          const requiredRows=rowSupport(board,pose,rows);
          if(!requiredRows)continue;
          const completion=corners.completions[0];
          const minMissing=uniq([...requiredRows,...completion]).length;
          if(minMissing>maxMissing)continue;
          out.push({kind,lines,x,y:anchor,rotation:r,rows,
            requiredRows,cornerOptions:corners.options,
            minMissing,blockedCells:cells(pose).map(([x,y])=>key(x,y))});
        }
      }
    }
  }
  out.sort((a,b)=>a.minMissing-b.minMissing||b.lines-a.lines||
    b.y-a.y||a.x-b.x||a.rotation-b.rotation);
  return out.slice(0,maxGoals);
}

function supportHit(goal,move){
  const desired=new Set([...goal.requiredRows,...goal.cornerOptions]);
  const blocks=new Set(goal.blockedCells);
  let hits=0;
  for(const [x,y] of cells(move.piece)){
    const k=key(x,y);
    if(blocks.has(k))return -1;
    if(desired.has(k))hits++;
  }
  return hits;
}
function legalSetup(board,move){
  const next=copy(board);
  if(!B.legal(next,move.piece))return null;
  B.commit(next,move.piece);
  // M1 deliberately excludes intermediate row shifts; a later milestone
  // handles backward row reindexing for combo/garbage downstack plans.
  if(B.fullLines(next).length)return null;
  return next;
}
function completedRows(board,goal){
  const pose={type:'t',x:goal.x,y:goal.y-.04,r:goal.rotation};
  if(!B.legal(board,pose))return false;
  const target=new Set(cells(pose).map(([x,y])=>key(x,y)));
  return goal.rows.every(y=>board.rows[y].every((v,x)=>v!==null||target.has(key(x,y))));
}
const choice=m=>({kind:'place',move:{piece:m.piece.type,x:m.piece.x,
  y:Math.ceil(m.piece.y),rotation:m.piece.r,useHold:false,
  cells:cells(m.piece)},execution:{moves:m.path,spin:m.spin}});

export function searchReverseAttacks(visible,{targets=['TSS','TSD','TST'],
  maxGoals=160,maxStates=1400,maxSteps=70,maxCandidates=4500,
  maxPlans=4,maxMissing=8}={}){
  if(!visible?.playing||!visible?.board||!visible.current||!visible.rules||
    !Array.isArray(visible.next)||visible.next.length!==5)
    throw Error('Reverse planner requires exactly player-visible current and NEXT5');
  const known=[visible.current.type,...visible.next];
  const pre=known[0]==='t'?0:known[1]==='t'?1:known[2]==='t'?2:-1;
  const stats={goals:0,setupCandidates:0,forwardProofs:0,budgetExceeded:false};
  if(pre<0)return {plans:[],stats,scope:'Full T spin, at most two known non-T setup pieces'};
  const rules=visible.rules,board=visible.board;
  const goals=reverseAttackGoals(board,rules,{targets,maxGoals,maxMissing:pre*4});
  stats.goals=goals.length;
  const roots=pre===0?[]:enumerateReachable(board,visible.current,rules,{maxStates,maxSteps});
  const solutions=[];
  const seen=new Set();
  const first=pre===0?[{piece:null,path:null,spin:'none'}]:roots;
  const combat=visibleCombat({piecesPlaced:visible.piecesPlaced,attack:visible.attack});
  for(const goal of goals){
    if(solutions.length>=maxPlans||stats.budgetExceeded)break;
    for(const root of first){
      if(solutions.length>=maxPlans||stats.budgetExceeded)break;
      if(pre>0&&supportHit(goal,root)<=0)continue;
      const board1=pre>0?legalSetup(board,root):board;
      if(!board1)continue;
      const second=pre===2?enumerateReachable(board1,spawn(known[1],board1),rules,
        {maxStates,maxSteps}):[{piece:null,path:null,spin:'none'}];
      for(const mid of second){
        if(++stats.setupCandidates>maxCandidates){stats.budgetExceeded=true;break;}
        if(pre===2&&supportHit(goal,mid)<=0)continue;
        const finish=pre===2?legalSetup(board1,mid):board1;
        if(!finish||!completedRows(finish,goal))continue;
        // A geometry preimage is only a hint. The final spin earns its
        // classification through an actual Tetrp SRS+ forward witness.
        stats.forwardProofs++;
        const tMoves=enumerateReachable(finish,
          pre===0?visible.current:spawn('t',finish),rules,
          {maxStates:Math.max(maxStates,2400),maxSteps});
        const full=tMoves.find(t=>{
          if(t.spin!=='full'||t.piece.x!==goal.x||
            Math.ceil(t.piece.y)!==goal.y||t.piece.r!==goal.rotation)return false;
          const b=copy(finish);B.commit(b,t.piece);
          return B.fullLines(b).length===goal.lines;
        });
        if(!full)continue;
        const steps=(pre===0?[]:pre===1?[root]:[root,mid]).concat(full);
        const signature=steps.map(s=>cells(s.piece).map(([x,y])=>key(x,y)).sort().join(';')+'/'+s.spin).join('|');
        if(seen.has(signature))continue;
        seen.add(signature);
        let projected=combat;
        for(let i=0;i<pre;i++)projected=projectCombat(projected,
          {lines:0,spin:'none',allClear:false,garbageRows:0},rules).combat;
        const ending=copy(finish);
        B.commit(ending,full.piece);
        const cleared=B.fullLines(ending);
        const garbageRows=cleared.filter(y=>ending.rows[y].includes('gb')).length;
        B.removeLines(ending,cleared);
        const allClear=cleared.length>0&&B.emptyWithPerma(ending);
        const attack=projectCombat(projected,
          {lines:cleared.length,spin:'full',allClear,garbageRows},rules);
        solutions.push({goal:{kind:goal.kind,lines:goal.lines,x:goal.x,
          y:goal.y,rotation:goal.rotation,requiredRows:goal.requiredRows,
          minMissing:goal.minMissing},
          actions:steps.map(choice),
          evidence:{reachable:true,actualAuthorityExecuted:false,
            spin:'full',lines:cleared.length,attack:attack.generated,
            sent:attack.offensive,btb:attack.btb,allClear},
          planLength:steps.length});
        if(solutions.length>=maxPlans)break;
      }
    }
  }
  solutions.sort((a,b)=>b.evidence.sent-a.evidence.sent||
    b.evidence.attack-a.evidence.attack||a.planLength-b.planLength);
  return {plans:solutions,stats,scope:'Full TSS/TSD/TST, no Hold/ARE row shifts or unknown pieces'};
}
