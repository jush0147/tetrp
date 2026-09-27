import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.js';
import { fallProbes, kickY } from '../src/physics.js';
import { Reconstruction } from '../src/replay/index.js';
import * as B from '../src/board.js';

const check = e => assert.equal(Number.isInteger(e.state.piece.y), false,
  JSON.stringify({frame:e.state.frame,piece:e.state.piece}));

test('bounded numeric transition sweep preserves noninteger generated heights', () => {
  // Finite boundary coverage, not proof over arbitrary floating-point inputs.
  for (let row=-4;row<=44;row++) for (const fraction of [0.000001,0.04,0.1,0.5,0.96,0.999999]) {
    const y=row+fraction;
    for (const step of [0,0.000001,0.00001,0.004,0.04,0.1,0.9,0.96,1]) {
      assert.equal(Number.isInteger(fallProbes(y,step)[0]),false);
    }
    for (const rotations of [0,30,31,63]) for (let offset=-2;offset<=2;offset++) {
      assert.equal(Number.isInteger(kickY(y,offset,0,15,rotations)),false);
    }
    for (let shift=-40;shift<=40;shift++) assert.equal(Number.isInteger(y+shift),false);
  }
  // A descent that would round to an integer explicitly selects the epsilon side.
  assert.equal(fallProbes(17.96,0.04)[0],18.000001);
});

test('actual Engine operations preserve generated height through rotation history and garbage repair', () => {
  for (let seed=1;seed<=28;seed++) {
    const e=new Engine({seed,handling:{safelock:false}});check(e);
    for (let i=0;i<40;i++) {assert.equal(e.rotate(i%3+1),true);check(e);}
    assert.equal(e.state.piece.totalRotations,40);
    e.move(-1);check(e);e.move(1);check(e);
    assert.equal(e.hold(),true);check(e);
    assert.equal(e.descend(0.04),true);check(e);
    e.slam(true);check(e);
    const before=e.state.piece.y;
    assert.equal(e.insertGarbage(9),true);check(e);
    assert.equal(e.state.piece.y,before-1,'exercise actual garbage collision repair');
    const restored=Engine.restore(e.serialize());check(restored);
    assert.equal(restored.serialize(),e.serialize());
    assert.equal(e.hardDrop(),true);check(e);
  }
});

test('normal frame inputs cover 40x and infinite soft drop with subframes and locking', () => {
  for (const sdf of [40,41]) for (let seed=1;seed<=14;seed++) {
    const e=new Engine({seed,handling:{sdf,safelock:false}});
    for (let frame=0;frame<360&&e.state.playing;frame++) {
      const events=[];
      if(frame===0) events.push({frame,type:'keydown',key:'softDrop',subframe:0.3});
      if(frame<48&&frame%12===0) events.push({frame,type:'keydown',key:'rotateCW',subframe:0.1},
        {frame,type:'keyup',key:'rotateCW',subframe:0.8});
      e.step(events);check(e);
    }
    assert.ok(e.state.stats.pieces>0,'must exercise lock/spawn');
  }
});

test('reconstruction anchor does not inject integer pose; generated fork preserves height', () => {
  const initial=new Engine({seed:42,handling:{safelock:false}}).serialize();
  const events=[{frame:0,type:'anchor',expected:{piece:{y:18}}},
    {frame:1,type:'keydown',key:'rotateCW',subframe:0.2},
    {frame:2,type:'keydown',key:'hardDrop',subframe:0.5}];
  const r=new Reconstruction({schema:'tetrp-timeline/1',id:'height-domain',frames:4,initial,events});
  r.advance();check(r.engine);
  assert.equal(r.engine.state.piece.y,JSON.parse(initial).piece.y);
  assert.ok(r.diagnostics.first);
  r.run();check(r.engine);check(r.fork());
  check(Reconstruction.restore(r.checkpoint()).engine);
});

test('external checkpoint integer heights remain accepted and can change rotation geometry', () => {
  const e=new Engine();e.spawn('i');e.move(-1);e.move(-1);e.move(-1);e.slam(true);
  const s=JSON.parse(e.serialize());s.piece.y=38;s.piece.hy=38;
  const integer=Engine.restore(JSON.stringify(s));
  s.piece.y=37.96;const fractional=Engine.restore(JSON.stringify(s));
  const cells=e=>B.cells(e.state.piece).map(([x,y])=>[x,Math.ceil(y)]);
  assert.deepEqual(cells(integer),cells(fractional));
  assert.equal(integer.rotate(1),true);assert.equal(fractional.rotate(1),true);
  assert.notDeepEqual(cells(integer),cells(fractional));
});
