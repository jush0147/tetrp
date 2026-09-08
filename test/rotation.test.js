import test from 'node:test';
import assert from 'node:assert/strict';
import kicks from '../src/data/kicks.json' with { type: 'json' };
import spinTables from '../src/data/spins.json' with { type: 'json' };
import { createBoard, cells, legal } from '../src/board.js';
import { rotationCandidates, rotate, classifySpin } from '../src/rotation.js';

// Construct obstacles which reject every earlier candidate while preserving
// the chosen candidate. This tests ordered selection against actual geometry.
for (const type of 'zlsijt') for (let r = 0; r < 4; r++) for (const d of [1, 2, 3]) {
  test(`SRS+ ${type} ${r}->${(r + d) % 4}`, () => {
    const p = { type, x: 4, y: 25.96, r, totalRotations: 0 };
    const candidates = rotationCandidates(p, d);
    const table = type === 'i' ? kicks.i_kicks : kicks.kicks;
    assert.deepEqual(candidates.slice(1).map(c => [c.x - p.x, Math.round((c.y - 25.1) * 10) / 10]), table[`${r}${(r + d) % 4}`]);
    for (let i = 0; i < candidates.length; i++) {
      const b = createBoard();
      const desired = new Set(cells(candidates[i]).map(([x, y]) => `${x},${Math.ceil(y)}`));
      let feasible = true;
      for (const earlier of candidates.slice(0, i)) {
        const block = cells(earlier).find(([x, y]) => !desired.has(`${x},${Math.ceil(y)}`));
        if (!block) { feasible = false; break; }
        b.rows[Math.ceil(block[1])][block[0]] = 'gb';
      }
      if (feasible) assert.deepEqual(rotate(b, p, d), candidates[i]);
    }
  });
}
test('O never kicks and failed rotation leaves original untouched', () => {
  const b = createBoard(), p = { type: 'o', x: 4, y: 30, r: 0 };
  assert.equal(rotationCandidates(p, 1).length, 1);
  b.rows[30][4] = 'gb'; assert.equal(rotate(b, p, 1), null); assert.equal(p.r, 0);
});
for (const r of [0, 1, 2, 3]) test(`T corner orientation ${r}`, () => {
  const p = { type: 't', x: 4, y: 30, r, rotated: true, kick: 0 };
  const corners = spinTables.cornerTable.t[r];
  for (let missing = 0; missing < 4; missing++) {
    const b = createBoard();
    corners.forEach(([x, y], i) => { if (i !== missing) b.rows[30 + y][4 + x] = 'gb'; });
    // Supply a floor below the geometry, without occupying any active mino.
    const bottom = Math.max(...cells(p).map(([, y]) => y)); b.rows[bottom + 1].fill('gb');
    assert.equal(legal(b, p), true);
    const actualTaken = corners.filter(([x,y]) => b.rows[30+y][4+x] !== null);
    const full = actualTaken.filter(c => c.slice(2).includes(r)).length === 2;
    assert.equal(classifySpin(b, p), full ? 'full' : 'mini');
    assert.equal(classifySpin(b, { ...p, kick: 3 }), 'full');
    assert.equal(classifySpin(b, { ...p, rotated: false }), 'none');
  }
});
for (const mode of Object.keys(spinTables.spinbonuses_rules)) for (const type of 'zlosijt') test(`spin eligibility ${mode}/${type}`, () => {
  const b = createBoard(), p = { type, x: 4, y: 30, r: 0, rotated: true, kick: 0 };
  b.rows.forEach(row => row.fill('gb'));
  for (const [x, y] of cells(p)) b.rows[y][x] = null;
  const eligible = spinTables.spinbonuses_rules[mode].types?.includes(type) ?? false;
  const value = classifySpin(b, p, mode);
  assert.equal(value !== 'none', eligible);
  if (eligible && type !== 't' && ['all-mini', 'all-mini+', 'mini-only'].includes(mode)) assert.equal(value, 'mini');
});
