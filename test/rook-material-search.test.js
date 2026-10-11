import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoard,rowFull} from '../src/board.js';
import {explainBoardEvaluation,rookBoardKey} from '../src/analysis/rook.js';
const context={pending:0,btb:0,combo:0,recoveryActive:false};

test('ROOK board transposition must preserve physically distinct garbage materials',()=>{
  const clearable=createBoard();
  const permanent=createBoard();
  clearable.rows[39][3]='t';
  permanent.rows[39][3]='gbd';
  assert.notEqual(rookBoardKey(clearable),rookBoardKey(permanent));
  assert.notEqual(rookBoardKey(createBoard()),rookBoardKey(permanent));
  const ordinary=createBoard();ordinary.rows[39][3]='j';
  assert.equal(rookBoardKey(clearable),rookBoardKey(ordinary),
    'colors of otherwise ordinary filled cells do not change geometry');
  const garbage=createBoard();garbage.rows[39][3]='gb';
  assert.notEqual(rookBoardKey(garbage),rookBoardKey(permanent));
  assert.notEqual(rookBoardKey(garbage),rookBoardKey(ordinary));
});

test('Tetris-ready and construction credit excludes un-clearable rows',()=>{
  const ready=createBoard();
  for(let y=36;y<40;y++)for(let x=0;x<9;x++)ready.rows[y][x]='i';
  assert.equal(explainBoardEvaluation(ready,context).features.tetrisReady,4);
  assert.equal(rowFull([...ready.rows[39].slice(0,9),'i']),true);
  const sealed=structuredClone(ready);
  sealed.rows[39][0]='gbd';
  assert.equal(rowFull([...sealed.rows[39].slice(0,9),'i']),false);
  const clean=explainBoardEvaluation(ready,context);
  const blocked=explainBoardEvaluation(sealed,context);
  assert.equal(blocked.features.tetrisReady,0);
  assert.equal(blocked.features.tetrisConstruction,0);
  assert.ok(clean.features.tetrisConstruction>blocked.features.tetrisConstruction);
  assert.ok(clean.terms.tetrisReady>blocked.terms.tetrisReady);
  // Both positions have exactly the same occupied geometry; only material
  // physics differs. The original evaluator falsely awarded both a Quad.
});
