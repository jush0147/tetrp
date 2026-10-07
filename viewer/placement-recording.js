import {PlacementArenaEngine,assertPlacementContract,validatePlacement,commitPlacement,commitHold} from '../src/analysis/placement-authority.js';
import {createHoles} from '../src/random.js';
import {visibleState} from '../src/analysis/visible-state.js';

export const RECORDING_FORMAT='authority-placement/1';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sorted=v=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
export async function stateDigest(state){
  const bytes=new TextEncoder().encode(JSON.stringify(sorted(state)));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
const fail=message=>{throw new Error('Arena replay: '+message);};

/** Replays recorded actions through the original placement authority. The entire
 * engine state, including both RNGs, is checked at every recorded boundary.
 * Ordinary TETR.IO full events retain their original diagnostic-only semantics.
 */
export class PlacementRecordingSession {
  constructor(player){
    const stream=player.stream,r=stream.tetrp;
    if(r?.format!==RECORDING_FORMAT)fail('舊版落點檔不受支援，請下載重新匯出的回放。');
    if(player.gamemode!=='league'||!Number.isSafeInteger(r.holeSeed)||r.cadence!==24||
      !Array.isArray(r.ops)||!r.ops.length||stream.frames>216000)fail('invalid recording header');
    let frame=-1;
    for(const op of r.ops){
      if(!Number.isSafeInteger(op.frame)||op.frame<frame||op.frame>stream.frames||
        !['check','receive','hold','plan','lock','end'].includes(op.type))fail('invalid action order');
      if(['check','end'].includes(op.type)&&!/^[0-9a-f]{64}$/.test(op.hash))fail('invalid state digest');
      frame=op.frame;
    }
    if(r.ops[0].type!=='check'||r.ops[0].frame!==0||r.ops.at(-1).type!=='end'||r.ops.at(-1).frame!==stream.frames)fail('missing boundaries');
    this.stream=stream;this.frames=stream.frames;this.points=[];this.byPlacement=new Map();
    this.index=0;this.total=0;this.conformance=null;
  }
  async initialize({yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0)),cancelled=()=>false,progress=()=>{}}={}){
    const r=this.stream.tetrp;
    const engine=new PlacementArenaEngine({seed:this.stream.options.seed,rules:r.rules,handling:this.stream.options.handling});
    engine.state.holes=createHoles(r.holeSeed);assertPlacementContract(engine.state);
    this.points=[];this.byPlacement=new Map();let plan=null,last=null,checks=0,locks=0,holds=0,ended=false;
    const flush=()=>{engine.state.attack.outbox.splice(0);engine.trace=[];};
    const point=(state,phase,placement=last)=>{
      const entry={state:structuredClone(state),phase,placement:structuredClone(placement)};
      if(this.points.length&&entry.state.frame<this.points.at(-1).state.frame)fail('display order');
      this.points.push(entry);
      if(phase==='initial'||phase==='result')this.byPlacement.set(state.stats.pieces,this.points.length-1);
    };
    point(engine.state,'initial');
    for(let i=0;i<r.ops.length;i++){
      const op=r.ops[i];
      if(ended||engine.state.frame>op.frame)fail('action after boundary at '+op.frame);
      while(engine.state.frame<op.frame){engine.step([]);flush();}
      const s=engine.state;
      if(op.type==='check'||op.type==='end'){
        const actual=await stateDigest(s);
        if(actual!==op.hash)fail('state mismatch at frame '+op.frame+', piece '+s.stats.pieces+'; expected '+op.hash+', actual '+actual);
        checks++;
        if(op.type==='end'){
          if(plan)fail('uncommitted placement at end');
          if(op.reason!==this.stream.results?.gameoverreason||op.reason!=='winner'&&op.reason!==s.reason)fail('terminal reason mismatch');
          const final=structuredClone(s);final.playing=false;final.piece.sleeping=true;final.reason=op.reason;
          point(final,'end');ended=true;
        }
      }else if(op.type==='receive'){
        const d=op.data;
        if(!d||d.from!=='P2'||!['iid','ackiid','amt'].every(k=>Number.isSafeInteger(d[k])&&d[k]>=0))fail('invalid receive');
        const cid=engine.receive(d);if(cid!==op.cid)fail('receive mismatch at '+op.frame);
        if(cid!==null)engine.confirm(cid);
      }else if(op.type==='hold'){
        if(plan||op.frame%24!==0)fail('Hold outside decision boundary');
        const actual=commitHold(engine,visibleState(s),op.action);
        if(!same(actual,op.expected))fail('Hold mismatch at '+op.frame);holds++;
      }else if(op.type==='plan'){
        if(plan||op.frame%24!==0||op.action?.candidateIndex!==0)fail('invalid placement request');
        const proof=validatePlacement(visibleState(s),op.action);
        plan={proof,frame:op.frame,preview:structuredClone(s)};
      }else if(op.type==='lock'){
        if(!plan||op.frame!==plan.frame+23)fail('invalid lock cadence');
        engine.beginFrame([]);engine.advanceSegment(.5);
        const before=s.attack.totals.sent;
        const actual=commitPlacement(engine,plan.proof,op.frame);
        if(!same(actual,op.expected))fail('lock/cells/spin/clear mismatch at '+op.frame);
        const lock=actual.locks[0];
        last={piece:lock.piece,spin:lock.spin,index:s.stats.pieces,frame:op.frame,subframe:.5,
          lines:actual.clear.lines,allClear:actual.clear.allClear,sent:s.attack.totals.sent-before};
        // Presentation only: expose the proven landing for the latter half of
        // its slot. Actual authority lock timing remains frame + subframe .5.
        plan.preview.piece=structuredClone(plan.proof.finalPiece);plan.preview.frame=plan.frame+12;
        point(plan.preview,'landing',last);
        engine.finishFrame();flush();point(s,'result');plan=null;locks++;
      }
      engine.trace=[];
      if(i%64===0){progress(Math.floor(i/r.ops.length*100));await yieldTask();if(cancelled())return false;}
    }
    if(!ended||!locks)fail('incomplete recording');
    this.total=engine.state.stats.pieces;this.index=0;this.cursorFrame=0;
    this.conformance={first:null,observations:checks,fields:['full-authority-state'],boardAnchors:checks,
      placements:locks,holds,format:RECORDING_FORMAT};
    return true;
  }
  get state(){const s=structuredClone(this.points[this.index].state);s.recording=true;s.frame=this.cursorFrame??s.frame;return s;}
  seek(kind,value){
    if(!['frame','placement'].includes(kind)||!Number.isSafeInteger(value)||value<0||value>(kind==='frame'?this.frames:this.total))fail('seek out of range');
    if(kind==='frame'){
      let lo=0,hi=this.points.length;
      while(lo<hi){const mid=(lo+hi)>>1;if(this.points[mid].state.frame<=value)lo=mid+1;else hi=mid;}
      this.index=Math.max(0,lo-1);this.cursorFrame=value;
    }else{
      const index=this.byPlacement.get(value);if(index===undefined)fail('missing placement');
      this.index=index;this.cursorFrame=this.points[index].state.frame;
    }
    return this.state;
  }
  step(direction){
    if(![-1,1].includes(direction))fail('invalid step');
    this.index=Math.max(0,Math.min(this.points.length-1,this.index+direction));
    this.cursorFrame=this.points[this.index].state.frame;return this.state;
  }
  async analysisState(){fail('此檔記錄 placement arena，不支援鍵盤模式的 Bot Mode。');}
  result(){const p=this.points[this.index];return {state:this.state,total:this.total,frames:this.frames,conformance:this.conformance,
    recordingPhase:p.phase,navigationStop:null,lastPlacement:structuredClone(p.placement),canPrevious:this.index>0,canNext:this.index<this.points.length-1};}
}
