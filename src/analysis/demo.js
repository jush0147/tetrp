import {Engine} from '../engine.js';
import * as B from '../board.js';
import * as R from '../rotation.js';
import {createHoles} from '../random.js';
import {placementIdentity} from './placement-authority.js';
import {visibleState} from './visible-state.js';
import {createPlacementTools} from '../../vendor/kiwi-v1/tetrp-placement-path.mjs';

// A replay may stop partway through a frame. Continue that frame, never replay
// its beginning or consume any remaining recorded inputs.
class BranchEngine extends Engine {
  static restore(bytes){return Object.setPrototypeOf(Engine.restore(bytes),this.prototype);}
  step(events=[]){
    if(this.state.phase==='ready')return super.step(events);
    for(const event of events)this.input({...event,subframe:Math.max(this.state.subframe,event.subframe)});
    return this.finishFrame();
  }
}
// Keep 24 frames as a battle cadence, never as a restriction on reachable
// placements. The original timed mode stays the default for pinned Kiwi.
class AtomicBranchEngine extends BranchEngine {
  fall() {}
  shifts() {}
  is20G(){return false;}
}
const tools=createPlacementTools({Engine:BranchEngine,boardModule:B,rotationModule:R});
const cellKey=cells=>cells.map(([x,y])=>`${x},${Math.ceil(y)}`).sort().join(';');
const moves=new Set(['moveLeft','moveRight','rotateCW','rotateCCW','rotate180','down','hardDrop']);
// Untimed legal-route witness for all supported replay lifecycles. Unlike the
// narrow PlacementArenaEngine adapter, it does not reject ordinary TL rules
// just because the replay uses ARE/garbage settings. Only the SRS+ path
// and its actually earned spin matter; no frame-limited key scheduling.
function proveUntimedPlacement(engine,result){
  const witness=engine.constructor.restore(engine.serialize());
  const path=result.execution.moves;
  for(const op of path){
    let accepted=true;
    if(op==='moveLeft')accepted=witness.move(-1);
    else if(op==='moveRight')accepted=witness.move(1);
    else if(op==='rotateCW')accepted=witness.rotate(1);
    else if(op==='rotateCCW')accepted=witness.rotate(3);
    else if(op==='rotate180')accepted=witness.rotate(2);
    else if(op==='down')accepted=witness.descend(1);
    else if(op==='hardDrop')witness.slam(true);
    else throw new Error('Unknown legal-route move');
    if(!accepted||!B.legal(witness.state.board,witness.state.piece))
      throw new Error('Illegal route toward proposed placement');
  }
  const p=witness.state.piece,actual=placementIdentity(p),target=result.move;
  if(actual.piece!==target.piece||actual.x!==target.x||actual.y!==target.y||
     actual.rotation!==target.rotation||actual.spin!==result.execution.spin||
     cellKey(actual.cells)!==cellKey(target.cells)||
     B.legal(witness.state.board,{...p,y:p.y+1}))
    throw new Error('Legal-route witness does not match claimed final position or spin');
  const board=structuredClone(witness.state.board);B.commit(board,p);
  const rows=B.fullLines(board);B.removeLines(board,rows);
  return {intent:actual,finalPiece:structuredClone(p),clear:{lines:rows.length,
    rows,allClear:rows.length>0&&B.emptyWithPerma(board)}};
}

export class BotDemo {
  constructor(engine,{placementMode='timed'}={}){
    if(!['timed','atomic'].includes(placementMode))throw new TypeError('Invalid bot placement mode');
    this.placementMode=placementMode;
    this.EngineType=placementMode==='atomic'?AtomicBranchEngine:BranchEngine;
    this.engine=this.EngineType.restore(engine.serialize());
    const s=this.engine.state;
    // The original piece generator stays private to this authority. Garbage
    // holes are a disclosed independent scenario, NOT the recorded hidden RNG.
    s.holes=createHoles(1);
    for(const p of [...(s.attack?.pending??[]),...(s.attack?.are??[])])p.column=null;
    s.queuedInputs=[];s.eventCursor=0;
    for(const key of Object.keys(s.input.held))this.engine.input({type:'keyup',key,subframe:s.subframe});
    s.initial={irs:0,ihs:false};
    this.engine.trace=[];
    this.history=[this.engine.serialize()];this.metadata=[null];this.index=0;this.revision=0;this.pending=null;
  }
  view(){const s=this.engine.state,visible=visibleState(s);
    // Only the authority worker retains checkpoints, RNG and unrevealed queue.
    const state={board:visible.board,piece:visible.current,hold:visible.hold,bag:{queue:visible.next},
      rules:visible.rules,frame:s.frame,subframe:s.subframe,stats:structuredClone(s.stats),
      attack:visible.attack?{...visible.attack,totals:structuredClone(s.attack.totals)}:null};
    return {state,visible,index:this.index,
    total:this.history.length-1,revision:this.revision,lastPlacement:this.metadata[this.index],
    stopped:!this.engine.state.playing};}
  seek(index){
    if(!Number.isInteger(index)||index<0||index>=this.history.length)throw new Error('示範位置超出範圍。');
    this.engine=this.EngineType.restore(this.history[index]);this.index=index;this.pending=null;this.revision++;
    return this.view();
  }
  prepare(result,revision){
    if(revision!==this.revision)throw new Error('示範位置已改變。');
    this.pending=null;
    if(this.index!==this.history.length-1)throw new Error('請到示範末端再計算下一手。');
    const trial=this.EngineType.restore(this.engine.serialize()),s=trial.state;
    if(!s.playing||s.piece.sleeping)throw new Error('此分支已結束或沒有可操作方塊。');
    if(result.action?.kind==='hold'){
      const mode=s.hold.piece==null?'empty':'occupied';
      if(result.action.mode!==mode||s.hold.locked||!trial.hold())throw new Error('Hold 已不可用。');
      this.pending={trial,kind:'hold',revision};return {kind:'hold'};
    }
    const path=result.execution?.moves,target=result.move;
    if(result.action?.kind!=='place'||!target||target.piece!==s.piece.type||!Array.isArray(path)||path.length>512||
      path.at(-1)!=='hardDrop'||path.slice(0,-1).includes('hardDrop')||path.some(m=>!moves.has(m)))throw new Error('無效的落子操作。');
    if(this.placementMode==='atomic'){
      // Prove actual SRS+ reachability and earned spin without a frame limit.
      // Only public Current/Hold/NEXT5 enters the witness. Never trust an
      // arbitrary client-provided target pose or claimed spin.
      const proof=proveUntimedPlacement(trial,result);
      const before=s.stats.pieces,oldFrame=s.frame;
      const locks=[];trial.trace=[];
      const originalEmit=trial.emit.bind(trial);
      trial.emit=(type,data)=>{
        if(type==='lock')locks.push(placementIdentity(trial.state.piece));
        originalEmit(type,data);
      };
      // Battle clock: still exactly 24 frames per placed piece (2.5 PPS).
      // No simulated key presses and no gravity/autolock of the active piece.
      // Canonical wait packets and attack multiplier still advance.
      for(let frame=0;frame<24;frame++)trial.step([]);
      if(!trial.state.playing||JSON.stringify(trial.state.board)!==JSON.stringify(s.board))
        throw new Error('Placement arena changed the visible board before lock');
      if(trial.state.stats.pieces!==before||trial.state.piece.type!==s.piece.type)
        throw new Error('Placement arena unexpectedly consumed a piece');
      trial.state.piece=structuredClone(proof.finalPiece);
      trial.lock();
      // ARE/delayed spawn belongs to the canonical Tetrp clock. Continue
      // without gravity/key inputs until the next public piece is available.
      let areWait=0;
      while(trial.state.playing&&trial.state.piece.sleeping&&areWait++<240)
        trial.step([]);
      if(trial.state.playing&&trial.state.piece.sleeping)
        throw new Error('Atomic placement could not reach the next public spawn');
      const actual=locks[0],intended=proof.intent;
      if(locks.length!==1||trial.state.stats.pieces!==before+1||
         actual.piece!==intended.piece||actual.x!==intended.x||actual.y!==intended.y||
         actual.rotation!==intended.rotation||actual.spin!==intended.spin||
         cellKey(actual.cells)!==cellKey(intended.cells)||trial.state.frame<oldFrame+24)
        throw new Error('Atomic Tetrp lock failed authority verification');
      const clear=trial.trace.find(e=>e.type==='remove-lines');
      if((clear?.rows.length??0)!==proof.clear.lines)
        throw new Error('Atomic Tetrp clear differs from legal-reachability proof');
      const metadata={piece:actual.piece,spin:actual.spin,lines:proof.clear.lines,
        allClear:proof.clear.allClear,
        sent:s.attack?trial.state.attack.totals.sent-this.engine.state.attack.totals.sent:null};
      trial.trace=[];
      this.pending={trial,kind:'place',revision,metadata};
      return {kind:'place',move:target};
    }
    const start=s.frame,end=start+23,before=s.stats.pieces;
    const inputs=tools.schedulePath(start,end,path,trial),locks=[];
    const emit=trial.emit.bind(trial);
    trial.emit=(type,data)=>{if(type==='lock')locks.push({cells:B.cells(trial.state.piece),spin:trial.state.piece.spin,
      piece:trial.state.piece.type,frame:trial.state.frame,subframe:trial.state.subframe});emit(type,data);};
    for(let frame=start;frame<=end;frame++)trial.step(tools.inputsForFrame(inputs,frame));
    const lock=locks[0];
    if(locks.length!==1||trial.state.stats.pieces!==before+1||lock.frame!==end||lock.subframe!==.5||
      lock.piece!==target.piece||cellKey(lock.cells)!==cellKey(target.cells)||lock.spin!==result.execution.spin)
      throw Object.assign(new Error('這個建議無法在目前操作時序下正確落子；分支未變更。'),
        {details:{locks,target,spin:result.execution.spin,path,before,after:trial.state.stats.pieces,end}});
    const clear=trial.trace.find(e=>e.type==='remove-lines');
    const metadata={piece:lock.piece,spin:lock.spin,lines:clear?.rows.length??0,allClear:clear?.allClear??false,
      sent:s.attack?trial.state.attack.totals.sent-this.engine.state.attack.totals.sent:null};
    trial.trace=[];
    this.pending={trial,kind:'place',revision,metadata};return {kind:'place',move:target};
  }
  commit(revision){
    const p=this.pending;
    if(!p||p.revision!==revision||revision!==this.revision)throw new Error('落子已取消或過期。');
    this.engine=p.trial;this.pending=null;this.revision++;
    if(p.kind==='place'){this.index++;this.history.push(this.engine.serialize());this.metadata.push(p.metadata);}
    return this.view();
  }
}
