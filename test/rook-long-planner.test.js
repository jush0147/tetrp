import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {searchLongReverseAttacks} from '../src/analysis/rook-long-planner.js';
import {chooseMove} from '../src/analysis/rook.js';

function fixture(five=false){
  const e=new Engine({seed:31,mode:'tl',rules:{g:0,spinbonuses:'all-mini+',b2bcharge_base:3}});
  e.state.piece.type=five?'j':'i';e.state.hold.locked=true;
  e.state.bag.queue.splice(0,5,...(five?['i','i','o','t','s']:['i','o','t','s','l']));
  for(let x=0;x<10;x++){
    e.state.board.rows[37][x]=Math.abs(x-3)<=1?null:'gb';
    e.state.board.rows[38][x]=x===3?null:'gb';
  }
  for(let x=6;x<10;x++){
    e.state.board.rows[37][x]=null;
    e.state.board.rows[38][x]=null;
    e.state.board.rows[39][x]='gb';
  }
  if(five){e.state.board.rows[37][0]=null;e.state.board.rows[37][1]=null;}
  return e;
}
const options={maxCandidates:5000,maxGoals:25,beamWidth:16,goalTypes:['TSD'],maxStates:1200};
function play(e,plan){
  const bytes=e.serialize(),demo=new BotDemo(e,{placementMode:'atomic'});
  for(const action of plan.actions){
    const v=demo.view();
    assert.equal(action.move.piece,v.visible.current.type);
    assert.equal(v.visible.next.length,5);
    demo.prepare({action:{kind:'place'},move:action.move,execution:action.execution},v.revision);
    demo.commit(v.revision);
  }
  assert.equal(demo.view().lastPlacement.spin,'full');
  assert.equal(demo.view().lastPlacement.lines,2);
  assert.equal(demo.engine.state.attack.totals.generated,5);
  assert.equal(demo.engine.state.attack.btb,1);
  assert.equal(e.serialize(),bytes,'original source replay snapshot preserved');
  return demo;
}
test('inverse Full TSD extends to four pieces I-I-O-T with actual Tetrp locks',()=>{
  const e=fixture();const r=searchLongReverseAttacks(visibleState(e.state),options);
  assert.equal(r.plans[0]?.goal.kind,'TSD');
  assert.deepEqual(r.plans[0].actions.map(a=>a.move.piece),['i','i','o','t']);
  assert.equal(r.plans[0].evidence.actualAuthorityExecuted,false);
  assert.ok(r.stats.forwardProofs>0);
  assert.equal(play(e,r.plans[0]).engine.state.frame,24*4);
});
test('inverse Full TSD extends to five pieces J-I-I-O-T with roof and row preimages',()=>{
  const e=fixture(true);const r=searchLongReverseAttacks(visibleState(e.state),options);
  assert.equal(r.plans[0]?.goal.kind,'TSD');
  assert.deepEqual(r.plans[0].actions.map(a=>a.move.piece),['j','i','i','o','t']);
  assert.ok(r.plans[0].goal.requiredRows.length>=8);
  assert.equal(play(e,r.plans[0]).engine.state.frame,24*5);
});
test('public NEXT5, private RNG and opponent futures cannot affect long reverse results',()=>{
  const v=visibleState(fixture().state);
  const bounded={...options,maxCandidates:900,maxPlans:1};
  const normal=searchLongReverseAttacks(v,bounded);
  const poisoned=searchLongReverseAttacks({...structuredClone(v),hiddenBag:['t','t'],
    seed:777,opponent:{futureAttack:999},replayFuture:['t','t']},bounded);
  assert.deepEqual(poisoned,normal);
  assert.throws(()=>searchLongReverseAttacks({...v,next:[...v.next,'t']},bounded),
    /exactly public current and NEXT5/);
});
test('no phantom future T and impossible no-target board do not fabricate plans',()=>{
  const e=fixture();e.state.bag.queue.fill('o');
  assert.deepEqual(searchLongReverseAttacks(visibleState(e.state),options).plans,[]);
  const empty=new Engine({mode:'tl',seed:13});
  assert.deepEqual(searchLongReverseAttacks(visibleState(empty.state),options).plans,[]);
});
test('4/5 step search is explicit budget-limited and does not mutate input board',()=>{
  const e=fixture(true),before=e.serialize();
  const r=searchLongReverseAttacks(visibleState(e.state),{...options,maxCandidates:30});
  assert.ok(r.stats.setupCandidates<=31);
  assert.equal(e.serialize(),before);
});
for(const five of [false,true]){
  test('live ROOK opt-in re-plans each of '+(five?5:4)+' steps into an actual Full TSD',()=>{
    const e=fixture(five),source=e.serialize();
    const demo=new BotDemo(e,{placementMode:'atomic'});
    for(let i=0;i<(five?5:4);i++){
      const v=demo.view();
      const decision=chooseMove(v.visible,{depth:4,beamWidth:24,maxNodes:7000,
        maxStates:1200,spinForecast:false,tsdTacticalProbes:0,
        reversePlanner:true,reverseLongMaxCandidates:5000,
        reverseLongMaxGoals:25,reverseLongBeamWidth:16,reverseMaxPlans:2});
      assert.equal(decision.kind,'place');
      if(i===0){
        assert.ok(decision.diagnostics.reversePlans>0);
        assert.equal(decision.diagnostics.reverseSelectedGoal,'TSD');
        assert.equal(decision.diagnostics.effectiveDepth,five?5:4);
      }
      demo.prepare({action:{kind:'place'},move:decision.move,execution:decision.execution},v.revision);
      demo.commit(v.revision);
    }
    assert.equal(demo.view().lastPlacement.spin,'full');
    assert.equal(demo.view().lastPlacement.lines,2);
    assert.equal(demo.engine.state.attack.totals.generated,5);
    assert.equal(e.serialize(),source);
  });
}
test('an unproductive optional long-horizon search cannot steal ordinary beam nodes',()=>{
  const e=new Engine({seed:67020,mode:'tl',rules:{g:0,spinbonuses:'all-mini+'}});
  e.state.piece.type='l';
  e.state.bag.queue.splice(0,5,'i','o','j','t','s');
  const original=e.serialize(),snapshot=visibleState(e.state);
  const params={depth:4,beamWidth:24,maxNodes:3000,maxStates:950,spinForecast:true};
  const baseline=chooseMove(snapshot,{...params,reversePlanner:false});
  const tactical=chooseMove(snapshot,{...params,reversePlanner:true,
    reverseLongMaxCandidates:300});
  assert.equal(tactical.diagnostics.reversePlans,0);
  assert.deepEqual(tactical.move,baseline.move);
  assert.equal(tactical.kind,baseline.kind);
  assert.equal(tactical.diagnostics.evaluated,baseline.diagnostics.evaluated);
  assert.equal(tactical.diagnostics.reverseBudget,params.maxNodes);
  assert.equal(e.serialize(),original);
});
