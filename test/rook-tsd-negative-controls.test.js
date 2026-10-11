import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('actual public pre-lock trace never leaks authority secrets and labels match commits',()=>{
  const dir=mkdtempSync(join(tmpdir(),'rook-public-lock-'));
  try{
    const trace=join(dir,'locks.jsonl'),analysis=join(dir,'audit.json');
    const run=spawnSync(process.execPath,['scripts/rook-vs-kiwi.js'],{
      cwd:process.cwd(),encoding:'utf8',timeout:45000,
      env:{...process.env,SEEDS:'67131',SWAP_ROLES:'0',
        KIWI_NODES:'2000',ROOK_NODES:'6000',ROOK_EXACT_LEAF:'1',
        MAX_LOCKS:'5',ROOK_PUBLIC_LOCK_TRACE_PATH:trace}
    });
    assert.equal(run.status,0,run.stderr||run.error?.message);
    const report=JSON.parse(run.stdout.trim());
    assert.equal(report.lockSteps,5);
    assert.equal(report.scored,false);
    assert.equal(report.termination,'capped');
    const lines=readFileSync(trace,'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(lines.length,10);
    for(const row of lines){
      assert.ok(['kiwi','rook'].includes(row.kind));
      assert.deepEqual(Object.keys(row.visible).sort(),[
        'attack','board','current','frame','hold','next',
        'piecesPlaced','playing','rules']);
      assert.equal(row.visible.next.length,5);
      assert.equal(row.outcome.fullTsd,
        row.outcome.piece==='t'&&row.outcome.spin==='full'&&
        row.outcome.lines===2);
      assert.ok(!('bag' in row.visible)&&!('rng' in row.visible));
    }
    const audit=spawnSync(process.execPath,
      ['scripts/rook-tsd-negative-controls.js'],{
        cwd:process.cwd(),encoding:'utf8',timeout:45000,
        env:{...process.env,ROOK_LOCK_TRACE_INPUT:trace,
          ROOK_LOCK_AUDIT_OUTPUT:analysis}
      });
    assert.equal(audit.status,0,audit.stderr||audit.error?.message);
    const a=JSON.parse(readFileSync(analysis,'utf8'));
    assert.equal(a.locks,10);
    assert.equal(a.independentSeeds,1);
    assert.equal(a.authorityEvents,lines.filter(x=>x.outcome.fullTsd).length);
    assert.equal(a.summaries.length,30);
    for(const x of a.summaries)
      assert.equal(x.tp+x.fp+x.tn+x.fn,x.samples);
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
});
