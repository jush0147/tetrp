import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('actual synchronous Kiwi KO authority records clear types without affecting scoring',()=>{
  const run=spawnSync(process.execPath,['scripts/rook-vs-kiwi.js'],{
    cwd:process.cwd(),env:{...process.env,SEEDS:'67113',MAX_LOCKS:'8',
      SWAP_ROLES:'0',ROOK_NODES:'120',KIWI_NODES:'2000'},
    encoding:'utf8',timeout:30000});
  assert.equal(run.status,0,run.stderr||run.error?.message);
  const rows=run.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,1);
  const r=rows[0];
  assert.equal(r.sameSeed,true);
  assert.equal(r.simultaneousLocks,true);
  assert.equal(r.cap,8);
  assert.equal(r.lockSteps,8);
  assert.equal(r.scored,false);
  assert.equal(r.termination,'capped');
  for(const slot of r.slots){
    const e=slot.combatEvents;
    assert.ok(e&&typeof e==='object');
    for(const key of ['fullTss','fullTsd','fullTst','miniClears','quads',
      'ordinarySingles','ordinaryDoubles','ordinaryTriples','allClears','maxBtb']){
      assert.ok(Number.isInteger(e[key])&&e[key]>=0,key);
    }
    assert.ok(e.allClears<=slot.pieces);
    assert.ok(e.fullTss+e.fullTsd+e.fullTst+e.miniClears+e.quads+
      e.ordinarySingles+e.ordinaryDoubles+e.ordinaryTriples<=slot.pieces);
  }
});
