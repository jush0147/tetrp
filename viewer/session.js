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
    let steps=0;
    while(this.session.advance()) {
      let placed=null;
      for(const event of this.session.transitions??[]){
        if(event.type==='lock'){
          placed={piece:event.piece,spin:event.spin,index:event.placementIndex,frame:event.frame,subframe:event.subframe,lines:0};
          this.placements.set(placed.index,placed);
        }
        if(event.type==='remove-lines'&&placed)placed.lines=event.rows.length;
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
  result() {const state=this.session.state;return {state,total:this.total,frames:this.frames,conformance:this.conformance,
    lastPlacement:structuredClone(this.placements.get(state.stats.pieces)??null)};}
}
