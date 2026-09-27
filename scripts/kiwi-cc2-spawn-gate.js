import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const root=process.argv[2]??'.cache/cc2-spawn-results';
const read=async p=>JSON.parse(await readFile(`${root}/${p}`,'utf8'));
const a=await read('reference/comparisons.json'),b=await read('candidate/comparisons.json');
assert.equal(a.length,141);assert.equal(b.length,a.length);
assert.deepEqual(await read('reference/cases.json'),await read('candidate/cases.json'));
let fixed=0;
for(let i=0;i<a.length;i++){
  assert.equal(a[i].id,b[i].id);assert.deepEqual(b[i].fields,[]);
  if(a[i].fields.length){
    assert.ok(a[i].fields.every(f=>['holdRescuesTerminalSpawn','terminalTryPlayAccepted'].includes(f)));
    assert.equal(a[i].expected.spawnAlive,false);fixed++;
  }else assert.deepEqual(b[i],a[i],'passing lifecycle results must remain unchanged');
}
assert.ok(fixed>=6);const summary={status:'spawn-terminal-paired-gate-passed',checks:b.length,mismatches:0,fixed,
  note:'Conditional lifecycle and direct API parity. Empty-Hold lineage represented; no complete DAG, snapshot reanalysis, browser or strength certification.'};
await writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
