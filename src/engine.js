import * as B from './board.js';
import { createBag, pullBag, createHoles } from './random.js';
import { rotate, classifySpin } from './rotation.js';
import { ruleset, defaultHandling, blitzGravity, blitzLines } from './rules.js';
import * as A from './attack.js';
import { fallProbes, effectiveGravity, softDropBudget, antiStallExtra } from './physics.js';

export class UnknownBehavior extends Error {}
const clone = value => structuredClone(value);
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
const keys = ['moveLeft','moveRight','rotateCW','rotateCCW','rotate180','softDrop','hardDrop','hold'];
const rotation = { rotateCW: 1, rotateCCW: 3, rotate180: 2 };

/** Deterministic simulation only; callers own input collection and rendering. */
export class Engine {
  constructor({ seed = 1, mode = 'tl', rules = {}, handling = {} } = {}) {
    const config = ruleset(mode, rules), h = { ...defaultHandling, ...handling };
    for (const [name, min, max] of [['arr',0,5],['das',1,20],['dcd',0,20],['sdf',5,41]]) {
      if (!Number.isFinite(h[name]) || h[name] < min || h[name] > max) throw new RangeError(`Invalid ${name}`);
    }
    if (!['off','tap','hold'].includes(h.irs) || !['off','tap','hold'].includes(h.ihs)) throw new TypeError('Invalid initial input mode');
    this.state = {
      schema: 'tetrp-engine/2', rules: config, handling: h,
      conformance: { aggregateScore: mode === 'tl' ? 'covered-tl' : 'unknown',
        attack: mode === 'tl' ? 'covered-tl' : 'unknown', b2b: mode === 'tl' ? 'covered-tl' : 'unknown' },
      frame: 0, subframe: 0, phase: 'ready', eventCursor: 0, queuedInputs: [],
      board: B.createBoard(config.boardwidth, config.boardheight, config.buffer),
      bag: createBag(seed), holes: createHoles(seed), hold: { piece: null, locked: false },
      piece: null, input: { held: {}, left: { das: 0, arr: h.arr }, right: { das: 0, arr: h.arr }, last: null },
      initial: { irs: 0, ihs: false }, waiting: [], nextWillTank: false, garbageLockedUntil: 0,
      attack: mode === 'tl' ? A.createAttack() : null, g: mode === 'blitz' ? blitzGravity(1) : config.g, glock: 0,
      stats: { pieces: 0, lines: 0, score: mode === 'tl' ? 0 : null, dropScore: 0, holds: 0, level: 1, levelLines: 0 },
      lastClear: false, lastReceived: 0, playing: true, success: false, reason: null,
    };
    if (this.state.attack) this.state.attack.multiplier = config.garbagemultiplier;
    this.trace = []; this.spawn();
  }
  emit(type, data = {}) { this.trace.push({ type, frame: this.state.frame, subframe: this.state.subframe, ...data }); }
  serialize() { return JSON.stringify(sorted(this.state)); }
  static restore(bytes) {
    const s = JSON.parse(bytes);
    if (s.schema !== 'tetrp-engine/2') throw new TypeError('Unsupported checkpoint version');
    if (!Array.isArray(s.board?.rows) || s.board.rows.length !== s.board.height + s.board.buffer || s.board.rows.some(row => row.length !== s.board.width || row.some(c => c !== null && !['z','l','o','s','i','j','t','gb','gbd'].includes(c)))) throw new TypeError('Invalid checkpoint board');
    const check = value => {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Non-finite state');
      if (value && typeof value === 'object') Object.values(value).forEach(check);
    };
    check(s);
    ruleset(s.rules.mode, s.rules);
    for (const name of ['frame','eventCursor']) if (!Number.isInteger(s[name]) || s[name] < 0) throw new TypeError(`Invalid checkpoint ${name}`);
    for (const name of ['g','glock','subframe','garbageLockedUntil']) if (typeof s[name] !== 'number' || s[name] < 0) throw new TypeError(`Invalid checkpoint ${name}`);
    if (s.subframe >= 1 || !s.input || !s.handling || !s.stats || !s.initial || !s.hold || !s.conformance) throw new TypeError('Incomplete checkpoint');
    const solo = s.rules.mode !== 'tl';
    for (const key of ['aggregateScore','attack','b2b']) if (s.conformance[key] !== (solo ? 'unknown' : 'covered-tl')) throw new TypeError('Invalid conformance marker');
    if (solo ? s.attack !== null || s.stats.score !== null || s.nextWillTank : !s.attack || typeof s.stats.score !== 'number') throw new TypeError('Invalid mode-specific checkpoint');
    if (typeof s.stats.dropScore !== 'number' || s.stats.dropScore < 0) throw new TypeError('Invalid drop score');
    if (!Array.isArray(s.queuedInputs) || s.eventCursor > s.queuedInputs.length || !Array.isArray(s.waiting) || s.waiting.some(w => !Number.isInteger(w.target) || !['are','incoming-attack-hit'].includes(w.type))) throw new TypeError('Invalid checkpoint events');
    if (solo && s.waiting.some(w => w.type !== 'are')) throw new TypeError('Unsupported solo garbage wait');
    if (!s.piece || !Number.isInteger(s.piece.x) || typeof s.piece.y !== 'number' || !Number.isInteger(s.piece.r)) throw new TypeError('Invalid checkpoint piece');
    B.cells(s.piece); // Validate the type/rotation without rejecting terminal overlap.
    if (!Array.isArray(s.bag?.queue) || s.bag.queue.some(type => ![...'zlosijt'].includes(type))) throw new TypeError('Invalid checkpoint bag');
    for (const rng of [s.bag?.rng, s.holes?.rng]) if (!Number.isInteger(rng?.seed) || rng.seed < 1 || rng.seed >= 2147483647) throw new TypeError('Invalid checkpoint RNG');
    if (!['ready','inputs'].includes(s.phase)) throw new TypeError('Invalid checkpoint phase');
    const engine = Object.create(Engine.prototype); engine.state = clone(s); engine.trace = [];
    return engine;
  }
  die(reason) { this.state.playing = false; this.state.reason = reason; this.emit('gameover', { reason }); }
  dcd() {
    const s = this.state;
    if (!s.piece?.wall || s.handling.dcd <= 0) return;
    for (const shift of [s.input.left,s.input.right]) {
      shift.das = Math.min(shift.das, s.handling.das - s.handling.dcd); shift.arr = s.handling.arr;
    }
  }
  blockout() {
    const s = this.state, p = s.piece;
    if (B.legal(s.board,p)) return true;
    if (s.lastClear && s.rules.clutch) {
      const old = p.y;
      while (p.y > 0) { p.y--; p.hy--; if (B.legal(s.board,p)) { this.emit('clutch'); return true; } }
      p.hy += old - p.y; p.y = old;
    }
    this.die(s.board.lastWasAttack ? 'garbagesmash' : 'topout'); return false;
  }
  spawn(explicit = null, fromARE = false, fromHold = false) {
    const s = this.state;
    if (!s.playing) return;
    this.dcd();
    const safe = s.piece?.safelock ?? 0;
    if (!fromHold) {
      if (s.handling.irs === 'hold') s.initial.irs = keys.reduce((sum,key) => sum + (s.input.held[key] ? rotation[key] ?? 0 : 0),0) % 4;
      if (s.handling.ihs === 'hold') s.initial.ihs = Boolean(s.input.held.hold);
    }
    s.piece = { type: explicit ?? pullBag(s.bag), x: Math.ceil(s.board.width / 2) - 1,
      y: s.board.buffer - 2.04, hy: s.board.buffer - 2, r: 0, kick: 0, rotated: false, spin: 'none',
      wall: false, sleeping: false, locking: 0, resets: 0, rotationResets: 0, totalRotations: 0,
      safelock: safe, keys: 0, softDropped: false, forceLock: false };
    s.hold.locked = false; this.emit('spawn', { piece: s.piece.type });
    if (!fromARE && !this.blockout()) return;
    if (s.initial.ihs && !fromHold) { s.initial.ihs = false; this.hold(fromARE); return; }
    if (s.initial.irs) { const d = s.initial.irs; s.initial.irs = 0; this.rotate(d); }
    if (!this.blockout()) return;
    if (this.is20G()) this.slam();
  }
  hold(fromARE = false) {
    const s = this.state;
    if (!s.playing || !s.rules.hold) return false;
    if (s.piece.sleeping) { if (s.handling.ihs === 'tap') s.initial.ihs = true; return false; }
    if (s.hold.locked) return false;
    const old = s.piece.type, replacement = s.hold.piece;
    this.spawn(replacement, fromARE, true);
    s.hold.piece = old; s.hold.locked = !s.rules.infinite_hold; s.stats.holds++; this.emit('hold'); return true;
  }
  clearSpin() { this.state.piece.rotated = false; this.state.piece.spin = 'none'; }
  move(direction) {
    const s = this.state, p = s.piece;
    if (!s.playing || p.sleeping) return false;
    if (!B.legal(s.board,{...p,x:p.x+direction})) { p.wall = true; return false; }
    p.x += direction; p.wall = false; p.locking = 0; p.resets++; this.clearSpin();
    if (this.is20G()) this.slam();
    this.emit('move',{direction}); return true;
  }
  rotate(direction) {
    const s = this.state, p = s.piece;
    if (!s.playing || direction === 2 && !s.rules.allow180) return false;
    if (p.sleeping) { if (s.handling.irs === 'tap') s.initial.irs = (s.initial.irs + direction) % 4; return false; }
    const candidate = rotate(s.board,p,direction,s.rules.lockresets);
    if (!candidate) return false;
    this.dcd(); Object.assign(p,candidate);
    p.rotated = true; p.totalRotations++; p.rotationResets = Math.min(63,p.rotationResets+1); p.locking = 0; p.keys += direction === 2 ? 2 : 1;
    p.spin = classifySpin(s.board,p,s.rules.spinbonuses);
    if (this.is20G()) this.slam();
    this.emit('rotate',{direction}); return true;
  }
  effectiveGravity() {
    const s = this.state;
    return effectiveGravity(s.g,s.glock);
  }
  is20G() {
    const s = this.state;
    return (s.rules.gravitymay20g && this.effectiveGravity() >= s.board.height) ||
      Boolean(s.input.held.softDrop && s.handling.may20g && softDropBudget(this.effectiveGravity(),1,s.handling.sdf) >= s.board.height);
  }
  descend(distance, preserveSpin = false) {
    const s = this.state, p = s.piece, old = p.y;
    const [y,probe] = fallProbes(old,distance);
    if (!B.legal(s.board,{...p,y}) || !B.legal(s.board,{...p,y:probe})) return false;
    p.y = y;
    const crossed = Math.ceil(y) - Math.ceil(old);
    if (crossed && !preserveSpin) this.clearSpin();
    if (Math.ceil(y) > p.hy) { p.hy = Math.ceil(y); p.resets = 0; p.rotationResets = 0; }
    if (crossed && s.input.held.softDrop && !preserveSpin) { this.scoreDrop(crossed); p.softDropped = true; }
    return true;
  }
  slam(preserveSpin = false) {
    let distance = 0;
    while (this.descend(1,preserveSpin)) distance++;
    return distance;
  }
  fall(dt) {
    const s = this.state, p = s.piece;
    if (p.safelock > 0) p.safelock--;
    if (!s.playing || p.sleeping) return;
    const gravity = this.effectiveGravity();
    let amount = s.input.held.softDrop ? softDropBudget(gravity,dt,s.handling.sdf) : gravity * dt;
    s.glock = Math.max(0,s.glock-dt);
    const resetExhausted = p.resets >= s.rules.lockresets && !B.legal(s.board,{...p,y:p.y+1});
    if (resetExhausted) { amount = 20; p.forceLock = true; }
    amount += antiStallExtra(s.rules.lockresets,p.rotationResets,dt);
    let grounded = false;
    while (amount > 0) {
      const step = Math.min(1,amount);
      if (!this.descend(step)) { grounded = true; break; }
      amount -= step;
    }
    if (grounded) {
      p.locking += dt;
      if (p.locking > s.rules.locktime_frames || p.forceLock || p.resets >= s.rules.lockresets) {
        if (s.handling.safelock) p.safelock = 7;
        this.lock();
      }
    }
  }
  hardDrop() {
    const s = this.state;
    if (!s.playing || s.piece.sleeping || s.piece.safelock) return false;
    this.scoreDrop(2 * this.slam(true)); this.emit('hard-drop'); this.lock(); return true;
  }
  scoreDrop(points) {
    const stats = this.state.stats;
    stats.dropScore += points;
    if (stats.score !== null) stats.score += points;
  }
  shifts(dt) {
    const s = this.state, h = s.handling;
    for (const [side,key,dir] of [['left','moveLeft',-1],['right','moveRight',1]]) {
      if (!s.input.held[key] || s.input.last !== side) continue;
      const shift = s.input[side], extra = Math.max(0,dt-Math.max(0,h.das-shift.das));
      shift.das = Math.min(h.das,shift.das+dt);
      if (shift.das < h.das) continue;
      shift.arr += extra;
      const count = h.arr === 0 ? s.board.width : Math.floor(shift.arr / h.arr);
      if (h.arr > 0) shift.arr -= count * h.arr;
      for (let i=0;i<count;i++) this.move(dir);
    }
  }
  advanceSegment(to) {
    const s = this.state;
    if (to <= s.subframe) return;
    const dt = to-s.subframe;
    this.emit('segment',{dt,softDrop:Boolean(s.input.held.softDrop)});
    this.shifts(dt); this.fall(dt); s.subframe = to;
  }
  input(event) {
    const s = this.state;
    this.advanceSegment(Math.floor(event.subframe * 10)/10);
    const down = event.type === 'keydown', key = event.key;
    this.emit('input',{key,down});
    if (down && s.input.held[key]) return;
    s.input.held[key] = down;
    if (key === 'moveLeft' || key === 'moveRight') {
      const side = key === 'moveLeft' ? 'left' : 'right', other = side === 'left' ? 'right' : 'left';
      if (down) {
        s.input.last = side; s.input[side].das = event.hoisted ? s.handling.das-s.handling.dcd : 0;
        s.input[side].arr = s.handling.arr; s.piece.keys++; this.move(side === 'left' ? -1 : 1);
      } else {
        s.input[side].das = 0;
        if (s.input.last === side) s.input.last = s.input.held[other === 'left' ? 'moveLeft' : 'moveRight'] ? other : null;
        if (s.handling.cancel) { s.input[other].das = 0; s.input[other].arr = s.handling.arr; }
      }
    } else if (down && key in rotation) this.rotate(rotation[key]);
    else if (down && key === 'hold') this.hold();
    else if (down && key === 'hardDrop') this.hardDrop();
  }
  beginFrame(events = []) {
    const s = this.state;
    if (s.phase !== 'ready') throw new Error('Frame already in progress');
    for (const event of events) if (event.frame !== s.frame || !['keydown','keyup'].includes(event.type) || !keys.includes(event.key) || !Number.isFinite(event.subframe) || event.subframe < 0 || event.subframe >= 1) throw new TypeError('Invalid input event');
    s.subframe = 0; s.phase = 'inputs'; s.queuedInputs = clone(events); s.eventCursor = 0;
  }
  processNextInput() {
    const s = this.state;
    if (s.phase !== 'inputs') throw new Error('No frame in progress');
    if (s.eventCursor === s.queuedInputs.length) return false;
    this.input(s.queuedInputs[s.eventCursor]); s.eventCursor++; return true;
  }
  finishFrame() {
    const s = this.state;
    if (s.phase !== 'inputs') throw new Error('No frame in progress');
    while (this.processNextInput()) { /* preserve insertion order */ }
    s.frame++; this.emit('source-frame'); this.advanceSegment(1);
    for (let i=s.waiting.length-1;i>=0;i--) {
      if (s.waiting[i].target !== s.frame) continue;
      const [wait] = s.waiting.splice(i,1); this.executeWait(wait);
    }
    this.continuousGarbage();
    if (s.rules.objective_type === 'lines' && s.stats.lines >= s.rules.objective_count || s.rules.objective_type === 'timed' && s.frame * 1000 / 60 >= s.rules.objective_time_ms) {
      s.success = true; s.playing = false;
    }
    // Late growth: gameplay at F uses the value from the start of F.
    if (s.frame > s.rules.gmargin_frames + 1) s.g += s.rules.gincrease / 60;
    if (s.attack && s.frame > s.rules.garbagemargin_frames + 1) s.attack.multiplier += s.rules.garbageincrease_per_second / 60;
    s.subframe = 0; s.phase = 'ready'; s.eventCursor = 0; s.queuedInputs = [];
    return this;
  }
  step(events = []) { this.beginFrame(events); return this.finishFrame(); }
  schedule(delay,type,data = {}) {
    if (!Number.isInteger(delay) || delay < 0 || !['are','incoming-attack-hit'].includes(type)) throw new TypeError('Unsupported deterministic wait');
    if (type === 'incoming-attack-hit') this.requireTL();
    this.state.waiting.push({target:this.state.frame+delay,type,data:clone(data)});
  }
  executeWait(wait) {
    const s = this.state; this.emit('wait',{wait:wait.type,...wait.data});
    if (wait.type === 'are') { if (s.nextWillTank) this.takeDamage(); s.nextWillTank = false; this.spawn(null,true); }
    else if (wait.type === 'incoming-attack-hit') {
      const p = s.attack.pending.find(p => p.cid === wait.data.cid); if (p) p.active = true;
    } else throw new TypeError('Unsupported wait in checkpoint');
  }
  requireTL() {
    if (this.state.rules.mode !== 'tl') throw new UnknownBehavior('Solo attack/garbage semantics are unsupported');
  }
  receive(event) { this.requireTL(); return A.receive(this.state.attack,event); }
  confirm(cid) {
    this.requireTL();
    const s = this.state, packet = s.attack.pending.find(p => p.cid === cid);
    if (!packet) return;
    packet.confirmFrame = s.frame; packet.activeFrame = s.frame+s.rules.garbagespeed_frames;
    s.attack.totals.received++; this.schedule(s.rules.garbagespeed_frames,'incoming-attack-hit',{cid});
  }
  insertGarbage(hole) {
    const s = this.state;
    if (!B.pushLine(s.board,hole)) { this.die('garbagesmash'); return false; }
    if (!s.piece.sleeping && !B.repairAfterGarbage(s.board,s.piece)) { this.die('garbagesmash'); return false; }
    return true;
  }
  takeDamage() {
    this.requireTL();
    const s = this.state; this.emit('tank');
    s.lastReceived = A.tank(s.attack,s.rules,s.holes,hole => this.insertGarbage(hole));
  }
  continuousGarbage() {
    const s = this.state;
    if (!s.attack || !s.playing || s.piece.sleeping || s.frame < s.garbageLockedUntil || !s.attack.are.length) return;
    const packet = s.attack.are[0];
    if (!Number.isInteger(packet.column)) throw new UnknownBehavior('Continuous ARE entry requires a resolved column');
    if (this.insertGarbage(packet.column)) {
      if (--packet.amt === 0) s.attack.are.shift();
      s.attack.totals.tanked++; s.garbageLockedUntil = s.frame+s.rules.garbageare;
    }
  }
  lock() {
    const s = this.state, p = s.piece;
    if (!s.playing || p.sleeping) return;
    p.sleeping = true; s.stats.pieces++; this.emit('lock');
    const lockout = B.commit(s.board,p); this.emit('commit');
    const rows = B.fullLines(s.board), garbageRows = rows.filter(y => s.board.rows[y].includes('gb')).length;
    B.removeLines(s.board,rows); if (rows.length) this.emit('remove-lines',{rows});
    const lines = rows.length, allClear = lines > 0 && B.emptyWithPerma(s.board);
    s.lastClear = lines > 0; s.lastReceived = 0; s.stats.lines += lines;
    // Geometry/counters/progression are independent of unknown solo aggregates.
    const delay = s.rules.mode === 'tl' ? this.resolveTLPlacement(lines,allClear,garbageRows)
      : (lines ? s.rules.lineclear_are : s.rules.are);
    if (lockout && !s.rules.nolockout && (!lines || !s.rules.clutch)) { this.die('lockout'); return; }
    if (s.rules.levels) {
      s.stats.levelLines += lines;
      while (s.stats.levelLines >= blitzLines(s.stats.level)) { s.stats.levelLines -= blitzLines(s.stats.level); s.stats.level++; }
      s.g = blitzGravity(s.stats.level);
    }
    if (delay > 0) { this.schedule(delay,'are'); this.emit('schedule-are',{delay}); }
    else this.spawn();
  }
  resolveTLPlacement(lines,allClear,garbageRows) {
    const s = this.state, p = s.piece;
    const result = A.resolveAttack(s.attack,{lines,spin:p.spin,allClear,garbageRows},s.rules,s.holes,phase => this.emit('attack',{phase}));
    s.nextWillTank = !result.blocked;
    this.emit('tank-decision',{blocked:result.blocked});
    if (result.blocked) s.garbageLockedUntil = Math.max(s.garbageLockedUntil,s.frame+s.rules.garbagearebump);
    let delay = lines ? s.rules.lineclear_are : s.rules.are;
    if (s.nextWillTank && !(delay > 0 && s.rules.garbageentry === 'instant')) { this.takeDamage(); s.nextWillTank = false; }
    if (s.rules.garbageentry === 'delayed') delay = Math.max(delay,s.lastReceived*s.rules.garbageare);
    // Score tables are specified; exact finesse indexing is intentionally deferred.
    const scoreTable = p.spin === 'full' ? [400,800,1200,1600,2600] : p.spin === 'mini' ? [100,200,400,800,1600] : [0,100,300,500,800];
    s.stats.score += ((scoreTable[lines] ?? 0)*(result.b2bBonus ? 1.5 : 1) + 50*Math.max(0,s.attack.combo-1) + (allClear ? 3500 : 0))*s.stats.level;
    return delay;
  }
}
