import {Engine} from '../engine.js';
import * as B from '../board.js';

export const PLACEMENT_MODEL='tl-placement-v1';
const certificates=new WeakMap();
const directions={rotateCW:1,rotateCCW:3,rotate180:2};
const cellKey=c=>c.map(([x,y])=>`${x},${Math.ceil(y)}`).sort().join(';');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=(message,details)=>{throw Object.assign(new Error(message),{details});};

/** Placement arena control, NOT frame-accurate input play. The authority clock,
 * packet waits, multiplier growth and lock transaction remain inherited. Only
 * active-piece input/gravity/auto-lock control is replaced by atomic placements.
 * This deliberately includes automatic 20G movement in the excluded controls.
 */
export class PlacementArenaEngine extends Engine {
  fall() {}
  shifts() {}
  is20G(){return false;}
}

export function assertPlacementContract(state){
  const r=state.rules;
  if(r.mode!=='tl'||r.are!==0||r.lineclear_are!==0||r.garbageare!==0||r.garbagearebump!==0||
    r.garbageentry!=='instant'||r.infinite_hold||r.objective_type!==null||state.attack?.are.length||
    state.waiting?.some(w=>w.type!=='incoming-attack-hit'))
    fail('Unsupported placement-arena lifecycle (ARE / continuous garbage / rules)');
}

function publicProbe(snapshot){
  assertPlacementContract(snapshot);
  const e=new PlacementArenaEngine({rules:snapshot.rules}),s=e.state;
  s.board=structuredClone(snapshot.board);s.piece=structuredClone(snapshot.current);
  s.hold=structuredClone(snapshot.hold);s.bag.queue=[...snapshot.next];
  s.frame=snapshot.frame;s.subframe=snapshot.subframe;s.playing=snapshot.playing;
  s.lastClear=(snapshot.attack?.combo??0)>0;
  return e;
}

export function placementIdentity(piece){return {piece:piece.type,x:piece.x,y:Math.ceil(piece.y),rotation:piece.r,
  cells:B.cells(piece).map(([x,y])=>[x,Math.ceil(y)]),spin:piece.spin};}
function identityMatches(a,b){return a.piece===b.piece&&a.x===b.x&&a.y===b.y&&a.rotation===b.rotation&&
  a.spin===b.spin&&cellKey(a.cells)===cellKey(b.cells);}

/** A witness is executed instantaneously using authority move/rotate/descend
 * semantics. No clock advance, no lock, no opponent or hidden sequence access.
 * The final spin is the earned path state; never reclassify the final cells.
 */
export function validatePlacement(snapshot,action){
  const e=publicProbe(snapshot),s=e.state,path=action?.execution?.moves;
  const provenance=[];
  try{
    if(action?.action?.kind!=='place'||action.move?.useHold!==false||!s.playing||s.piece.sleeping||
      !Array.isArray(path)||path.length>512||path.at(-1)!=='hardDrop'||path.slice(0,-1).includes('hardDrop'))
      fail('Invalid placement action');
    for(const move of path){
      const before=structuredClone(s.piece);let success;
      if(move==='hardDrop'){e.slam(true);success=true;}
      else if(move==='down')success=e.descend(1);
      else if(move==='moveLeft'||move==='moveRight')success=e.move(move==='moveLeft'?-1:1);
      else if(Object.hasOwn(directions,move))success=e.rotate(directions[move]);
      else fail('Unknown placement witness operation');
      provenance.push({move,before,after:structuredClone(s.piece)});
      if(!success||!B.legal(s.board,s.piece))fail('Illegal placement witness step');
    }
    const intent={...action.move,spin:action.execution.spin},actual=placementIdentity(s.piece);
    if(!identityMatches(intent,actual)||B.legal(s.board,{...s.piece,y:s.piece.y+1}))
      fail('Placement witness does not match top-1 intent',{intent,actual});
    const board=structuredClone(s.board);B.commit(board,s.piece);
    const rows=B.fullLines(board),garbageRows=rows.filter(y=>board.rows[y].includes('gb')).length;
    B.removeLines(board,rows);
    const clear={rows,lines:rows.length,garbageRows,allClear:rows.length>0&&B.emptyWithPerma(board)};
    const proof={model:PLACEMENT_MODEL,intent,provenance,finalPiece:structuredClone(s.piece),clear};
    certificates.set(proof,{snapshot:structuredClone(snapshot),action:structuredClone(action),proof:structuredClone(proof)});
    return proof;
  }catch(error){
    error.details={...error.details,provenance,actual:placementIdentity(s.piece)};throw error;
  }
}

export function commitPlacement(engine,certificate,lockFrame){
  const saved=certificates.get(certificate),s=engine.state;
  if(!saved||!(engine instanceof PlacementArenaEngine))fail('Untrusted placement certificate / authority');
  const {snapshot,proof}=saved;
  assertPlacementContract(s);
  if(!s.playing||s.phase!=='inputs'||s.frame!==lockFrame||s.subframe!==.5||s.stats.pieces!==snapshot.piecesPlaced||
    !same(s.rules,snapshot.rules)||!same(s.board,snapshot.board)||!same(s.piece,snapshot.current)||!same(s.hold,snapshot.hold))
    fail('Placement certificate is stale',{provenance:proof.provenance,actual:placementIdentity(s.piece)});
  certificates.delete(certificate);
  const actual={locks:[],clear:{rows:[],lines:0,garbageRows:proof.clear.garbageRows,allClear:false}},emit=engine.emit;
  engine.emit=function(type,data){
    if(type==='lock')actual.locks.push({...placementIdentity(s.piece),frame:s.frame,subframe:s.subframe});
    if(type==='remove-lines')actual.clear={rows:[...data.rows],lines:data.rows.length,
      garbageRows:data.rows.filter(y=>snapshot.board.rows[y].includes('gb')).length,allClear:data.allClear};
    emit.call(this,type,data);
  };
  try{s.piece=structuredClone(proof.finalPiece);engine.lock();}
  finally{engine.emit=emit;}
  if(actual.locks.length!==1||!identityMatches(proof.intent,actual.locks[0])||
    actual.locks[0].frame!==lockFrame||actual.locks[0].subframe!==.5||!same(proof.clear,actual.clear))
    fail('Top-1 authority lock / clear mismatch',{provenance:proof.provenance,expected:proof,actual});
  return actual;
}

export function commitHold(engine,snapshot,action){
  const state=engine.state,heldCount=state.stats.holds,attackBefore=JSON.stringify(state.attack);
  if(state.frame!==snapshot.frame||state.stats.pieces!==snapshot.piecesPlaced||!same(state.board,snapshot.board)||
    !same(state.piece,snapshot.current)||!same(state.hold,snapshot.hold)||!same(state.rules,snapshot.rules))fail('Stale Hold snapshot');
  const e=publicProbe(snapshot),before=e.state,mode=before.hold.piece===null?'empty':'occupied';
  if(action?.action?.kind!=='hold'||action.action.mode!==mode||action.action.requiresReanalysis!==true||
    action.action.samePiece!==((before.hold.piece??snapshot.next[0])===before.piece.type)||!e.hold())fail('Invalid Hold intent');
  if(!engine.hold())fail('Authority rejected validated Hold');
  const s=engine.state,expected=e.state;
  const count=mode==='empty'?4:5;
  const actual={current:structuredClone(s.piece),hold:{...s.hold},next:s.bag.queue.slice(0,5),frame:s.frame,playing:s.playing,reason:s.reason};
  if(!same(s.piece,expected.piece)||!same(s.hold,expected.hold)||!same(s.board,snapshot.board)||s.frame!==snapshot.frame||
    s.playing!==expected.playing||s.reason!==expected.reason||s.stats.holds!==heldCount+1||s.stats.pieces!==snapshot.piecesPlaced||
    JSON.stringify(s.attack)!==attackBefore||!same(actual.next.slice(0,count),expected.bag.queue.slice(0,count)))
    fail('Hold transition mismatch',{expected:{current:expected.piece,hold:expected.hold,knownNext:expected.bag.queue.slice(0,count)},actual});
  return actual;
}
