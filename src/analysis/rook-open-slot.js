// Experimental public-information, inverse exact-cover Full TSD opening.
// Never credit a Spin until its SRS+ route is forward-proven on the actual
// hypothetical board. Only the current piece and five visible previews exist.
import * as B from '../board.js';
import * as R from '../rotation.js';
import {enumerateReachable} from './rook.js';
import {reverseAttackGoals} from './rook-reverse-planner.js';
import {visibleCombat,projectCombat} from './rook-combat.js';

const key=(x,y)=>x+','+y;
const cells=p=>B.cells(p).map(([x,y])=>[x,Math.ceil(y)]);
const signature=p=>cells(p).map(([x,y])=>key(x,y)).sort().join('|');
const copy=b=>({...b,rows:b.rows.map(row=>row.slice())});
const spawn=(type,b)=>({type,x:Math.ceil(b.width/2)-1,y:b.buffer-2.04,
  hy:b.buffer-2,r:0,kick:0,rotated:false,spin:'none',wall:false,
  sleeping:false,locking:0,resets:0,rotationResets:0,totalRotations:0,
  safelock:0,keys:0,softDropped:false,forceLock:false});
const action=m=>({kind:'place',move:{piece:m.piece.type,x:m.piece.x,
  y:Math.ceil(m.piece.y),rotation:m.piece.r,useHold:false,
  cells:cells(m.piece)},execution:{moves:m.path,spin:m.spin}});

// Quickly prove the ordinary SRS+ spawn rotation + shift + hard-drop route.
// If a setup needs a down-tuck or a kick at depth, fall back to full BFS.
// Never infer reachability merely from a target footprint.
function quickSetup(board,start,target,rules){
  if(!B.legal(board,start))return null;
  const queue=[{p:start,path:[]}],seen=new Set();
  for(let i=0;i<queue.length&&seen.size<110;i++){
    const {p,path}=queue[i],state=[p.x,Math.ceil(p.y),p.r].join(':');
    if(seen.has(state))continue;
    seen.add(state);
    let landing={...p};
    while(B.legal(board,{...landing,y:landing.y+1}))landing.y++;
    if(signature(landing)===target)return {piece:landing,
      path:[...path,'hardDrop'],spin:landing.spin??'none',softdrop:0};
    if(path.length>=12)continue;
    for(const [act,dx] of [['moveLeft',-1],['moveRight',1]]){
      const q={...p,x:p.x+dx,rotated:false,spin:'none',kick:0};
      if(B.legal(board,q))queue.push({p:q,path:[...path,act]});
    }
    for(const [act,dir] of [['rotateCW',1],['rotateCCW',3],['rotate180',2]]){
      if(dir===2&&!rules.allow180)continue;
      const q=R.rotate(board,p,dir,rules.lockresets);
      if(q){q.rotated=true;q.spin=R.classifySpin(board,q,rules.spinbonuses);
        queue.push({p:q,path:[...path,act]});}
    }
  }
  return null;
}

export function searchOpenTSD(visible,{maxGoals=8,maxTilings=2500,
  maxTileNodes=1200,maxProofs=12,maxStates=1800,
  maxSteps=90,maxPlans=2}={}){
  if(!visible?.playing||!visible.board||!visible.current||!visible.rules||
    !Array.isArray(visible.next)||visible.next.length!==5)
    throw Error('Open slot planner requires player-visible current and NEXT5');
  const stats={goals:0,tiles:0,tileNodes:0,tilings:0,forwardProofs:0,
    cheapRejected:0,quickSetupProofs:0,slowSetupProofs:0,
    reachableFinishes:0,exhausted:false,budgetExceeded:false};
  const known=[visible.current.type,...visible.next];
  const pre=known.indexOf('t');
  const occupiedCount=visible.board.rows.reduce((n,row)=>n+
    row.filter(c=>c!==null).length,0);
  // Available only for a low stack with a *publicly known* T inside NEXT5.
  // Do not invent a future T, draw across an uncommitted Hold, or peek RNG.
  if(pre<1||pre>5||occupiedCount>20)
    return {plans:[],stats,scope:'low-stack public pre-T setup'};
  const W=visible.board.width,H=visible.board.rows.length;
  const goals=reverseAttackGoals(visible.board,visible.rules,{
    targets:['TSD'],maxMissing:Math.min(20,pre*4),
    maxGoals:4000,scanRows:5});
  goals.sort((a,b)=>
    Number(b.y===H-2&&b.rotation===2)-Number(a.y===H-2&&a.rotation===2)||
    a.minMissing-b.minMissing||
    Math.abs(a.x-W/2)-Math.abs(b.x-W/2));
  const picked=[],seenGoals=new Set();
  for(const g of goals){
    const id=[g.x,g.y,g.rotation,g.rows.join(',')].join(':');
    if(seenGoals.has(id))continue;
    seenGoals.add(id);picked.push(g);
    if(picked.length>=maxGoals)break;
  }
  stats.goals=picked.length;
  const out=[],seenPlans=new Set();
  const combat=visibleCombat({piecesPlaced:visible.piecesPlaced,
    attack:visible.attack});
  for(const goal of picked){
    if(out.length>=maxPlans||stats.tileNodes>=maxTileNodes||
      stats.forwardProofs>=maxProofs||stats.tilings>=maxTilings)break;
    const blocked=new Set(goal.blockedCells),needed=goal.requiredRows;
    if(!needed.length||needed.length>pre*4)continue;
    const needSet=new Set(needed),tileByType=new Map(),
      covering=new Map(needed.map(k=>[k,[]]));
    // Tile only the bottom six rows, using actual remaining known types.
    // Geometric tilings are candidate preimages, NOT legal routes yet.
    for(const type of new Set(known.slice(0,pre))){
      const unique=new Set(),options=[];
      for(let r=0;r<4;r++)for(let y=H-6;y<=H;y++)
        for(let x=-1;x<W+1;x++){
          const p={type,x,y:y-.04,r};
          const positions=cells(p),names=positions.map(([x,y])=>key(x,y));
          if(positions.some(([x,y])=>x<0||x>=W||y<H-6||y>=H)||
            positions.some(([x,y])=>blocked.has(key(x,y))||
              visible.board.rows[y][x]!==null))continue;
          const coverage=names.filter(k=>needSet.has(k));
          if(!coverage.length)continue;
          const id=names.slice().sort().join('|');
          if(unique.has(id))continue;
          unique.add(id);
          options.push({type,names,coverage,id,pose:p});
        }
      tileByType.set(type,options);stats.tiles+=options.length;
    }
    const tiles=known.slice(0,pre).flatMap((type,index)=>
      tileByType.get(type).map(tile=>({...tile,index})));
    for(const tile of tiles)for(const c of tile.coverage)
      covering.get(c).push(tile);
    for(const c of needed)covering.get(c).sort((a,b)=>
      b.coverage.length-a.coverage.length||a.index-b.index);
    const occupied=new Set(),used=new Set(),chosen=Array(pre).fill(null);
    function prove(){
      if(stats.forwardProofs>=maxProofs||out.length>=maxPlans)return;
      stats.forwardProofs++;
      const board=copy(visible.board),witnesses=[];
      for(let i=0;i<pre;i++){
        const target=chosen[i];
        if(!B.legal(board,target.pose)||
          B.legal(board,{...target.pose,y:target.pose.y+1})){
          stats.cheapRejected++;return;
        }
        const input=i===0?visible.current:spawn(known[i],board);
        let move=quickSetup(board,input,target.id,visible.rules);
        if(move)stats.quickSetupProofs++;
        else{
          stats.slowSetupProofs++;
          move=enumerateReachable(board,input,visible.rules,
            {maxStates,maxSteps}).find(m=>signature(m.piece)===target.id);
        }
        if(!move)return;
        if(B.commit(board,move.piece)||B.fullLines(board).length)return;
        witnesses.push(move);
      }
      const end={type:'t',x:goal.x,y:goal.y-.04,r:goal.rotation};
      if(!B.legal(board,end)||B.legal(board,{...end,y:end.y+1})){
        stats.cheapRejected++;return;
      }
      const preview=copy(board);B.commit(preview,end);
      if(B.fullLines(preview).length!==2){stats.cheapRejected++;return;}
      // The final Spin must be classified by real SRS+ *after* all setups.
      const t=enumerateReachable(board,spawn('t',board),visible.rules,{
        maxStates:Math.max(maxStates,2800),maxSteps}).find(m=>{
        if(m.spin!=='full'||m.piece.x!==goal.x||m.piece.r!==goal.rotation||
          Math.ceil(m.piece.y)!==goal.y)return false;
        const after=copy(board);B.commit(after,m.piece);
        return B.fullLines(after).length===2;
      });
      if(!t)return;
      stats.reachableFinishes++;witnesses.push(t);
      const pathKey=witnesses.map(m=>signature(m.piece)+'/'+m.spin).join(';');
      if(seenPlans.has(pathKey))return;
      seenPlans.add(pathKey);
      let state=combat;
      for(let i=0;i<pre;i++)state=projectCombat(state,
        {lines:0,spin:'none',allClear:false,garbageRows:0},
        visible.rules).combat;
      const after=copy(board);B.commit(after,t.piece);
      const rows=B.fullLines(after),garbageRows=rows.filter(y=>
        after.rows[y].includes('gb')).length;
      B.removeLines(after,rows);
      const allClear=rows.length>0&&B.emptyWithPerma(after);
      const attack=projectCombat(state,{
        lines:2,spin:'full',allClear,garbageRows},visible.rules);
      out.push({goal:{kind:'TSD',lines:2,x:goal.x,y:goal.y,
          rotation:goal.rotation,requiredRows:needed,
          minMissing:goal.minMissing},
        actions:witnesses.map(action),
        witnesses:witnesses.map(m=>({piece:m.piece,path:m.path,
          spin:m.spin,softdrop:m.softdrop})),
        evidence:{reachable:true,actualAuthorityExecuted:false,spin:'full',
          lines:2,attack:attack.generated,sent:attack.offensive,
          btb:attack.btb,allClear},planLength:pre+1});
    }
    function cover(){
      if(stats.tileNodes>=maxTileNodes||stats.tilings>=maxTilings||
        stats.forwardProofs>=maxProofs||out.length>=maxPlans)return;
      if(used.size===pre){
        if(needed.some(k=>!occupied.has(k)))return;
        stats.tilings++;prove();return;
      }
      const missing=needed.filter(k=>!occupied.has(k));
      if(!missing.length||missing.length>(pre-used.size)*4)return;
      let options=null;
      for(const c of missing){
        const candidates=covering.get(c).filter(t=>
          !used.has(t.index)&&t.names.every(k=>!occupied.has(k)));
        if(!candidates.length)return;
        if(!options||candidates.length<options.length)options=candidates;
      }
      for(const tile of options){
        if(stats.tileNodes>=maxTileNodes)return;
        stats.tileNodes++;
        used.add(tile.index);chosen[tile.index]=tile;
        for(const id of tile.names)occupied.add(id);
        cover();
        for(const id of tile.names)occupied.delete(id);
        used.delete(tile.index);chosen[tile.index]=null;
        if(out.length>=maxPlans||stats.forwardProofs>=maxProofs||
          stats.tileNodes>=maxTileNodes)return;
      }
    }
    cover();
  }
  stats.exhausted=stats.tileNodes>=maxTileNodes||
    stats.tilings>=maxTilings||stats.forwardProofs>=maxProofs;
  stats.budgetExceeded=stats.exhausted;
  out.sort((a,b)=>b.evidence.sent-a.evidence.sent||
    b.evidence.attack-a.evidence.attack);
  return {plans:out,stats,
    scope:'public low-stack exact-cover setup, SRS+ proven Full TSD'};
}
