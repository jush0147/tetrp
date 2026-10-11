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

test('bank currently visible T in empty Hold, then four real locks produce TSD',()=>{
  const e=fixture(),before=e.serialize();
  e.state.piece.type='t';e.state.hold.piece=null;e.state.hold.locked=false;
  e.state.bag.queue.splice(0,5,'i','i','o','s','l');
  const v=visibleState(e.state),frozen=structuredClone(v);
  const opts={...config,heldTFinish:true,storeCurrentT:true,
    heldTSetupPieces:3};
  const output=searchPublicForwardTsd(v,opts);
  assert.equal(output.stats.storingT,true);
  assert.equal(output.stats.viaHeldT,true);
  assert.ok(output.plans.length>0,'banked T can finish genuine Full TSD');
  assert.deepEqual(v,frozen,'do not change source public snapshot');
  const plan=output.plans[0];
  assert.equal(plan.evidence.initialStoresT,true);
  assert.deepEqual(plan.actions.map(a=>a.action.kind),
    ['hold','place','place','place','hold','place']);
  assert.deepEqual(plan.actions.filter(a=>a.move).map(a=>a.move.piece),
    ['i','i','o','t']);
  assert.equal(plan.planLength,4,'Hold actions do not count as locks');
  const demo=new BotDemo(e,{placementMode:'atomic'});
  for(const action of plan.actions){
    const view=demo.view();
    demo.prepare(action,view.revision);
    demo.commit(view.revision);
  }
  assert.equal(demo.view().lastPlacement.spin,'full');
  assert.equal(demo.view().lastPlacement.lines,2);
  assert.equal(demo.engine.state.frame,96,'two Hold actions consume zero frames');
  assert.ok(demo.engine.state.attack.totals.generated>=4);
  const poisoned={...structuredClone(v),privateBag:['t','t'],
    hiddenNext6:'t',futureGarbageHole:2};
  assert.deepEqual(searchPublicForwardTsd(poisoned,opts),output);
  const locked={...v,hold:{...v.hold,locked:true}};
  assert.equal(searchPublicForwardTsd(locked,opts).plans.length,0);
  const stock={...v,hold:{...v.hold,piece:'o'}};
  assert.equal(searchPublicForwardTsd(stock,opts).plans.length,0);
  const disabled=searchPublicForwardTsd(v,{...opts,storeCurrentT:false});
  assert.equal(disabled.stats.storingT,false);
  assert.equal(disabled.plans.length,0);
});

for(const tIndex of [1,2]){
  test('bank a publicly upcoming T at index '+tIndex+' after real locks',()=>{
    const e=fixture();
    e.state.hold.piece=null;e.state.hold.locked=false;
    // The original four placements i, i, o, t form the known full TSD.
    // Current+NEXT are arranged so T is seen in advance but must be saved
    // when it actually arrives. No invisible fifth- or sixth-piece peek.
    e.state.piece.type='i';
    e.state.bag.queue.splice(0,5,...(tIndex===1?
      ['t','i','o','s','l']:['i','t','o','s','l']));
    const v=visibleState(e.state),frozen=structuredClone(v);
    const opts={...config,heldTFinish:true,storeUpcomingT:true,
      heldTSetupPieces:3};
    const out=searchPublicForwardTsd(v,opts);
    assert.equal(out.stats.storingT,true);
    assert.equal(out.stats.storeIndex,tIndex);
    assert.ok(out.plans.length>0,
      'available future T must be banked before genuine SRS+ TSD');
    const plan=out.plans[0];
    assert.equal(plan.evidence.storedUpcomingT,true);
    assert.equal(plan.evidence.storedTAfterLocks,tIndex);
    assert.deepEqual(plan.actions.map(a=>a.action.kind),
      tIndex===1?['place','hold','place','place','hold','place']:
        ['place','place','hold','place','hold','place']);
    assert.deepEqual(plan.actions.filter(a=>a.move).map(a=>a.move.piece),
      ['i','i','o','t']);
    const demo=new BotDemo(e,{placementMode:'atomic'});
    for(const request of plan.actions){
      const view=demo.view();
      demo.prepare(request,view.revision);
      demo.commit(view.revision);
    }
    assert.equal(demo.view().lastPlacement.spin,'full');
    assert.equal(demo.view().lastPlacement.lines,2);
    assert.equal(demo.engine.state.frame,96);
    assert.deepEqual(v,frozen);
    const poisoned={...structuredClone(v),privateBag:['t','t'],
      hiddenGarbageHoles:[1,2],next6:'t'};
    assert.deepEqual(searchPublicForwardTsd(poisoned,opts),out);
    const disabled=searchPublicForwardTsd(v,{
      ...opts,storeUpcomingT:false});
    assert.equal(disabled.stats.storingT,false);
  });
}
