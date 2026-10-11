import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// This is deliberately a 1-lock protocol smoke, not a claim about playing
// strength. Real strength trials always run KO-first with cap 2000.
const env={...process.env,SEEDS:'67020,67024',SWAP_ROLES:'0',
  ROOK_NODES:'80',KIWI_NODES:'2000',MAX_LOCKS:'1',ROOK_DIAG:'0'};

test('Kiwi-vs-ROOK consumes independent seeds once without role duplication',()=>{
  const run=spawnSync(process.execPath,['scripts/rook-vs-kiwi.js'],{
    env,cwd:process.cwd(),encoding:'utf8',timeout:120000});
  assert.equal(run.status,0,run.stderr);
  const rows=run.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>r.seed),[67020,67024]);
  assert.deepEqual(rows.map(r=>r.order),[0,0]);
  for(const row of rows){
    assert.equal(row.sameSeed,true);
    assert.equal(row.simultaneousLocks,true);
    assert.deepEqual(row.kinds,['rook','kiwi']);
    assert.equal(row.seeds[0],row.seeds[1]);
    assert.equal(row.lockSteps,1);
    assert.equal(row.cap,1);
    assert.equal(row.scored,row.termination==='KO');
  }
});
