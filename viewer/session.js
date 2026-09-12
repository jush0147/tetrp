import { parseReplay, selectPlayer, prepareReplay, Reconstruction } from '../src/replay/index.js';

export const MAX_FILE_BYTES = 32 * 1024 * 1024;
export const MAX_FRAMES = 216000; // One hour at 60 source frames/second.
export function catalog(replay) {
  return replay.rounds.map(round => ({index:round.index, players:round.players.map(p => ({
    index:p.index, name:typeof p.username==='string'&&p.username.trim()?p.username:`Player ${p.index+1}`,
  }))}));
}
export function parseLocalText(text) {
  if(text.length>MAX_FILE_BYTES)throw new Error('檔案超過 32 MB，請選擇較小的 replay。');
  return parseReplay(text);
}
export class ViewerSession {
  constructor(replay, round, player) {
    const selected=selectPlayer(replay,round,player);
    if(selected.stream.frames>MAX_FRAMES)throw new Error('此 viewer 支援最長一小時的 stream。');
    this.session=new Reconstruction(prepareReplay(selected));
    this.frames=selected.stream.frames;
    this.total=0;this.conformance=null;this.placements=new Map();
  }
  async initialize({yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0)), cancelled=()=>false, progress=()=>{}}={}) {
    let steps=0,previousSent=this.session.state.attack?.totals.sent??null;
    while(this.session.advance()) {
      let placed=null;
      for(const event of this.session.transitions??[]){
        if(event.type==='lock'){
          const current=this.session.state;
          placed={piece:event.piece,spin:event.spin,index:event.placementIndex,frame:event.frame,subframe:event.subframe,lines:0,allClear:false,
            sent:current.attack?current.attack.totals.sent-previousSent:null};
          this.placements.set(placed.index,placed);
          previousSent=current.attack?.totals.sent??null;
        }
        if(event.type==='remove-lines'&&placed){placed.lines=event.rows.length;placed.allClear=event.allClear;}
      }
      if(++steps%256===0) {
        progress(Math.min(99,Math.floor(this.session.state.frame/Math.max(1,this.frames)*100)));
        await yieldTask();if(cancelled())return false;
      }
    }
    const final=this.session.state;
    this.total=final.stats.pieces;
    const d=this.session.diagnostics;
    this.conformance={first:structuredClone(d.first),observations:d.observations.length,
      fields:d.observations.flatMap(o=>o.fields),
      boardAnchors:d.observations.filter(o=>o.boundary!=='pre-spawn' && o.fields.includes('board')).length};
    this.session.seekPlacement(0);return true;
  }
  seek(kind,value) {
    this.garbageStop=null;
    if(!Number.isSafeInteger(value)||value<0 || value>(kind==='frame'?this.frames:this.total))throw new RangeError('位置超出 replay 範圍。');
    if(kind==='frame'){
      // Forward playback consumes existing ordered actions; reverse/arbitrary seek
      // still uses the stable API. No wall-clock data ever enters the Engine.
      if(this.session.state.frame<value){while(this.session.state.frame<value)this.session.advance();return this.session.state;}
      return this.session.seekFrame(value);
    }
    if(kind==='placement')return this.session.seekPlacement(value);
    throw new Error('Unknown seek kind');
  }
  /** Manual navigation only: expose unseen garbage just before its actual intake. */
  step(direction) {
    if(![-1,1].includes(direction))throw new RangeError('Unknown step direction');
    const start=this.session.state,stop=this.garbageStop;
    if(stop&&direction===-1&&start.stats.pieces===stop.target){
      this.session=Reconstruction.restore(stop.checkpoint);stop.paused=true;return this.session.state;
    }
    if(stop?.paused){
      const target=direction===1?stop.target:stop.target-1;
      this.session.seekPlacement(target);stop.paused=false;
      if(direction===-1)this.garbageStop=null;
      return this.session.state;
    }
    this.garbageStop=null;
    if(direction===-1)return this.session.seekPlacement(Math.max(0,start.stats.pieces-1));
    const target=Math.min(this.total,start.stats.pieces+1);
    if(target===start.stats.pieces)return start;
    const packets=s=>[...(s.attack?.are??[]),...(s.attack?.pending??[])];
    const shown=new Set(packets(start).filter(p=>p.amt>0).map(p=>p.cid));
    const checkpoint=this.session.checkpoint();
    const scan=Reconstruction.restore(checkpoint);
    let count=0,boundary=null,previous=start;
    while(scan.advance()){
      const current=scan.state;
      if(boundary===null&&(current.attack?.totals.tanked??0)>(previous.attack?.totals.tanked??0)){
        const remaining=new Map(packets(current).map(p=>[p.cid,p.amt]));
        const unseenDecrease=packets(previous).filter(p=>!shown.has(p.cid))
          .reduce((n,p)=>n+Math.max(0,p.amt-(remaining.get(p.cid)??0)),0);
        // Cancellation and intake can share one atomic operation. Only pause if
        // unseen intake is proven even after attributing all cancellation to it.
        const cancelled=current.attack.totals.cancelled-previous.attack.totals.cancelled;
        if(unseenDecrease>cancelled)boundary=count;
      }
      count++;previous=current;
      if(current.stats.pieces>=target)break;
    }
    if(boundary!==null){
      this.session=Reconstruction.restore(checkpoint);
      for(let i=0;i<boundary;i++)this.session.advance();
      this.garbageStop={target,checkpoint:this.session.checkpoint(),paused:true};
    }else this.session=scan;
    return this.session.state;
  }
  result() {const state=this.session.state;return {state,total:this.total,frames:this.frames,conformance:this.conformance,
    navigationStop:this.garbageStop?.paused?'incoming':null,
    lastPlacement:structuredClone(this.placements.get(state.stats.pieces)??null)};}
}
