import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove} from '../src/analysis/rook.js';

function fixture(single=false){
  const e=new Engine({seed:31,mode:'tl',rules:{g:0,spinbonuses:'all-mini+',b2bcharge_base:3}});
  e.state.piece.type='o';e.state.hold.locked=true;e.state.bag.queue[0]='t';
  for(let x=0;x<10;x++){
    e.state.board.rows[37][x]=Math.abs(x-3)<=1?null:'gb';
    e.state.board.rows[38][x]=x===3?null:'gb';
  }
  if(single)e.state.board.rows[38][0]=null;
  return e;
}
const tactical={depth:2,beamWidth:20,maxNodes:4000,maxStates:1400,
  spinForecast:false,tsdTacticalProbes:0,reversePlanner:true,
  reverseMaxCandidates:250,reverseMaxGoals:80,reverseMaxPlans:2};

for(const [label,single,lines] of [['TSD',false,2],['TSS',true,1]]){
  test('ROOK selects inverse '+label+' setup and Tetrp completes its Full Spin',()=>{
    const e=fixture(single),original=e.serialize();
    const demo=new BotDemo(e,{placementMode:'atomic'});
    const first=chooseMove(demo.view().visible,tactical);
    assert.equal(first.kind,'place');
    assert.equal(first.move.piece,'o');
    assert.equal(first.diagnostics.reverseSelectedGoal,label);
    assert.ok(first.diagnostics.reversePlans>0);
    assert.ok(first.diagnostics.reverseCandidates<=tactical.reverseMaxCandidates);
    demo.prepare({action:{kind:'place'},move:first.move,execution:first.execution},0);
    demo.commit(0);
    const second=chooseMove(demo.view().visible,{...tactical,depth:1});
    assert.equal(second.move.piece,'t');
    assert.equal(second.execution.spin,'full');
    demo.prepare({action:{kind:'place'},move:second.move,execution:second.execution},1);
    const done=demo.commit(1);
    assert.equal(done.lastPlacement.lines,lines);
    assert.equal(done.lastPlacement.spin,'full');
    assert.equal(demo.engine.state.attack.btb,1);
    assert.equal(e.serialize(),original);
  });
}
test('reverse goals change the selected root, not just the status display',()=>{
  const v=visibleState(fixture().state);
  const base=chooseMove(v,{...tactical,reversePlanner:false});
  const reverse=chooseMove(v,tactical);
  assert.notEqual(JSON.stringify(base.move),JSON.stringify(reverse.move));
  assert.equal(base.diagnostics.reversePlans,0);
  assert.equal(reverse.diagnostics.reverseSelectedGoal,'TSD');
});
test('planner ignores hidden RNG/replay/opponent and refuses NEXT 6',()=>{
  const v=visibleState(fixture().state);
  const first=chooseMove(v,tactical);
  const hidden={...structuredClone(v),hiddenBag:['t','o'],seed:54321,
    opponent:{futurePlacement:'t-spin'},replayFuture:['x']};
  assert.deepEqual(chooseMove(hidden,tactical),first);
  assert.throws(()=>chooseMove({...v,next:[...v.next,'t']},tactical),/exactly five/);
});
test('no reverse plan can be manufactured without a publicly known next T',()=>{
  const e=fixture();e.state.bag.queue.fill('o');
  const r=chooseMove(visibleState(e.state),tactical);
  assert.equal(r.diagnostics.reversePlans,0);
  assert.equal(r.diagnostics.reverseSelectedGoal,null);
});
test('reverse search is opt-in until real APP and KO evidence proves improvement',()=>{
  const v=visibleState(fixture().state);
  const baseline=chooseMove(v,{...tactical,reversePlanner:false});
  const unchanged=chooseMove(v,{depth:2,beamWidth:20,maxNodes:4000,maxStates:1400,
    spinForecast:false,tsdTacticalProbes:0});
  assert.deepEqual(unchanged,baseline);
  assert.equal(unchanged.diagnostics.reverseGoals,0);
});
