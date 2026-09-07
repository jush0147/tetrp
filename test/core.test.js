import test from 'node:test';
import assert from 'node:assert/strict';
import vectors from '../03_fixtures/TETRIO_BOARD_CORE_TEST_VECTORS_V19.json' with { type: 'json' };
import definitions from '../03_fixtures/TETRIO_STANDARD_PIECES_V19.json' with { type: 'json' };
import * as board from '../src/board.js';
import { createBag, pullBag, populateBag, createHoles, nextHole, completePacket } from '../src/random.js';

for (const v of vectors.occupancy_vectors) test(`occupancy: ${v.name}`, () => {
  const b = board.createBoard();
  if ('mapped_row' in v) {
    b.rows[v.mapped_row][v.x] = 't';
    assert.equal(board.occupied(b, v.x, v.y), true);
    b.rows[v.mapped_row][v.x] = null;
    assert.equal(board.occupied(b, v.x, v.y), false);
  } else assert.equal(board.occupied(b, v.x, v.y), v.expected_occupied);
});
for (const v of vectors.full_line_vectors) test(`line: ${v.name}`, () => assert.equal(board.rowFull(v.row), v.expected_full));
for (const v of vectors.empty_predicate_vectors) test(`empty: ${v.name}`, () => {
  const b = board.createBoard(); b.rows.splice(-v.rows.length, v.rows.length, ...structuredClone(v.rows));
  assert.equal(board.empty(b), v.strict_empty);
  assert.equal(board.emptyWithPerma(b), v.empty_with_perma);
  assert.equal(board.emptyWithUnclearable(b), v.empty_with_unclearable);
});
for (const [type, { matrix }] of Object.entries(definitions)) for (let r = 0; r < 4; r++) test(`piece ${type}/${r}: pivot, collision and commit`, () => {
  const b = board.createBoard(), p = { type, x: 4, y: 17.96, r };
  const expected = matrix.data[r].map(([x, y]) => [4 + x - matrix.dx, Math.ceil(17.96 + y - matrix.dy)]);
  assert.equal(board.legal(b, p), true);
  assert.equal(board.commit(b, p), expected.every(([, y]) => y < 20));
  assert.equal(board.legal(b, p), false);
  assert.equal(b.rows.flat().filter(Boolean).length, 4);
  for (const [x, y] of expected) assert.equal(b.rows[y][x], type);
});
test('board mutations preserve row count and stable row order', () => {
  const b = board.createBoard(); b.rows[20][0] = 't'; b.rows[38].fill('gb'); b.rows[39].fill('i');
  board.removeLines(b, board.fullLines(b));
  assert.equal(b.rows.length, 40); assert.equal(b.rows[22][0], 't');
  assert.equal(board.pushLine(b, 4), true); assert.equal(b.rows.length, 40);
  assert.equal(b.rows[21][0], 't'); assert.equal(b.rows[39][4], null); assert.equal(b.lastWasAttack, true);
  b.rows[0][0] = 'j'; assert.equal(board.pushLine(b, 0), true);
  b.rows[0].fill('gbd'); assert.equal(board.pushLine(b, 0), false);
});
test('garbage repair moves at most one row, no stale collision cache', () => {
  const b = board.createBoard(), p = { type: 'o', x: 4, y: 39, r: 0 };
  assert.equal(board.legal(b, p), true); board.pushLine(b, 0);
  assert.equal(board.repairAfterGarbage(b, p), true); assert.equal(p.y, 38);
  board.pushLine(b, 0); board.pushLine(b, 0);
  assert.equal(board.repairAfterGarbage(b, p), false); assert.equal(p.y, 38);
});
const bags = { 1: ['ojilstz','toljsiz','lisotzj'], 42: ['otiljsz','ijzlost','ijszlot'], 12345: ['lostijz','loztisj','ostzjil'], 2147483646: ['zsioljt','osizjlt','osztijl'] };
for (const [seed, expected] of Object.entries(bags)) test(`seeded bag ${seed}`, () => {
  const s = createBag(Number(seed)); populateBag(s); populateBag(s);
  assert.equal(s.queue.join(''), expected.join(''));
});
test('prefill advances RNG ahead of visible next', () => {
  const s = createBag(1); assert.equal(s.queue.length, 7);
  assert.equal(pullBag(s), 'o'); assert.equal(s.queue.length, 13); assert.equal(s.bagId, 2);
  assert.equal(pullBag(s), 'j'); assert.equal(s.queue.length, 19); assert.equal(s.bagId, 3);
});
test('hole RNG distinguishes cancellation, partial tank, completion and explicit columns', () => {
  const a = createHoles(12345), b = createHoles(12345);
  const cols = Array.from({ length: 4 }, () => nextHole(a)); completePacket(a); completePacket(b);
  assert.equal(new Set(cols).size, 1); assert.notEqual(a.rng.seed, b.rng.seed);
  const before = a.rng.seed; assert.equal(nextHole(a, 10, 3), 3); assert.equal(a.rng.seed, before);
});
