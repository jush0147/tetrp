import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {BotDemo} from '../src/analysis/demo.js';
import {chooseMove} from '../src/analysis/rook.js';
import {searchOpenTSD} from '../src/analysis/rook-open-slot.js';

const make=seed=>new Engine({mode:'tl',seed,
  rules:{g:0,spinbonuses:'all-mini+',b2bcharge_base:3}});
const opener={maxGoals:8,maxTileNodes:1200,maxProofs:12,maxPlans:2};
const search={depth:4,beamWidth:24,maxNodes:6000,maxStates:1200,
  reversePlanner:true,reverseOpenMaxGoals:8,reverseOpenMaxTileNodes:1200,
  reverseOpenMaxProofs:12};

test('genuine seven-bag seed 39589 opens L Z I J S T from an empty board',()=>{
  const e=make(39589),original=e.serialize(),v=visibleState(e.state);
  assert.equal(v.current.type+v.next.join(''),'lzijst');
  assert.equal(B.empty(v.board),true);
  const result=searchOpenTSD(v,opener);
  assert.ok(result.plans.length>0);
  const plan=result.plans[0];
  assert.deepEqual(plan.actions.map(a=>a.move.piece),[...'lzijst']);
  assert.equal(plan.evidence.actualAuthorityExecuted,false);
  assert.equal(plan.evidence.attack,4);
  assert.equal(plan.goal.kind,'TSD');
  const demo=new BotDemo(e,{placementMode:'atomic'});
  for(const action of plan.actions){
    const snap=demo.view();
    assert.equal(snap.visible.current.type,action.move.piece);
    assert.equal(snap.visible.next.length,5);
    demo.prepare({action:{kind:'place'},move:action.move,
      execution:action.execution},snap.revision);
    demo.commit(snap.revision);
  }
  assert.equal(demo.view().lastPlacement.spin,'full');
  assert.equal(demo.view().lastPlacement.lines,2);
  assert.equal(demo.engine.state.attack.totals.generated,4);
  assert.equal(demo.engine.state.attack.totals.sent,4);
  assert.equal(demo.engine.state.attack.btb,1);
  assert.equal(demo.engine.state.frame,144);
  assert.equal(e.serialize(),original);
});

test('real ROOK independently replans all six locks to Full TSD on seed 39589',()=>{
  const e=make(39589),source=e.serialize();
  const demo=new BotDemo(e,{placementMode:'atomic'});
  let plans=0;
  for(let i=0;i<6;i++){
    const snap=demo.view(),r=chooseMove(snap.visible,search);
    assert.equal(r.kind,'place','unexpected Hold at piece '+i);
    plans+=r.diagnostics.reversePlans;
    if(i===0){
      assert.equal(r.diagnostics.reverseSelectedGoal,'TSD');
      assert.equal(r.diagnostics.effectiveDepth,6);
    }
    demo.prepare({action:{kind:'place'},move:r.move,
      execution:r.execution},snap.revision);
    demo.commit(snap.revision);
  }
  assert.ok(plans>=4);
  assert.equal(demo.view().lastPlacement.spin,'full');
  assert.equal(demo.view().lastPlacement.lines,2);
  assert.equal(demo.engine.state.attack.totals.generated,4);
  assert.equal(demo.engine.state.attack.btb,1);
  assert.equal(e.serialize(),source);
});

test('verified six-ply opening search is opt-in and extends actual decision depth',()=>{
  const v=visibleState(make(39589).state);
  const generic=chooseMove(v,{...search,reversePlanner:false});
  const tactical=chooseMove(v,search);
  assert.equal(generic.diagnostics.reversePlans,0);
  assert.ok(tactical.diagnostics.reversePlans>=1);
  assert.equal(tactical.diagnostics.reverseSelectedGoal,'TSD');
  assert.equal(tactical.diagnostics.effectiveDepth,6);
  assert.equal(generic.diagnostics.effectiveDepth,4);
});

test('hidden bag, replay and opponent futures do not affect the plan',()=>{
  const v=visibleState(make(39589).state),reference=searchOpenTSD(v,opener);
  const injected={...structuredClone(v),hiddenBag:['t','t','t'],rng:112233,
    replay:{futureActions:['t']},opponent:{futureAttack:1000}};
  assert.deepEqual(searchOpenTSD(injected,opener),reference);
  assert.throws(()=>searchOpenTSD({...v,next:[...v.next,'t']},opener),
    /player-visible current and NEXT5/);
});

test('no known T, disabled Spin rule, or exhausted budget cannot fabricate TSD',()=>{
  const v=visibleState(make(39589).state);
  assert.deepEqual(searchOpenTSD({...v,next:['z','l','o','s','j']},opener).plans,[]);
  assert.deepEqual(searchOpenTSD({...v,rules:{
    ...v.rules,spinbonuses:'none'}},opener).plans,[]);
  const tiny=searchOpenTSD(v,{...opener,maxTileNodes:1,maxProofs:1});
  assert.ok(tiny.stats.tileNodes<=1);
  assert.deepEqual(tiny.plans,[]);
});

test('second genuine seven-bag seed 1 supports a distinct Full TSD plan',()=>{
  const v=visibleState(make(1).state);
  assert.equal(v.current.type+v.next.join(''),'ojilst');
  const report=searchOpenTSD(v,opener);
  assert.ok(report.plans.some(p=>p.planLength===6&&
    p.evidence.spin==='full'&&p.evidence.lines===2));
});
