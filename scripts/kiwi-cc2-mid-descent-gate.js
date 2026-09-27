import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const root=process.argv[2]??'.cache/cc2-descent-results';
const json=async(arm,file)=>JSON.parse(await readFile(`${root}/${arm}/${file}`,'utf8'));
const b=await json('baseline','comparisons.json'),c=await json('candidate','comparisons.json');
assert.equal(b.length,39);assert.equal(c.length,39);
assert.deepEqual(await json('baseline','cases.json'),await json('candidate','cases.json'));
const witness='overhang/j/false';
assert.deepEqual(b.slice(0,27).filter(x=>x.authorityOnly.length||x.cc2Only.length).map(x=>x.id),[witness]);
assert.equal(b.find(x=>x.id===witness).authorityOnlyCells.length,1);
for(let i=0;i<27;i++)if(b[i].id!==witness)assert.deepEqual(c[i],b[i]);
const rows=async arm=>(await readFile(`${root}/${arm}/rust-output.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
const br=await rows('baseline'),cr=await rows('candidate');
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const performance=br.map((x,i)=>{
  assert.equal(x.id,cr[i].id);
  const a=median(x.timingNs),d=median(cr[i].timingNs);
  const costs=new Map(x.moves.map(m=>[JSON.stringify(m.placement),m.softDrops]));
  const changed=cr[i].moves.filter(m=>costs.has(JSON.stringify(m.placement))&&costs.get(JSON.stringify(m.placement))!==m.softDrops);
  return {id:x.id,baselineMedianNs:a,candidateMedianNs:d,ratio:a?d/a:null,
    changedSoftDropCosts:changed.map(m=>({placement:m.placement,before:costs.get(JSON.stringify(m.placement)),after:m.softDrops}))};
});
await writeFile(`${root}/performance.json`,JSON.stringify(performance,null,2));
const mismatches=c.filter(x=>x.authorityOnly.length||x.cc2Only.length);
const summary={status:mismatches.length?'mid-descent-gate-failed':'mid-descent-gate-passed',checks:c.length,mismatches:mismatches.length,
  baselineMismatches:b.filter(x=>x.authorityOnly.length||x.cc2Only.length).length,
  missingLandingRecovered:!c.find(x=>x.id===witness).authorityOnly.length,
  medianNonemptyKernelRatio:median(performance.filter((x,i)=>br[i].moves.length).map(x=>x.ratio)),
  changedSoftDropCosts:performance.reduce((n,x)=>n+x.changedSoftDropCosts.length,0),
  note:'Intermediate-descent geometry candidate only. Native kernel timing, not browser acceptance; soft-drop cost changes recorded. No strength claim.'};
await writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
assert.equal(mismatches.length,0,'candidate has landing-set differences; inspect artifacts before retention');
