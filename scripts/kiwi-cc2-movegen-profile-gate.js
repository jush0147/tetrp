import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const root=process.argv[2]??'.cache/cc2-profile-results';
const json=async(arm,file)=>JSON.parse(await readFile(`${root}/${arm}/${file}`,'utf8'));
const rows=async arm=>(await readFile(`${root}/${arm}/rust-output.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
const ref=await rows('reference'),pro=await rows('profile');
assert.equal(ref.length,39);assert.equal(pro.length,39);
assert.deepEqual(await json('reference','cases.json'),await json('profile','cases.json'));
assert.deepEqual(await json('reference','comparisons.json'),await json('profile','comparisons.json'));
assert.equal((await json('reference','summary.json')).mismatches,0);
const measurements=ref.map((r,i)=>{
  const p=pro[i];assert.equal(p.id,r.id);assert.deepEqual(p.moves,r.moves,'profiling must preserve costs and placements');
  assert.equal(r.profile,null);assert.equal(r.timingNs.length,7);assert.deepEqual(p.timingNs,[]);
  assert.equal(p.profile.length,8);assert.ok(p.profile.every(n=>Number.isSafeInteger(n)&&n>=0));
  const [popped,expanded,aboveStackExpanded,sumDropDistance,groundedExpanded,maxQueue,uniqueVisited,landings]=p.profile;
  assert.ok(popped>=expanded&&expanded>=aboveStackExpanded&&expanded>=groundedExpanded);
  assert.equal(landings,p.moves.length);
  return {id:r.id,popped,expanded,stalePops:popped-expanded,airborneExpanded:expanded-groundedExpanded,aboveStackExpanded,
    aboveStackFraction:expanded?aboveStackExpanded/expanded:0,sumDropDistance,groundedExpanded,maxQueue,uniqueVisited,landings,
    referenceMedianNs:[...r.timingNs].sort((a,b)=>a-b)[3]};
});
const total={};for(const field of ['popped','expanded','stalePops','airborneExpanded','aboveStackExpanded','sumDropDistance','groundedExpanded'])
  total[field]=measurements.reduce((n,r)=>n+r[field],0);
await writeFile(`${root}/measurements.json`,JSON.stringify(measurements,null,2));
const summary={status:'movegen-profile-gate-passed',checks:39,mismatches:0,total,
  note:'Read-only profiling; exact placements and soft-drop costs preserved. aboveStack is not a safe-pruning proof. No optimization or strength promotion.'};
await writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
