import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('Kiwi KO authority keeps fifth-ply switch opt-in and extra costs separate',()=>{
  const args=['scripts/rook-vs-kiwi.js'];
  const common={...process.env,SEEDS:'67130',SWAP_ROLES:'0',
    MAX_LOCKS:'2',KIWI_NODES:'2000',ROOK_NODES:'6000'};
  for(const on of [false,true]){
    const res=spawnSync(process.execPath,args,{cwd:process.cwd(),encoding:'utf8',
      timeout:30000,env:{...common,ROOK_EXACT_LEAF:on?'1':'0'}});
    assert.equal(res.status,0,res.stderr||res.error?.message);
    const rows=res.stdout.trim().split('\n').map(JSON.parse);
    assert.equal(rows.length,1,'no mirror duplicates');
    const r=rows[0];
    assert.equal(r.seed,67130);
    assert.equal(r.sameSeed,true);
    assert.equal(r.simultaneousLocks,true);
    assert.equal(r.cap,2);
    assert.equal(r.termination,'capped');
    assert.equal(r.scored,false);
    assert.equal(r.winner,null);
    assert.equal(r.nodeBudgets.kiwi,2000);
    const rook=r.slots.find(s=>s.kind==='rook');
    const kiwi=r.slots.find(s=>s.kind==='kiwi');
    assert.ok(rook&&kiwi);
    assert.equal(Object.hasOwn(rook,'leafExtraEvaluated'),on);
    assert.equal(Object.hasOwn(kiwi,'leafExtraEvaluated'),false);
    if(on){
      assert.equal(r.rookExactLeaf,true);
      assert.ok(rook.leafExtraEvaluated>0);
      assert.ok(rook.leafApplied>0);
    }else assert.equal(Object.hasOwn(r,'rookExactLeaf'),false);
  }
});
