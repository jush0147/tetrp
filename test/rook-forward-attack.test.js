import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {BotDemo} from '../src/analysis/demo.js';
import {searchPublicForwardTsd} from '../src/analysis/rook-forward-attack.js';

function fixture(five=false){
  const e=new Engine({seed:31,mode:'tl',rules:{g:0,
    spinbonuses:'all-mini+',b2bcharge_base:3}});
  e.state.piece.type=five?'j':'i';e.state.hold.locked=true;
  e.state.bag.queue.splice(0,5,...(five?
    ['i','i','o','t','s']:['i','o','t','s','l']));
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
const config={beamWidth:30,maxPlacementEvaluations:8000,
  maxProofCalls:210,maxStates:1000,maxSteps:70,maxPlans:4};
for(const five of [false,true]){
  test('forward all-SRS planning actually executes '+(five?5:4)+
    ' public locks to Full TSD',()=>{
    const e=fixture(five),checkpoint=e.serialize(),
      visible=visibleState(e.state),frozen=structuredClone(visible);
    const out=searchPublicForwardTsd(visible,config);
    assert.equal(out.stats.targetIndex,five?4:3);
    assert.ok(out.plans.length>0,'genuine SRS+ TSD continuation exists');
    assert.deepEqual(visible,frozen,'cannot mutate original public state');
    const plan=out.plans[0];
    assert.equal(plan.planLength,five?5:4);
    assert.deepEqual(plan.actions.map(x=>x.move.piece),five?
      ['j','i','i','o','t']:['i','i','o','t']);
    assert.ok(plan.evidence.allMovesSrsWitnessed);
    const demo=new BotDemo(e,{placementMode:'atomic'});
    for(const action of plan.actions){
      const v=demo.view();
      assert.equal(v.visible.next.length,5);
      assert.equal(v.visible.current.type,action.move.piece);
      demo.prepare(action,v.revision);
      demo.commit(v.revision);
    }
    assert.equal(demo.view().lastPlacement.spin,'full');
    assert.equal(demo.view().lastPlacement.lines,2);
    assert.equal(demo.engine.state.frame,(five?5:4)*24);
    assert.ok(demo.engine.state.attack.totals.generated>=4);
    assert.equal(e.serialize(),checkpoint);
  });
}
test('planner requires public T and rejects privacy leaks and unbounded budgets',()=>{
  const e=fixture(),v=visibleState(e.state);
  const a=searchPublicForwardTsd(v,{...config,maxPlans:1});
  const poisoned={...structuredClone(v),hiddenBag:['t','t'],
    opponent:{futureAttack:999},hiddenGarbageHole:7};
  assert.deepEqual(searchPublicForwardTsd(poisoned,{...config,maxPlans:1}),a);
  const noT=structuredClone(v);noT.next.fill('o');
  assert.deepEqual(searchPublicForwardTsd(noT,config).plans,[]);
  assert.throws(()=>searchPublicForwardTsd({...v,next:[...v.next,'t']},config),
    /player-visible Current\/Hold\/NEXT5/);
  assert.throws(()=>searchPublicForwardTsd(v,{...config,maxProofCalls:0}),
    /Invalid public forward TSD search budget/);
  const capped=searchPublicForwardTsd(v,{...config,maxProofCalls:1});
  assert.equal(capped.stats.truncated,true);
  assert.ok(capped.stats.proofCalls<=1);
});


test('public held T can finish a five-action route after three known setup locks',()=>{
  const e=fixture();
  e.state.hold.piece='t';e.state.hold.locked=false;
  e.state.bag.queue.splice(0,5,'i','o','j','s','l');
  const v=visibleState(e.state);
  const baseline=searchPublicForwardTsd(v,config);
  assert.equal(baseline.plans.length,0,'there is no public T in NEXT5');
  const opts={...config,heldTFinish:true,heldTSetupPieces:3};
  const out=searchPublicForwardTsd(v,opts);
  assert.equal(out.stats.viaHeldT,true);
  assert.ok(out.plans.length>0);
  const plan=out.plans[0];
  assert.deepEqual(plan.actions.map(a=>a.action.kind),
    ['place','place','place','hold','place']);
  assert.equal(plan.actions[3].action.mode,'occupied');
  assert.deepEqual(plan.actions.filter(a=>a.action.kind==='place')
    .map(a=>a.move.piece),['i','i','o','t']);
  const demo=new BotDemo(e,{placementMode:'atomic'});
  for(const action of plan.actions){
    const view=demo.view();
    demo.prepare(action,view.revision);
    demo.commit(view.revision);
  }
  assert.equal(demo.view().lastPlacement.spin,'full');
  assert.equal(demo.view().lastPlacement.lines,2);
  assert.equal(demo.engine.state.frame,4*24,
    'occupied Hold must not count as another locked piece');
  assert.equal(demo.engine.state.attack.totals.generated,5);
  const poisoned={...structuredClone(v),privateBag:['t','t'],
    futureOpponentGarbageHole:6};
  assert.deepEqual(searchPublicForwardTsd(poisoned,opts),out);
});
