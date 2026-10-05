import test from 'node:test';
import assert from 'node:assert/strict';
import {patchDag} from '../scripts/kiwi-frontier-shortcut-prepare.js';
test('fail closed on missing or ambiguous transition anchors',()=>{
 assert.throws(()=>patchDag('unrelated source'));
 const source='SelectResult::Advance(next, placement) => {\n                    game_state.advance(next, placement);';
 assert.throws(()=>patchDag(source+source));
 const result=patchDag(source);
 assert.ok(result.indexOf('SelectResult::Advance')<result.indexOf('if !speculate'));
 assert.ok(result.indexOf('return None')<result.indexOf('game_state.advance'));
});
