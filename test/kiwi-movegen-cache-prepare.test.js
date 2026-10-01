import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transformMovegen,transformSnapshot} from '../scripts/kiwi-movegen-cache-prepare.js';
test('isolated transform requires exact anchors and is not double-applied',()=>{
 const source='pub fn find_moves_with_clutch(board: &Board, piece: Piece, allow_clutch: bool) -> Vec<(Placement, u32)> {\n original_body()\n}';
 const transformed=transformMovegen(source);
 assert.ok(transformed.includes('original_body()'));
 assert.throws(()=>transformMovegen('wrong source'));
 // Wrapper still has the public signature; reject reinstrumentation explicitly.
 assert.throws(()=>transformMovegen(transformed));
 const snapshot=transformSnapshot('pub fn analyze_text(text:&str)->Result<Report,String>{\nparse(text)\n}');
 assert.ok(snapshot.includes('let _cache_request'));
 assert.throws(()=>transformSnapshot(snapshot));
});
