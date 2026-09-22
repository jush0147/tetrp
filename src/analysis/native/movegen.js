import {rotate,classifySpin} from '../../rotation.js';
import {fallProbes} from '../../physics.js';
import {cells,geometry,legal} from './board.js';

export function spawn(type){return {type,x:4,y:17.96,hy:18,r:0,kick:0,rotated:false,spin:'none',
  totalRotations:0,resets:0,rotationResets:0,locking:0,safelock:0,forceLock:false,wall:false};}
export function rescuedSpawn(board,type,lastClear,rules){
  const p=spawn(type);
  if(legal(board,p))return p;
  if(lastClear&&rules.clutch)while(p.y>0){p.y--;p.hy--;if(legal(board,p))return p;}
  return null;
}
function descend(board,p){
  const [y,probe]=fallProbes(p.y,1);
  if(!legal(board,{...p,y})||!legal(board,{...p,y:probe}))return null;
  const crossed=Math.ceil(y)>Math.ceil(p.y),lower=Math.ceil(y)>p.hy;
  return {...p,y,...(crossed?{rotated:false,spin:'none'}:{}),...(lower?{hy:Math.ceil(y),resets:0,rotationResets:0}:{})};
}
function drop(board,p){
  let q=p,next;
  while((next=descend(board,q)))q={...next,rotated:p.rotated,spin:p.spin};
  return q;
}
const actions=['moveLeft','moveRight','rotateCW','rotateCCW','rotate180','down'];
function successor(board,p,action,rules){
  if(action==='down')return descend(board,p);
  if(action==='moveLeft'||action==='moveRight'){
    const q={...p,x:p.x+(action==='moveLeft'?-1:1),spin:'none',rotated:false};
    return legal(board,q)?q:null;
  }
  const direction={rotateCW:1,rotateCCW:3,rotate180:2}[action];
  if(direction===2&&!rules.allow180)return null;
  const q=rotate(board,p,direction,rules.lockresets,geometry);
  if(!q)return null;
  q.rotated=true;q.totalRotations=p.totalRotations+1;
  q.spin=classifySpin(board,q,rules.spinbonuses,geometry);return q;
}
const landingKey=p=>cells(p).map(c=>c.join(',')).sort().join(';')+':'+p.spin;
function poseKey(p,rules,complete){
  return [p.x,p.y,p.r,p.spin,
    complete?Math.min(p.totalRotations,rules.lockresets+16):0].join(',');
}
/** Geometry search only. Optional complete mode retains rotation history. Default
 * uses shortest ordinary-regime paths: no speculative >30-rotation kick cycles.
 * This limitation is reported, never used to label an authority state terminal. */
export function generate(board,initial,rules,{complete=false,paths=false,maxStates=250000,onState}={}){
  if(!initial||!legal(board,initial))return {moves:[],states:0,complete:true};
  const queue=[{p:{...initial},parent:-1,action:null}],seen=new Set([poseKey(initial,rules,complete)]),landings=new Map();
  let head=0;const drops=new Map();
  while(head<queue.length){
    if(head>=maxStates||onState?.()===false)return {moves:[],states:head,complete:false};
    const index=head++,{p}=queue[index],dropKey=[p.x,p.y,p.r].join(',');
    let landing=drops.get(dropKey);
    if(!landing){landing=drop(board,p);drops.set(dropKey,landing);}
    const landed={...p,y:landing.y,hy:landing.hy},key=landingKey(landed);
    if(!landings.has(key))landings.set(key,{piece:landed,index});
    for(const action of actions){
      const next=successor(board,p,action,rules);if(!next)continue;
      if(!complete&&next.totalRotations>rules.lockresets+15)continue;
      const k=poseKey(next,rules,complete);if(seen.has(k))continue;
      seen.add(k);queue.push({p:next,parent:paths?index:-1,action:paths?action:null});
    }
  }
  const moves=[...landings.values()].map(({piece,index})=>{
    const result={piece};
    if(paths){const path=[];for(let i=index;queue[i].parent>=0;i=queue[i].parent)path.push(queue[i].action);
      result.path=[...path.reverse(),'hardDrop'];}
    return result;
  }).sort((a,b)=>a.piece.x-b.piece.x||a.piece.y-b.piece.y||a.piece.r-b.piece.r||a.piece.spin.localeCompare(b.piece.spin));
  return {moves,states:head,complete:true};
}
