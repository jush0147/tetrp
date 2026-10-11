// Research-only TWO-LOCK Full TSD constructor. The first CURRENT piece is
// reachable by actual SRS+, and the second known T (NEXT[0] or public Hold)
// must also have an SRS+ path that clears two rows with a Full spin.
// No unobserved bag pieces or hidden opponent garbage are sampled.
import * as B from '../board.js';
import {enumerateReachable} from './rook.js';
import {tsdScaffolds} from './rook-tsd.js';

const clone=b=>({...b,rows:b.rows.map(r=>r.slice())});
const spawn=(type,board)=>({type,x:Math.ceil(board.width/2)-1,
  y:board.buffer-2.04,hy:board.buffer-2,r:0,kick:0,rotated:false,
  spin:'none',wall:false,sleeping:false,locking:0,resets:0,
  rotationResets:0,totalRotations:0,safelock:0,keys:0,
  softDropped:false,forceLock:false});

export function findPublicTwoLockTsd(visible,{
  firstStates=1200,secondStates=2400,maxSteps=70,maxPlans=8,
  geometryPrescreen=true,secondProofCap=60
}={}){
  if(visible?.next?.length!==5||!visible.board||!visible.current||
    !visible.rules||'bag' in visible||'holes' in visible||'rng' in visible)
    throw Error('Requires exactly player-visible Current/Hold/NEXT5');
  if(typeof geometryPrescreen!=='boolean'||
    !Number.isInteger(secondProofCap)||secondProofCap<1||secondProofCap>300||
    ![firstStates,secondStates,maxSteps,maxPlans].every(Number.isInteger)||
    firstStates<1||firstStates>10000||secondStates<1||
    secondStates>10000||maxSteps<1||maxSteps>150||
    maxPlans<1||maxPlans>100)throw new RangeError('Invalid two-lock TSD budget');
  const hasNextT=visible.next[0]==='t';
  const heldT=visible.rules.hold&&visible.hold?.piece==='t';
  const types=[...(hasNextT?[{type:'t',viaHold:false}]:[]),
    ...(heldT?[{type:'t',viaHold:true}]:[])];
  const result={format:'public-two-lock-full-tsd/1',
    firstMoves:0,geometricReady:0,secondProofCalls:0,plans:[],
    nextT:hasNextT,heldT:!!heldT,requiresNoNewGarbage:true,
    truncated:false,geometryPrescreen,secondProofCap};
  if(!types.length)return result;
  const first=enumerateReachable(visible.board,visible.current,visible.rules,{
    maxStates:firstStates,maxSteps});
  for(const firstMove of first){
    result.firstMoves++;
    const board=clone(visible.board);
    if(!B.legal(board,firstMove.piece)||B.commit(board,firstMove.piece))
      continue;
    const cleared=B.fullLines(board);
    B.removeLines(board,cleared);
    // Cheap exact geometric pre-filter, not attack credit. A second SRS+
    // proof below remains mandatory even when this geometry looks perfect.
    const geometric=tsdScaffolds(board,visible.rules,{maxMissing:0})
      .some(x=>x.fullSpinGeometry);
    if(geometric)result.geometricReady++;
    // Prescreening is a CPU shortcut, never an exhaustive SRS+ theorem.
    // Kick-based or vertical TSDs can evade this geometry-only template.
    if(geometryPrescreen&&!geometric)continue;
    if(result.secondProofCalls>=secondProofCap){
      result.truncated=true;
      return result;
    }
    const piece=spawn('t',board);
    if(!B.legal(board,piece))continue;
    result.secondProofCalls++;
    const reachable=enumerateReachable(board,piece,visible.rules,{
      maxStates:secondStates,maxSteps});
    for(const move of reachable){
      if(move.spin!=='full')continue;
      const checked=clone(board);
      if(!B.legal(checked,move.piece)||B.commit(checked,move.piece))
        continue;
      if(B.fullLines(checked).length!==2)continue;
      for(const type of types){
        result.plans.push({
          first:{type:visible.current.type,
            path:firstMove.path,spin:firstMove.spin,
            cells:B.cells(firstMove.piece).map(([x,y])=>[x,Math.ceil(y)])},
          second:{type:type.type,path:move.path,spin:move.spin,
            viaHold:type.viaHold,
            cells:B.cells(move.piece).map(([x,y])=>[x,Math.ceil(y)])}
        });
        if(result.plans.length>=maxPlans){
          result.truncated=true;
          return result;
        }
      }
    }
  }
  return result;
}
