import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const root=process.argv[2]??'.cache/cc2-queue-results';
const read=async (arm,file)=>JSON.parse(await readFile(`${root}/${arm}/${file}`,'utf8'));
const b=await read('lock-timing','comparisons.json'),c=await read('queue-scan','comparisons.json');
assert.deepEqual(await read('lock-timing','cases.json'),await read('queue-scan','cases.json'));
const fixed=['empty/charged-base3','empty/inactive-head','empty/queue-partial-middle','empty/queue-complete-middle'];
const remaining=['empty/partial-storage-top'];
assert.equal(b.length,69);assert.equal(c.length,69);
assert.deepEqual(b.filter(r=>r.fields.length).map(r=>r.id).sort(),[...fixed,...remaining].sort());
assert.deepEqual(c.filter(r=>r.fields.length).map(r=>r.id).sort(),remaining);
for(let i=0;i<b.length;i++){
  assert.equal(b[i].id,c[i].id);
  if(!fixed.includes(b[i].id))assert.deepEqual(c[i],b[i],`unexpected change: ${b[i].id}`);
}
const summary={status:'queue-correction-gate-passed',checks:69,mismatches:1,fixed,remaining,
  note:'Queue scan corrected; timing preserved; storage bug remains; not complete parity or strength evidence'};
await writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
