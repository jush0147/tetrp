import test from 'node:test';
import assert from 'node:assert/strict';
import vectors from '../03_fixtures/TETRIO_FALL_SOFTDROP_ANTISTALL_TEST_VECTORS_V19.json' with { type: 'json' };
import levels from '../03_fixtures/TETRIO_BLITZ_LEVEL_TABLE_V19.json' with { type: 'json' };
import presets from '../03_fixtures/TETRIO_SOLO_MODE_PRESETS_V19.json' with { type: 'json' };
import finesse from '../03_fixtures/TETRIO_FINESSE_TABLE_V19.json' with { type: 'json' };
import { fallProbes, effectiveGravity, softDropBudget, antiStallExtra, kickY } from '../src/physics.js';
import { blitzGravity, blitzLines, ruleset } from '../src/rules.js';
import { Engine } from '../src/engine.js';
const near = (a,b) => assert.ok(Math.abs(a-b) <= 1e-12 * Math.max(1,Math.abs(b)), `${a} != ${b}`);
for (const v of vectors.fall_precision) test(v.name, () => {
  const [candidate,probe] = fallProbes(v.current_y,v.requested_step);
  near(candidate,v.expected_candidate_y); near(probe,v.expected_probe_y);
  assert.equal(Math.ceil(candidate),v.expected_candidate_ceil_row); assert.equal(Math.ceil(probe),v.expected_probe_ceil_row);
});
for (const v of vectors.softdrop_budget) test(v.name, () => near(softDropBudget(v.effective_g,v.dt,v.sdf),v.expected_budget));
for (const v of vectors.anti_stall_extra) test(v.name, () => {
  const value = antiStallExtra(v.lockresets,v.rotresets,v.dt);
  near(value,v.expected_extra_budget); assert.equal(value > 0,v.expected_should_fall_faster);
  assert.equal(antiStallExtra(v.lockresets,v.rotresets,v.dt,true),0);
});
for (const v of vectors.kick_y_base) test(v.name, () => near(kickY(v.current_y,v.kick_y,v.rotation_offset_delta_y,v.lockresets,v.total_rotations),v.expected_y));
for (const v of levels.levels) test(`Blitz level ${v.level}`, () => {
  near(blitzGravity(v.level),v.g_cells_per_frame); near(blitzGravity(v.level)*60,v.nominal_cells_per_second);
  assert.equal(blitzLines(v.level),v.lines_needed);
  const e = new Engine({mode:'blitz'}); e.state.g = blitzGravity(v.level);
  assert.equal(e.is20G(),v.natural_20g_special_path_enabled);
});
for (const mode of ['40l','blitz']) test(`solo preset ${mode}`, () => {
  const r = ruleset(mode);
  for (const [key,value] of Object.entries(presets[mode])) assert.deepEqual(r[key],value);
});
test('gravity lock interpolation and sampling before decrement', () => {
  assert.equal(effectiveGravity(2,181),0); assert.equal(effectiveGravity(2,180),0);
  assert.equal(effectiveGravity(2,90),0.5); assert.equal(effectiveGravity(2,0),2);
  const e = new Engine({rules:{g:2}}); e.state.glock = 90;
  e.fall(0.4); near(e.state.piece.y,18.16); near(e.state.glock,89.6);
});
test('finite soft-drop call floor differs across subframe splits', () => {
  const a = new Engine(), b = new Engine();
  a.state.input.held.softDrop = b.state.input.held.softDrop = true;
  a.fall(1); b.fall(0.4); b.fall(0.6);
  near(a.state.piece.y,18.26); near(b.state.piece.y,18.56);
});
test('second probe blocks a small legal candidate above an occupied next row', () => {
  const e = new Engine(); Object.assign(e.state.piece,{type:'o',y:20.1});
  e.state.board.rows[22][4] = 'gb';
  assert.equal(e.descend(0.1),false); near(e.state.piece.y,20.1);
});
test('anti-stall uses rotresets, totalRotations survives new low', () => {
  const e = new Engine({rules:{g:0}}); Object.assign(e.state.piece,{rotationResets:35,totalRotations:50});
  e.fall(0.4); near(e.state.piece.y,18.96); assert.equal(e.state.piece.rotationResets,0);
  assert.equal(e.state.piece.totalRotations,50);
});
// Finesse table is preserved as reference data. The handoff does not specify
// destination-index mapping; validating shape does not claim stats parity.
test('finesse fixture has complete standard piece/rotation domains', () => {
  assert.deepEqual(Object.keys(finesse).sort(),[...'zlosijt'].sort());
  for (const rows of Object.values(finesse)) {
    assert.deepEqual(Object.keys(rows),['0','1','2','3']);
    for (const row of Object.values(rows)) {
      assert.equal(row.length,11); assert.ok(row.every(n => Number.isInteger(n) && n >= 0 && n <= 9));
    }
  }
});
