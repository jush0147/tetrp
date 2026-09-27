import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.argv[2]??'.cache';
const read=async p=>JSON.parse(await readFile(`${root}/${p}`,'utf8'));
const suites={};
for(const [name,path,count]of [
  ['transition','cc2-transition-results',72],['lifecycle','cc2-spawn-results',141],
  ['snapshotHold','cc2-snapshot-hold-results',30],['rotation','cc2-rotation-results',1746],['movegen','cc2-air-results',43]]){
  const s=await read(`${path}/summary.json`);assert.equal(s.checks,count,name);assert.equal(s.mismatches,0,name);suites[name]=s;
}
assert.deepEqual(await read('cc2-transition-results/failed-insert-boundaries.json'),await read('cc2-combined-results/authority-boundaries.json'));
const transitions=await read('cc2-transition-results/comparisons.json');assert.equal(transitions.length,72);assert.ok(transitions.every(c=>c.fields.length===0));
const files=['src/data.rs','src/lib.rs','src/forecast.rs','src/movegen.rs','src/bot.rs','src/bot/freestyle.rs','src/snapshot.rs'];
const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(`${root}/cc2-transition-source/${f}`)).digest('hex')])));
const dest=`${root}/cc2-combined-results`;await mkdir(dest,{recursive:true});
await writeFile(`${dest}/combined.patch`,execFileSync('git',['-C',`${root}/cc2-transition-source`,'diff','--','src'],{encoding:'utf8',maxBuffer:16*1024*1024}));
await writeFile(`${dest}/manifest.json`,JSON.stringify({pin:'2e243242b674d57491f99b445f75e35fc48a0e26',hashes,suites},null,2));
const summary={status:'combined-correctness-gates-passed',checks:72+6+141+30+1746+43,mismatches:0,
  note:'One pinned build combines four transaction corrections, mid-descent, air cache, spawn lineage and snapshot Hold checks. Finite suites only; multi-placement DAG/authority trace, browser and strength remain unverified.'};
await writeFile(`${dest}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
