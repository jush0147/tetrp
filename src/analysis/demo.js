import {Engine} from '../engine.js';
import * as B from '../board.js';
import * as R from '../rotation.js';
import {createHoles} from '../random.js';
import {visibleState} from './visible-state.js';
import {schedulePlacement} from './placement-transport.js';
import {createPlacementTools} from '../../vendor/kiwi-v1/tetrp-placement-path.mjs';

// A replay may stop partway through a frame. Continue that frame, never replay
// its beginning or consume any remaining recorded inputs.
class BranchEngine extends Engine {
  static restore(bytes){return Object.setPrototypeOf(Engine.restore(bytes),BranchEngine.prototype);}
  step(events=[]){
    if(this.state.phase==='ready')return super.step(events);
    for(const event of events)this.input({...event,subframe:Math.max(this.state.subframe,event.subframe)});
    return this.finishFrame();
  }
}
const tools=createPlacementTools({Engine:BranchEngine,boardModule:B,rotationModule:R});
const cellKey=cells=>cells.map(([x,y])=>`${x},${Math.ceil(y)}`).sort().join(';');
const moves=new Set(['moveLeft','moveRight','rotateCW','rotateCCW','rotate180','down','hardDrop']);
export class BotDemo {
  constructor(engine){
    this.engine=BranchEngine.restore(engine.serialize());
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
    this.engine=BranchEngine.restore(this.history[index]);this.index=index;this.pending=null;this.revision++;
    return this.view();
  }
  prepare(result,revision){
    if(revision!==this.revision)throw new Error('示範位置已改變。');
    this.pending=null;
    if(this.index!==this.history.length-1)throw new Error('請到示範末端再計算下一手。');
    const trial=BranchEngine.restore(this.engine.serialize()),s=trial.state;
    if(!s.playing||s.piece.sleeping)throw new Error('此分支已結束或沒有可操作方塊。');
    if(result.action?.kind==='hold'){
      const mode=s.hold.piece==null?'empty':'occupied';
      if(result.action.mode!==mode||s.hold.locked||!trial.hold())throw new Error('Hold 已不可用。');
      this.pending={trial,kind:'hold',revision};return {kind:'hold'};
    }
    const path=result.execution?.moves,target=result.move;
    if(result.action?.kind!=='place'||!target||target.piece!==s.piece.type||!Array.isArray(path)||path.length>512||
      path.at(-1)!=='hardDrop'||path.slice(0,-1).includes('hardDrop')||path.some(m=>!moves.has(m)))throw new Error('無效的落子操作。');
    const start=s.frame,end=start+23,before=s.stats.pieces;
    const inputs=schedulePlacement(trial,result,end),locks=[];
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
