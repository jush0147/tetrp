import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Engine} from '../src/engine.js';
import {tank} from '../src/attack.js';
import {pushLine} from '../src/board.js';

// Primitive boundaries, not ordinary playable snapshots: full rows here are
// deliberate insertion failure fixtures. No KO or movegen certification.
export function authorityBoundaries(){
  const rows=[];
  for(let depth=0;depth<3;depth++)for(const middle of [false,true]){
    const e=new Engine(),s=e.state;s.board.rows[depth].fill('j');
    const incoming=middle?[[2,49],[1,0],[4,0]]:[[5,0]];
    s.attack.pending=incoming.map(([amt,ready],i)=>({amt,ready,column:3*i,
      active:ready<=23,status:'spawn',shielded:false}));
    let blocked=false;
    const tanked=tank(s.attack,s.rules,s.holes,h=>{
      const ok=pushLine(s.board,h);if(!ok)blocked=true;return ok;
    });
    assert.equal(tanked,depth);assert.equal(blocked,true);
    const cols=Array.from({length:10},(_,x)=>s.board.rows.reduce((c,row,y)=>row[x]===null?c:c|(1n<<BigInt(39-y)),0n).toString());
    const garbageRows=s.board.rows.reduce((c,row,y)=>row.includes('gb')?c|(1n<<BigInt(39-y)):c,0n).toString();
    rows.push({id:`depth-${depth}-middle-${middle}`,cols,garbageRows,blocked,tanked,
      pending:s.attack.pending.map(p=>({amt:p.amt,ready:p.ready,hole:p.column}))});
  }
  return rows;
}
const root=process.argv[2]??'.cache/cc2-failed-insert-results';
await mkdir(root,{recursive:true});
const expected=authorityBoundaries();
await writeFile(`${root}/authority-boundaries.json`,JSON.stringify(expected,null,2));
if(process.argv[3]!=='prepare'){
  const read=async (arm,file)=>JSON.parse(await readFile(`${root}/${arm}/${file}`,'utf8'));
  const b=await read('storage','comparisons.json'),c=await read('failed-insert','comparisons.json');
  assert.equal(b.length,72);assert.equal(c.length,72);
  assert.deepEqual(await read('storage','cases.json'),await read('failed-insert','cases.json'));
  assert.deepEqual(c,b);assert.deepEqual(c.filter(r=>r.fields.length),[]);
  const old=structuredClone(expected);
  for(const row of old){
    const i=row.pending.findIndex(p=>p.ready<=23);
    assert.ok(i>=0);if(--row.pending[i].amt===0)row.pending.splice(i,1);
  }
  assert.deepEqual(await read('storage','failed-insert-boundaries.json'),old);
  assert.deepEqual(await read('failed-insert','failed-insert-boundaries.json'),expected);
  const summary={status:'failed-insert-gate-passed',checks:78,mismatches:0,
    unchangedPlacementFixtures:72,fixedPrimitiveBoundaries:6,
    note:'72 placement fixtures unchanged; 6 primitive failure boundaries corrected. Not movegen, Hold, spawn/KO or strength certification.'};
  await writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary));
}else console.log('Six authority primitive boundaries generated.');
