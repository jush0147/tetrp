import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const root=process.argv[2]??'.cache/cc2-storage-results';
const read=async (arm,file)=>JSON.parse(await readFile(`${root}/${arm}/${file}`,'utf8'));
const b=await read('queue-scan','comparisons.json'),c=await read('storage','comparisons.json');
assert.deepEqual(await read('queue-scan','cases.json'),await read('storage','cases.json'));
const fixed=['empty/partial-storage-top','empty/storage-nine-garbage','empty/storage-cap-eight','empty/storage-second-row'];
assert.equal(b.length,72);assert.equal(c.length,72);
assert.deepEqual(b.filter(r=>r.fields.length).map(r=>r.id).sort(),fixed.toSorted());
assert.deepEqual(c.filter(r=>r.fields.length),[]);
for(let i=0;i<b.length;i++){
  assert.equal(b[i].id,c[i].id);
  if(!fixed.includes(b[i].id))assert.deepEqual(c[i],b[i],`unexpected change: ${b[i].id}`);
}
const summary={status:'storage-correction-gate-passed',checks:72,mismatches:0,fixed,
  notCertified:['failed-insertion pending (known separate bug)','movegen','Hold','spawn/KO','strength'],
  note:'Zero mismatches in this 72-case suite only; failed-insertion bug intentionally remains'};
await writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
