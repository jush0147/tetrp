import kicks from './data/kicks.json' with { type: 'json' };
import spinTables from './data/spins.json' with { type: 'json' };
import { legal, occupied } from './board.js';
import { kickY } from './physics.js';

export function rotationCandidates(piece, direction, lockresets = 15) {
  if (![1, 2, 3].includes(direction)) throw new RangeError('Rotation must be 1, 2 or 3');
  const r = (piece.r + direction) % 4;
  const raw = { ...piece, r, kick: 0 };
  if (piece.type === 'o') return [raw];
  const offsets = (piece.type === 'i' ? kicks.i_kicks : kicks.kicks)[`${piece.r}${r}`];
  return [raw, ...offsets.map(([dx, dy], kick) => ({ ...raw, x: piece.x + dx, y: kickY(piece.y,dy,0,lockresets,piece.totalRotations), kick }))];
}
export function rotate(board, piece, direction, lockresets = 15) {
  return rotationCandidates(piece, direction, lockresets).find(candidate => legal(board, candidate)) ?? null;
}
export function classifySpin(board, piece, mode = 'all-mini+') {
  const rule = spinTables.spinbonuses_rules[mode];
  if (!rule) throw new TypeError('Unsupported spin mode');
  if (!rule.types?.includes(piece.type)) return 'none';
  const can = (dx, dy) => legal(board, { ...piece, x: piece.x + dx, y: piece.y + dy });
  if (mode === 'stupid') return can(0, 1) ? 'none' : 'full';
  if (!piece.rotated) return 'none';
  const cornerCells = spinTables.cornerTable[piece.type]?.[piece.r];
  let corner = 'none';
  if (cornerCells && !can(0, 1)) {
    const taken = cornerCells.filter(([x, y]) => occupied(board, piece.x + x, piece.y + y));
    if (taken.length >= 3) {
      const facing = taken.filter(cell => cell.slice(2).includes(piece.r)).length;
      corner = piece.type !== 't' || facing === 2 || piece.kick === 3 ? 'full' : 'mini';
    }
  }
  if (mode === 'handheld' || mode === 'T-spins') return corner;
  if (piece.type === 't' && corner !== 'none') return mode === 'mini-only' ? 'mini' : corner;
  if (piece.type === 't' && !['all+', 'all-mini+', 'mini-only', 'T-spins+'].includes(mode)) return 'none';
  const immobile = !can(-1, 0) && !can(1, 0) && !can(0, -1) && !can(0, 1);
  if (!immobile) return 'none';
  return piece.type === 't' || ['all-mini', 'all-mini+', 'mini-only'].includes(mode) ? 'mini' : 'full';
}
