import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyze} from '../src/analysis/native/search.js';
import {auditSearch} from '../scripts/kiwi-audit-search.js';

for(const name of ['g1-f120','g1-f168','g1-f912','g3-f1032','g3-f1056']){
  test('diagnostic observer preserves production search: '+name,async()=>{
    const data=JSON.parse(await readFile(new URL('../docs/audits/kiwi-ft7-35765171232/'+name+'.json',import.meta.url),'utf8'));
    const snapshot=structuredClone(data.snapshot),original=analyze(snapshot),audit=await auditSearch(snapshot);
    assert.deepEqual(snapshot,data.snapshot,'observer/search must not mutate public input');
    for(const key of ['candidates','nodes','completedDepth','completion','geometryStates','ttHits','ttEntries'])
      assert.deepEqual(audit.report[key],original[key],key);
    assert.deepEqual(original.candidates[0].move,data.originalTop1.move);
    assert.equal(original.candidates[0].score,data.originalTop1.score);
    assert.equal(data.sourceHash,'17135cfa08518158f2dc798fbd8228a39143e5999160f23f995ed86f07373300','historical fixture provenance');
    assert.match(audit.sourceHash,/^[0-9a-f]{64}$/); // Current source adds an opt-in read-only capture hook.
    assert.equal(audit.beams.length,data.search.beams.length);
    assert.deepEqual(audit.discarded,data.search.discarded);
  });
}
