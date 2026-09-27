import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const root=process.argv[2]??'.cache/cc2-air-results';
const json=async(arm,file)=>JSON.parse(await readFile(`${root}/${arm}/${file}`,'utf8'));
const rows=async arm=>(await readFile(`${root}/${arm}/rust-output.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
const ref=await rows('reference'),candidate=await rows('candidate'),shared=await rows('shared-cache');
assert.equal(ref.length,43);assert.equal(candidate.length,43);assert.equal(shared.length,43);
const expected=await json('reference','cases.json');
assert.equal((await json('reference','summary.json')).mismatches,0);
for(const arm of ['candidate','shared-cache'])assert.deepEqual(await json(arm,'cases.json'),expected);
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
const failures=[],performance=[];
for(let i=0;i<ref.length;i++){
  const a=ref[i],b=candidate[i],s=shared[i];assert.equal(a.id,b.id);assert.equal(a.id,s.id);
  for(const [arm,row] of [['candidate',b],['shared-cache',s]]){
    try{assert.deepEqual(row.moves,a.moves);}catch{failures.push({id:a.id,arm,expected:a.moves,actual:row.moves});}
  }
  assert.equal(a.timingNs.length,7);assert.equal(b.timingNs.length,7);
  const x=median(a.timingNs),y=median(b.timingNs);
  performance.push({id:a.id,nonempty:a.moves.length>0,referenceMedianNs:x,warmMedianNs:y,warmRatio:y/x,
    candidateColdNs:b.firstCallNs,referenceFirstNs:a.firstCallNs,cache:b.airCache,sharedCache:s.airCache});
}
await writeFile(`${root}/parity-failures.json`,JSON.stringify(failures,null,2));
await writeFile(`${root}/performance.json`,JSON.stringify(performance,null,2));
const ratios=performance.filter(p=>p.nonempty).map(p=>p.warmRatio);
const summary={status:failures.length?'air-prefix-parity-failed':'air-prefix-parity-passed',checks:43,mismatches:failures.length,
  medianWarmRatio:median(ratios),maxSharedCacheEntries:Math.max(...performance.map(p=>p.sharedCache?.[0]??0)),
  maxSharedPayloadBytes:Math.max(...performance.map(p=>p.sharedCache?.[1]??0)),
  note:'Empty-air cache candidate: exact placement/spin/soft-drop cost parity required. Cold and warm costs separate; payload excludes allocator overhead. No browser or strength promotion.'};
await writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
assert.equal(failures.length,0,'candidate changed full-reference placements or costs');
for(const arm of ['candidate','shared-cache'])assert.equal((await json(arm,'summary.json')).mismatches,0);
