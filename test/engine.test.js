import test from 'node:test';
import assert from 'node:assert/strict';
import inputVectors from '../03_fixtures/TETRIO_INPUT_FRAME_TEST_VECTORS_V19.json' with { type: 'json' };
import placementVectors from '../03_fixtures/TETRIO_PLACEMENT_ORDER_TEST_VECTORS_V19.json' with { type: 'json' };
import { Engine } from '../src/engine.js';
import * as B from '../src/board.js';
const event = (e,key,subframe=0,type='keydown',extra={}) => ({frame:e.state.frame,subframe,type,key,...extra});
const setupPiece = (e,type='o',x=4,y=38.96,r=0) => Object.assign(e.state.piece,{type,x,y,r,hy:Math.ceil(y),safelock:0});
const incoming = (e,amt=8) => {
  const cid = e.receive({from:'P2',iid:1,amt}); e.state.attack.pending.find(p => p.cid === cid).active = true;
};
for (const v of inputVectors.vectors) test(`input fixture: ${v.name}`, () => {
  const e = new Engine(); e.state.frame = v.events[0].frame;
  if (v.precondition?.includes('inputSoftdrop=true')) e.state.input.held.softDrop = true;
  if ('expected_safelock_decrements' in v) e.state.piece.safelock = 7;
  e.trace = []; e.step(v.events);
  const segments = e.trace.filter(x => x.type === 'segment');
  const expected = {
    rotate_then_harddrop:[0.2,0.5,0.3],softdrop_midframe:[0.4,0.6],softdrop_release_midframe:[0.6,0.4],
    same_subframe_insertion_order:[0.5,0.5],decreasing_subframe_malformed_replay:[0.8,0.2],
    safelock_call_count_quirk:[0.2,0.2,0.2,0.2,0.2],
  };
  assert.deepEqual(segments.map(x => Math.round(x.dt*10)/10),expected[v.name]);
  assert.deepEqual(e.trace.filter(x => x.type === 'input').map(x => x.key),v.events.map(x => x.key));
  assert.equal(e.state.frame,v.events[0].frame+1);
  const counter = e.trace.findIndex(x => x.type === 'source-frame');
  assert.ok(counter > e.trace.findLastIndex(x => x.type === 'input'));
  assert.ok(counter < e.trace.findLastIndex(x => x.type === 'segment'));
  if (v.name === 'rotate_then_harddrop' || v.name === 'decreasing_subframe_malformed_replay') {
    assert.ok(e.trace.findIndex(x => x.type === 'rotate') < e.trace.findIndex(x => x.type === 'hard-drop'));
    assert.equal(e.state.stats.pieces,1);
    assert.equal(e.trace.find(x => x.type === 'hard-drop').subframe,v.name.startsWith('decreasing') ? 0.8 : 0.7);
  }
  if (v.name === 'softdrop_midframe') assert.deepEqual(segments.map(x => x.softDrop),[false,true]);
  if (v.name === 'softdrop_release_midframe') assert.deepEqual(segments.map(x => x.softDrop),[true,false]);
  if ('expected_safelock_decrements' in v) assert.equal(e.state.piece.safelock,7-v.expected_safelock_decrements);
});
for (const v of placementVectors.vectors) test(`placement fixture: ${v.name}`, () => {
  const e = new Engine({rules:{are:v.are ?? 0,garbageentry:v.garbageentry ?? 'instant',garbageare:2}});
  incoming(e); setupPiece(e);
  if (v.placement === 'single') {
    e.state.board.rows[39].fill('t'); e.state.board.rows[39][4] = e.state.board.rows[39][5] = null;
  } else if (v.placement === 'all_clear') {
    setupPiece(e,'i',4,38.96,0); e.state.board.rows[39].fill('t');
    for (const x of [3,4,5,6]) e.state.board.rows[39][x] = null;
  }
  e.trace=[]; e.lock();
  const trace = () => e.trace.map(x => x.type);
  assert.ok(trace().indexOf('commit') >= 0);
  if (v.placement === 'single') {
    assert.ok(trace().indexOf('commit') < trace().indexOf('remove-lines'));
    assert.equal(e.state.nextWillTank,false); assert.equal(e.state.attack.totals.generated,0);
    assert.equal(e.state.attack.totals.tanked,0); assert.equal(e.state.piece.sleeping,false);
  } else if (v.placement === 'all_clear') {
    assert.deepEqual(e.trace.filter(x=>x.type==='attack').map(x=>x.phase),['ordinary','all-clear']);
    assert.equal(e.state.attack.totals.generated,5); assert.equal(e.state.attack.totals.cancelled,8);
    assert.ok(trace().lastIndexOf('attack') < trace().indexOf('tank-decision'));
  } else if (!v.are) {
    assert.ok(trace().indexOf('commit') < trace().indexOf('tank'));
    assert.ok(trace().indexOf('tank') < trace().indexOf('spawn')); assert.equal(e.state.attack.totals.tanked,8);
  } else {
    assert.equal(e.state.piece.sleeping,true);
    if (v.garbageentry === 'instant') { assert.equal(e.state.nextWillTank,true); assert.equal(e.state.attack.totals.tanked,0); }
    else { assert.equal(e.state.nextWillTank,false); assert.equal(e.state.attack.totals.tanked,8); }
    const target=e.state.waiting[0].target;
    while(e.state.frame<target) e.step();
    assert.equal(e.state.piece.sleeping,false); assert.equal(e.state.attack.totals.tanked,8);
    assert.ok(trace().indexOf('tank') < trace().lastIndexOf('spawn'));
  }
});
test('spawn, empty hold, occupied swap and hold lock lifetime', () => {
  const e = new Engine(); assert.equal(e.state.piece.type,'o'); assert.equal(e.state.piece.y,17.96);
  e.hold(); assert.equal(e.state.piece.type,'j'); assert.equal(e.state.hold.piece,'o');
  const q = [...e.state.bag.queue]; assert.equal(e.hold(),false); assert.deepEqual(e.state.bag.queue,q);
  e.hardDrop(); const next = e.state.piece.type, before = [...e.state.bag.queue];
  e.hold(); assert.equal(e.state.piece.type,'o'); assert.equal(e.state.hold.piece,next); assert.deepEqual(e.state.bag.queue,before);
});
test('tap IHS precedes IRS on ARE replacement, held modes combine inputs', () => {
  for (const mode of ['tap','hold']) {
    const e = new Engine({rules:{are:2},handling:{irs:mode,ihs:mode}}); e.hardDrop();
    e.step([event(e,'hold'),event(e,'rotateCW',0.2)]); e.step();
    assert.equal(e.state.piece.type,'i'); assert.equal(e.state.hold.piece,'j'); assert.equal(e.state.piece.r,1);
    assert.equal(e.state.hold.locked,true);
  }
});
test('ARR zero reaches wall at DAS threshold and DCD sees outgoing wall', () => {
  const e = new Engine({handling:{arr:0,das:2,dcd:1}});
  e.step([event(e,'moveLeft')]); assert.equal(e.state.piece.x,3);
  e.step(); assert.equal(e.state.piece.x,0); assert.equal(e.state.piece.wall,true);
  e.hardDrop(); assert.equal(e.state.input.left.das,1); assert.equal(e.state.input.left.arr,0);
});
test('opposing direction priority, repeat keydown ignored, release cancel', () => {
  const e = new Engine({handling:{cancel:true}});
  e.step([event(e,'moveLeft'),event(e,'moveRight',0.2),event(e,'moveRight',0.4)]);
  assert.equal(e.state.piece.x,4); assert.equal(e.state.input.last,'right');
  e.step([event(e,'moveRight',0.5,'keyup')]); assert.equal(e.state.input.last,'left');
  assert.equal(e.state.input.left.das,0.5);
});
test('lock delay is strict >30, natural lock gives safelock, hard-drop does not', () => {
  const e = new Engine(); setupPiece(e);
  for(let i=0;i<30;i++) e.fall(1); assert.equal(e.state.stats.pieces,0);
  e.fall(0.1); assert.equal(e.state.stats.pieces,1); assert.equal(e.state.piece.safelock,7);
  assert.equal(e.hardDrop(),false);
  const h = new Engine(); h.hardDrop(); assert.equal(h.state.piece.safelock,0);
});
test('reset limit force locks, rotation anti-stall is capped separately', () => {
  const e = new Engine(); setupPiece(e); e.state.piece.resets=15; e.fall(0.1);
  assert.equal(e.state.stats.pieces,1);
  const r = new Engine(); for(let i=0;i<70;i++) r.rotate(1);
  assert.equal(r.state.piece.rotationResets,63); assert.equal(r.state.piece.totalRotations,70);
});
test('spin invalidation distinguishes failed shift, real shift, falling and hard-drop', () => {
  const e = new Engine(); setupPiece(e,'o',0,38.96); e.state.piece.spin='mini'; e.state.piece.rotated=true;
  assert.equal(e.move(-1),false); assert.equal(e.state.piece.spin,'mini');
  e.move(1); assert.equal(e.state.piece.spin,'none');
  const d = new Engine(); d.state.piece.spin='mini'; d.state.piece.rotated=true; d.hardDrop();
  assert.equal(d.state.attack.btb,0); // no-clear does not contribute B2B
  const g = new Engine(); g.state.piece.spin='mini'; g.descend(1); assert.equal(g.state.piece.spin,'none');
});
test('20G spawn and movement ground immediately, Blitz natural branch disabled', () => {
  const e = new Engine({rules:{g:20}}); assert.equal(B.legal(e.state.board,{...e.state.piece,y:e.state.piece.y+1}),false);
  e.move(-1); assert.equal(B.legal(e.state.board,{...e.state.piece,y:e.state.piece.y+1}),false);
  const b = new Engine({mode:'blitz'}); b.state.g=100; assert.equal(b.is20G(),false);
  b.state.input.held.softDrop=true; b.state.handling.sdf=41; assert.equal(b.is20G(),true);
});
test('clutch rescues multiple rows, no-clear blockout remains terminal', () => {
  for(const clear of [true,false]) {
    const e = new Engine(); e.state.board.rows[17].fill('gb'); e.state.board.rows[18].fill('gb'); e.state.lastClear=clear;
    e.spawn('o'); assert.equal(e.state.playing,clear);
    if(clear) assert.ok(e.state.piece.y<=15.96);
  }
});
test('confirmed travel activates at 20F wait after input, same-target waits LIFO', () => {
  const e = new Engine(); const a=e.receive({from:'P2',iid:1,amt:2}), b=e.receive({from:'P3',iid:1,amt:2});
  e.confirm(a); e.confirm(b);
  for(let i=0;i<19;i++) e.step(); assert.ok(e.state.attack.pending.every(p=>!p.active));
  e.trace=[]; e.step(); assert.ok(e.state.attack.pending.every(p=>p.active));
  assert.deepEqual(e.trace.filter(x=>x.type==='wait').map(x=>x.cid),[b,a]);
});
test('continuous ARE insertion is after input/fall and respects bump lock', () => {
  const e = new Engine(); e.state.attack.are.push({amt:2,column:0}); e.state.garbageLockedUntil=2;
  e.step(); assert.equal(e.state.attack.totals.tanked,0);
  e.step(); assert.equal(e.state.attack.totals.tanked,1); assert.equal(e.state.board.rows[39][0],null);
});
test('same seed/rules/input bytes and mid-subframe checkpoints survive future garbage', () => {
  const a = new Engine({seed:42}), b = new Engine({seed:42});
  const cid=a.receive({from:'P2',iid:1,amt:12}); b.receive({from:'P2',iid:1,amt:12}); a.confirm(cid); b.confirm(cid);
  for(let f=0;f<160;f++) {
    const events = f%8===0 ? [event(a,'moveLeft',0.2),event(a,'rotateCW',0.4),event(a,'moveLeft',0.6,'keyup'),event(a,'rotateCW',0.7,'keyup'),event(a,'hardDrop',0.8),event(a,'hardDrop',0.9,'keyup')] : [];
    a.beginFrame(events); if(events.length) a.processNextInput();
    const restored = Engine.restore(a.serialize());
    a.finishFrame(); restored.finishFrame(); b.step(events);
    assert.equal(a.serialize(),restored.serialize(),`restore divergence ${f}`);
    assert.equal(a.serialize(),b.serialize(),`seed divergence ${f}`);
  }
});
