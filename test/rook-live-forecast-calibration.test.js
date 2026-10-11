import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('synchronous two-player forecast calibration preserves first-lock authority',()=>{
  // Deliberately tiny deterministic smoke; this is NOT a strength match.
  const run=spawnSync(process.execPath,['scripts/rook-live-forecast-calibration.js'],{
    cwd:process.cwd(),env:{...process.env,SEED:'67027',MAX_LOCKS:'6',
      ROOK_NODES:'240',ROOK_BEAM:'6',ROOK_DEPTH:'4',HORIZON:'4',
      OPPONENT_OFFENSE_WEIGHT:'7.2'},encoding:'utf8',timeout:30000});
  assert.equal(run.status,0,run.stderr||run.error?.message);
  const report=JSON.parse(run.stdout);
  assert.equal(report.format,'rook-live-forecast-calibration/1');
  assert.equal(report.seed,67027);
  assert.equal(report.rounds,6);
  assert.equal(report.identicalSeed,true);
  assert.equal(report.scored,false);
  assert.equal(report.termination,'capped');
  assert.equal(report.error,null);
  assert.equal(report.slots.length,2);
  for(const slot of report.slots){
    assert.equal(slot.locks,6);
    assert.equal(slot.firstMismatch,0);
    assert.ok(slot.firstComparable>0);
    assert.ok(slot.search.eval>0);
    assert.ok(slot.search.searches>=6);
    assert.ok(slot.pairedWindows>=0);
  }
  assert.deepEqual(report.firstMismatchIncidents,[]);
});
