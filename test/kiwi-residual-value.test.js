import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transformFreestyle,transformForecast} from '../scripts/kiwi-residual-value-prepare.js';
test('source preparation rejects missing anchors',()=>{
 assert.throws(()=>transformFreestyle('changed source',''));
 assert.throws(()=>transformForecast('changed source'));
});
test('candidate adds no transition, move generation or node charging in production helper',async()=>{
 const s=(await readFile('tools/cc2-eval-audit/residual_value.rs','utf8')).split('#[cfg(all(test,residual_value))]')[0];
 assert.ok(!/\.advance\(|find_moves|\.resolve\(|\.bag\b/.test(s));
 assert.ok(s.includes('residual_base'));assert.ok(s.includes('residual_due'));
});
