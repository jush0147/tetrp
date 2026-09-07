import pieces from '../03_fixtures/TETRIO_STANDARD_PIECES_V19.json' with { type: 'json' };

export function createBoard(width = 10, height = 20, buffer = 20) {
  for (const n of [width, height, buffer]) {
    if (!Number.isInteger(n) || n < 1) throw new RangeError('Invalid board geometry');
  }
  return { width, height, buffer, rows: Array.from({ length: height + buffer }, () => Array(width).fill(null)), lastWasAttack: false };
}
export function occupied(board, x, y) {
  if (!Number.isInteger(x) || !Number.isFinite(y)) throw new TypeError('Invalid position');
  return x < 0 || x >= board.width || y < 0 || Math.ceil(y) >= board.rows.length || board.rows[Math.ceil(y)][x] !== null;
}
export function cells(piece) {
  const matrix = pieces[piece.type]?.matrix;
  if (!matrix || !Number.isInteger(piece.r) || piece.r < 0 || piece.r > 3) throw new TypeError('Unsupported piece');
  return matrix.data[piece.r].map(([x, y]) => [piece.x + x - matrix.dx, piece.y + y - matrix.dy]);
}
export function legal(board, piece) {
  return cells(piece).every(([x, y]) => !occupied(board, x, y));
}
export function commit(board, piece) {
  if (!legal(board, piece)) throw new Error('Cannot commit an illegal piece');
  const positions = cells(piece);
  for (const [x, y] of positions) board.rows[Math.ceil(y)][x] = piece.type;
  board.lastWasAttack = false;
  return positions.every(([, y]) => Math.ceil(y) < board.buffer);
}
export const rowFull = row => row.every(cell => cell !== null && cell !== 'gbd');
export const fullLines = board => board.rows.flatMap((row, y) => rowFull(row) ? [y] : []);
export const empty = board => board.rows.every(row => row.every(cell => cell === null));
export const emptyWithPerma = board => board.rows.every(row => row.every(cell => cell === null || cell === 'gbd'));
export const emptyWithUnclearable = board => board.rows.every(row => row.every(cell => cell === null || cell === 'gbd') || row.every(cell => cell === 'gb' || cell === 'gbd'));
export function removeLines(board, indices) {
  if (new Set(indices).size !== indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= board.rows.length)) throw new RangeError('Invalid line indices');
  for (const i of [...indices].sort((a, b) => b - a)) board.rows.splice(i, 1);
  while (board.rows.length < board.height + board.buffer) board.rows.unshift(Array(board.width).fill(null));
}
export function pushLine(board, hole, { size = 1, material = 'gb', position = 'bottom' } = {}) {
  if (!Number.isInteger(hole) || hole < 0 || hole + size > board.width || !Number.isInteger(size) || size < 1) throw new RangeError('Invalid hole');
  if (!['bottom', 'aboveStack', 'aboveUnclearable', 'abovePerma'].includes(position)) throw new TypeError('Unsupported insertion position');
  if (board.rows[0].every(cell => cell !== null)) return false;
  let index = board.rows.length;
  if (position !== 'bottom') {
    const predicate = position === 'aboveStack' ? row => row.some(c => c !== null)
      : position === 'aboveUnclearable' ? row => row.includes('gbd') : row => row.every(c => c === 'gbd');
    const found = board.rows.findIndex(predicate);
    if (found >= 0) index = found;
  }
  // Insertion above an occupied top row has no documented index-zero policy.
  if (index === 0) throw new Error('Unknown insertion above storage boundary');
  board.rows.shift();
  board.rows.splice(index - 1, 0, Array.from({ length: board.width }, (_, x) => x >= hole && x < hole + size ? null : material));
  board.lastWasAttack = true;
  return true;
}
export function repairAfterGarbage(board, piece) {
  if (legal(board, piece)) return true;
  if (!legal(board, { ...piece, y: piece.y - 1 })) return false;
  piece.y--;
  return true;
}
