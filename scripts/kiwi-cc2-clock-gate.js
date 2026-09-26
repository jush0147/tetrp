import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const root=process.argv[2]??'.cache/cc2-clock-results';
const read=async (arm,file)=>JSON.parse(await readFile(`${root}/${arm}/${file}`,'utf8'));
const b=await read('baseline','comparisons.json'),c=await read('lock-timing','comparisons.json');
assert.deepEqual(await read('baseline','cases.json'),await read('lock-timing','cases.json'));
const fixed=['empty/fractional-multiplier',...['0','4','9'].map(h=>`empty/activation-24-hole-${h}`)];
const remaining=['empty/charged-base3','empty/inactive-head','empty/partial-storage-top'];
assert.equal(b.length,65);assert.equal(c.length,65);
assert.deepEqual(b.filter(r=>r.fields.length).map(r=>r.id).sort(),[...fixed,...remaining].sort());
assert.deepEqual(c.filter(r=>r.fields.length).map(r=>r.id).sort(),remaining.toSorted());
for(let i=0;i<b.length;i++){
  assert.equal(b[i].id,c[i].id);
  if(!fixed.includes(b[i].id))assert.deepEqual(c[i],b[i],`unexpected change: ${b[i].id}`);
}
const summary={status:'clock-correction-gate-passed',checks:65,mismatches:3,fixed,
  remaining,note:'Only four timing cases corrected; not complete model parity or strength evidence'};
await writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
