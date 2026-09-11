import { Engine } from '../engine.js';
import { ReplayError } from './parser.js';
import { DivergenceDiagnostics } from './diagnostics.js';

const copy = v => structuredClone(v);
const bad = message => { throw new ReplayError('INVALID_TIMELINE','timeline',message); };
const keys = ['moveLeft','moveRight','rotateCW','rotateCCW','rotate180','softDrop','hardDrop','hold'];
function validate(timeline) {
  if (timeline?.schema !== 'tetrp-timeline/1' || typeof timeline.id !== 'string' || !timeline.id ||
      !Number.isSafeInteger(timeline.frames) || timeline.frames < 0 || !Array.isArray(timeline.events)) bad('Invalid header');
  Engine.restore(timeline.initial);
  let frame = -1;
  for (const e of timeline.events) {
    if (!Number.isSafeInteger(e.frame) || e.frame < frame || e.frame > timeline.frames) bad('Invalid event frame/order');
    frame = e.frame;
    if (!['keydown','keyup','receive','confirm','anchor','metadata','end','terminal'].includes(e.type)) bad(`Unsupported canonical event: ${e.type}`);
    if (['keydown','keyup'].includes(e.type) && (!keys.includes(e.key) || !Number.isFinite(e.subframe) || e.subframe < 0 || e.subframe >= 1)) bad('Invalid input');
    if (e.type === 'anchor' && (!e.expected || typeof e.expected !== 'object' || Array.isArray(e.expected))) bad('Invalid anchor');
    if (e.type === 'terminal' && (typeof e.reason!=='string' || 'subframe' in e && (!Number.isFinite(e.subframe)||e.subframe<0||e.subframe>=1))) bad('Invalid terminal');
    if ('remoteCid' in e && (!Number.isSafeInteger(e.remoteCid)||e.remoteCid<0))bad('Invalid remote cid');
    if (e.type === 'receive' && (!e.data || typeof e.data.from !== 'string' || !['iid','ackiid','amt'].every(k=>Number.isSafeInteger(e.data[k]) && e.data[k]>=0))) bad('Invalid receive');
    if (e.type === 'confirm' && (!Number.isSafeInteger(e.remoteCid??e.cid) || (e.remoteCid??e.cid)<0)) bad('Invalid confirm');
  }
}

/** Owns the source cursor; engine rules are untouched. Timelines require resolved semantics. */
export class Reconstruction {
  constructor(timeline) {
    validate(timeline); this.timeline = copy(timeline); this.engine = Engine.restore(timeline.initial);
    if (this.engine.state.frame !== 0 || this.engine.state.phase !== 'ready') bad('Initial engine must be ready at frame zero');
    this.cursor = 0; this.packetIds = {}; this.transitions = []; this.diagnostics = new DivergenceDiagnostics();
  }
  get state() { return copy(this.engine.state); }
  checkpoint() {
    return JSON.stringify({schema:'tetrp-reconstruction/1',timeline:this.timeline,
      cursor:this.cursor,packetIds:this.packetIds,engine:this.engine.serialize(),diagnostics:this.diagnostics});
  }
  static restore(bytes) {
    let cp;
    try { cp = JSON.parse(bytes); } catch { bad('Invalid checkpoint JSON'); }
    if (cp.schema !== 'tetrp-reconstruction/1') bad('Unsupported checkpoint version');
    const result = new Reconstruction(cp.timeline);
    if (!Number.isSafeInteger(cp.cursor) || cp.cursor<0 || cp.cursor>cp.timeline.events.length) bad('Invalid cursor');
    result.engine = Engine.restore(cp.engine); result.cursor = cp.cursor;
    if (result.engine.state.frame>result.timeline.frames || result.engine.state.queuedInputs.length) bad('Invalid engine continuation');
    if (result.timeline.events.slice(0,result.cursor).some(e=>e.frame>result.engine.state.frame) ||
        result.timeline.events.slice(result.cursor).some(e=>e.frame<result.engine.state.frame)) bad('Cursor/frame mismatch');
    if (!Array.isArray(cp.diagnostics?.observations)) bad('Invalid diagnostics');
    if (!cp.packetIds || typeof cp.packetIds!=='object' || Array.isArray(cp.packetIds) || Object.values(cp.packetIds).some(id=>id!==null && (!Number.isSafeInteger(id)||id<1))) bad('Invalid packet ID map');
    result.packetIds=copy(cp.packetIds);
    Object.assign(result.diagnostics,copy(cp.diagnostics)); return result;
  }
  /** One source event or frame boundary, never reorders equal/decreasing subframes. */
  advance() {
    this.transitions = [];
    const s = this.engine.state, event = this.timeline.events[this.cursor];
    if (s.frame === this.timeline.frames && (!event || event.frame !== s.frame)) return false;
    if (s.phase === 'ready') this.engine.beginFrame([]);
    if (event && event.frame === s.frame) {
      switch (event.type) {
        case 'keydown': case 'keyup': this.engine.input(event); break;
        case 'receive': {
          const id=this.engine.receive(event.data);
          if(event.remoteCid!==undefined)this.packetIds[event.remoteCid]=id;
          break;
        }
        case 'confirm': {
          const id=event.remoteCid===undefined?event.cid:this.packetIds[event.remoteCid];
          if(id!==null && id!==undefined)this.engine.confirm(id);
          break;
        }
        case 'terminal':
          if(event.subframe!==undefined)this.engine.advanceSegment(Math.floor(event.subframe*10)/10);
          // External termination is an action. Preserve any endogenous failure reason
          // so an end anchor can still expose a different engine topout classification.
          s.piece.sleeping=true; s.playing=false;
          if(s.reason===null)s.reason=event.reason;
          break;
        case 'anchor': this.diagnostics.observe(event.actual??s,event.expected,{frame:s.frame,sourceIndex:event.sourceIndex,boundary:event.boundary??'source-event'}); break;
        case 'metadata': case 'end': break;
      }
      this.cursor++;
    } else this.engine.finishFrame();
    // Noncanonical observation for consumers such as replay viewers. Never restored
    // as gameplay state; preserves placement facts before zero-ARE spawn replaces p.
    this.transitions = copy(this.engine.trace);
    this.engine.trace.length = 0;
    return true;
  }
  reset() { this.engine = Engine.restore(this.timeline.initial); this.cursor=0; this.packetIds={}; this.transitions=[]; this.diagnostics=new DivergenceDiagnostics(); }
  seekFrame(frame) {
    if (!Number.isSafeInteger(frame) || frame<0 || frame>this.timeline.frames) throw new RangeError('Frame out of range');
    this.reset();
    while (this.engine.state.frame<frame) this.advance();
    return this.state; // beginning of frame, before its events
  }
  seekPlacement(index) {
    if (!Number.isSafeInteger(index) || index<0) throw new RangeError('Placement out of range');
    this.reset();
    while (this.engine.state.stats.pieces<index) if (!this.advance()) throw new RangeError('Placement beyond reconstructed stream');
    if (this.engine.state.stats.pieces!==index) throw new ReplayError('PLACEMENT_BOUNDARY','engine','Multiple placements in one atomic engine operation');
    return this.state;
  }
  run() { while (this.advance()) { /* bounded by timeline */ } return this.state; }
  /** Fork contains no future replay events. Finish an open frame, or input local events first. */
  fork() { return Engine.restore(this.engine.serialize()); }
}
