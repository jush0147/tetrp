import {Engine} from '../src/engine.js';
import {projectAnchor} from '../src/replay/profile.js';

// Explicit display-only arena recording. Ordinary TETR.IO full events remain
// diagnostic anchors; only this tagged format uses recorded presentation states.
export class PlacementRecordingSession {
  constructor(player){
    const stream=player.stream;
    if(stream.tetrp?.format!=='placement-recording/1')throw new Error('Unsupported Tetrp recording');
    this.frames=stream.frames;this.points=stream.events.filter(e=>e.type==='full'||e.type==='end'&&e.data.game);
    if(!this.points.length)throw new Error('Empty placement recording');
    this.base=new Engine({mode:'tl',seed:stream.options.seed,rules:stream.tetrp.rules,handling:stream.options.handling}).state;
    let pieces=-1;
    for(const e of this.points){
      const top=e.data.tetrp?.topEmptyRows;
      if(!Number.isInteger(top)||top<0||top>20||e.data.game.board.length+top!==40||e.data.game.board.some(r=>r.length!==10)||e.data.game.bag.length!==5)throw new Error('Invalid recording board/preview');
      if(e.data.stats.piecesplaced<pieces)throw new Error('Recording placement regression');pieces=e.data.stats.piecesplaced;
      if(!['initial','landing','result','end'].includes(e.data.tetrp?.phase))throw new Error('Invalid recording phase');
      const a=e.data.tetrp.attack;
      if(!a||!Array.isArray(a.pending)||!Array.isArray(a.are)||!Number.isFinite(a.totals?.sent))throw new Error('Invalid recording attack');
    }
    this.total=pieces;this.index=0;this.conformance={first:null,observations:0,fields:[],boardAnchors:0};
  }
  async initialize(){this.index=0;return true;}
  get state(){
    const e=this.points[this.index],p=projectAnchor(e.data),s=structuredClone(this.base);
    s.board.rows=[...Array.from({length:e.data.tetrp.topEmptyRows},()=>Array(10).fill(null)),...p.board.rows];s.piece={...s.piece,...p.piece};s.hold=p.hold;s.bag.queue=p.bag.queue;
    s.stats={...s.stats,...p.stats};s.attack=structuredClone(e.data.tetrp.attack);
    s.playing=p.playing;s.g=p.g;s.frame=e.frame;s.subframe=0;s.reason=p.reason??null;
    s.recording=true;return s;
  }
  seek(kind,value){
    if(!Number.isSafeInteger(value)||value<0||value>(kind==='frame'?this.frames:this.total))throw new RangeError('Recording seek out of range');
    if(kind==='frame'){
      this.index=0;for(let i=0;i<this.points.length&&this.points[i].frame<=value;i++)this.index=i;
    }else if(kind==='placement'){
      const i=value===0?0:this.points.findIndex(e=>e.data.stats.piecesplaced===value&&e.data.tetrp.phase!=='landing');
      if(i<0)throw new RangeError('Missing recorded placement');this.index=i;
    }else throw new Error('Unknown seek kind');
    return this.state;
  }
  step(direction){
    if(![-1,1].includes(direction))throw new RangeError('Invalid direction');
    this.index=Math.max(0,Math.min(this.points.length-1,this.index+direction));return this.state;
  }
  async analysisState(){throw new Error('此檔為落點觀看紀錄，未包含可供 Bot Mode 延續的完整遊戲狀態。');}
  result(){const e=this.points[this.index];return {state:this.state,total:this.total,frames:this.frames,conformance:this.conformance,
    recordingPhase:e.data.tetrp.phase,navigationStop:null,lastPlacement:structuredClone(e.data.tetrp.placement??null),
    canPrevious:this.index>0,canNext:this.index<this.points.length-1};}
}
