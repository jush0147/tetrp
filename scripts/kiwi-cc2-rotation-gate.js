import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const root=process.argv[2]??'.cache/cc2-rotation-results';
const read=async f=>JSON.parse(await readFile(`${root}/${f}`,'utf8'));
const a=await read('reference/comparisons.json'),b=await read('candidate/comparisons.json');
const coverage=await read('reference/coverage.json');
if(coverage.visitedPrefixes!==undefined){
  assert.equal(coverage.exactIntegerPoses,0);
  assert.equal(coverage.authorityDropCertificateDisagreements,0);
  assert.ok(coverage.historyAbove30&&coverage.historyAt30&&coverage.kick3&&coverage.rotate180);
}
assert.equal(a.length,coverage.cases);assert.deepEqual(b,a,'air cache must not change rotation primitives');
assert.deepEqual(await read('reference/cases.json'),await read('candidate/cases.json'));
const regression=JSON.parse(await readFile('.cache/cc2-air-results/summary.json','utf8'));
assert.equal(regression.mismatches,0);assert.equal(regression.checks,43);
const mismatches=a.filter(c=>c.fields.length),fields={};
for(const row of mismatches)for(const f of row.fields)fields[f]=(fields[f]??0)+1;
await writeFile(`${root}/mismatches.json`,JSON.stringify(mismatches));
const summary={status:'rotation-diagnostic-completed',checks:a.length,mismatches:mismatches.length,fields,coverage,
  cacheDifferences:0,movegenRegressionChecks:43,
  note:`Rotation primitive diagnostic, NOT parity promotion. Corpus: ${coverage.visitedPrefixes!==undefined?'spawn-reachable paths on supplied boards':'conditional poses'}. ${coverage.authorityDropCertificateDisagreements} authority drop/certificate disagreements; no physical-timing or strength claim.`};
await writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
