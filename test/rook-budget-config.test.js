import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const base={
  ...process.env,SEEDS:'1',MAX_LOCKS:'1',
  ROOK_NODES:'80',EXPERT_OPEN:'0',EXPERT_BELIEF:'0',
  EXPERT_RECOVERY:'0',EXPERT_FUTURE:'0',EXPERT_BEAM:'0',
  EXPERT_OFFENSE:'0',EXPERT_HOLD_PLAN:'0'
};
function run(extra={}){
  return spawnSync(process.execPath,['scripts/rook-vs-rook.js'],{
    cwd:process.cwd(),env:{...base,...extra},encoding:'utf8',timeout:90000});
}
test('independent budgets stay with bot identities across swapped slots',()=>{
  const output=run({ROOK_CANDIDATE_NODES:'400',ROOK_BASELINE_NODES:'100'});
  assert.equal(output.status,0,output.stderr);
  const rows=output.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,2);
  for(const [i,row] of rows.entries()){
    assert.equal(row.swap,Boolean(i));
    assert.deepEqual(row.seeds,[1,1]);
    assert.equal(row.nodeBudget,80,'legacy common default is preserved');
    assert.equal(row.candidateNodeBudget,400);
    assert.equal(row.baselineNodeBudget,100);
    assert.equal(row.budgetsByKind.candidate,400);
    assert.equal(row.budgetsByKind.baseline,100);
    assert.equal(row.cap,1);
    assert.equal(row.turns,1);
    assert.equal(row.scored,row.termination==='KO');
    assert.equal(row.slots[0].kind,i?'baseline':'candidate');
    for(const slot of row.slots){
      const expected=slot.kind==='candidate'?400:100;
      assert.equal(slot.configuredNodeBudget,expected);
      assert.ok(slot.searches>=1&&slot.searches<=2);
      assert.ok(slot.nodes>0&&slot.nodes<=slot.searches*expected);
      assert.ok(slot.budgetReached<=slot.searches);
      assert.ok(slot.searchDepthLimit>=1&&slot.searchDepthLimit<=5);
    }
  }
});
test('old ROOK_NODES still applies to both sides without overrides',()=>{
  const output=run();
  assert.equal(output.status,0,output.stderr);
  const rows=output.stdout.trim().split('\n').map(JSON.parse);
  for(const row of rows){
    assert.equal(row.nodeBudget,80);
    assert.equal(row.candidateNodeBudget,80);
    assert.equal(row.baselineNodeBudget,80);
    assert.deepEqual(row.slots.map(s=>s.configuredNodeBudget),[80,80]);
  }
});
test('budget configuration rejects invalid candidate/base quantities',()=>{
  for(const extra of [{ROOK_CANDIDATE_NODES:'0'},
    {ROOK_BASELINE_NODES:'-5'}, {ROOK_CANDIDATE_NODES:'NaN'}]){
    const out=run(extra);
    assert.notEqual(out.status,0);
    assert.match(out.stderr,/Invalid ROOK self-play configuration/);
  }
});
