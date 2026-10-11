import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {reverseAttackGoals,searchReverseAttacks} from '../src/analysis/rook-reverse-planner.js';

function puzzle(kind){
  const e=new Engine({seed:31,mode:'tl',rules:{g:0,spinbonuses:'all-mini+',b2bcharge_base:3}});
  const three=kind==='three',single=kind==='single';
  e.state.piece.type=three?'i':'o';e.state.hold.locked=true;
  e.state.bag.queue[0]=three?'o':'t';e.state.bag.queue[1]='t';
  const b=e.state.board,x=3,y=37;
  for(let xx=0;xx<10;xx++){
    b.rows[y][xx]=Math.abs(xx-x)<=1?null:'gb';
    b.rows[y+1][xx]=xx===x?null:'gb';
  }
  if(three)for(let x=6;x<10;x++)b.rows[y][x]=null;
  if(single)b.rows[y+1][0]=null;
  return e;
}
function options(extra={}){return {targets:['TSS','TSD'],maxGoals:180,maxStates:1700,
  maxSteps:72,maxCandidates:5000,maxPlans:4,...extra};}
function execute(e,plan){
  const source=e.serialize(),demo=new BotDemo(e,{placementMode:'atomic'});
  for(let i=0;i<plan.actions.length;i++){
    const view=demo.view();const action=plan.actions[i];
    assert.equal(view.visible.current.type,action.move.piece);
    assert.equal(view.visible.next.length,5);
    demo.prepare({action:{kind:'place'},move:action.move,execution:action.execution},view.revision);
    demo.commit(view.revision);
  }
  assert.equal(e.serialize(),source,'source private engine must be unchanged');
  return demo;
}
test('inverse TSD: corner roof support, not just missing line cells, is required',()=>{
  const e=puzzle('two'),goals=reverseAttackGoals(e.state.board,e.state.rules,{targets:['TSD']});
  assert.ok(goals.some(g=>g.kind==='TSD'&&g.requiredRows.length===0&&
    g.cornerOptions.includes('4,36')&&!g.blockedCells.includes('4,36')));
  const out=searchReverseAttacks(visibleState(e.state),options({targets:['TSD']}));
  assert.ok(out.plans.length>0);
  const plan=out.plans[0];
  assert.equal(plan.planLength,2);
  assert.equal(plan.goal.kind,'TSD');
  assert.equal(plan.evidence.actualAuthorityExecuted,false);
  const d=execute(e,plan);
  assert.equal(d.view().lastPlacement.spin,'full');
  assert.equal(d.view().lastPlacement.lines,2);
  assert.equal(d.engine.state.attack.btb,1);
  assert.equal(d.engine.state.attack.totals.generated,5);
});
test('inverse TSS is Full Spin Single, not Mini Single',()=>{
  const e=puzzle('single');
  const out=searchReverseAttacks(visibleState(e.state),options({targets:['TSS']}));
  assert.ok(out.plans.length>0);
  const plan=out.plans[0];
  assert.equal(plan.goal.kind,'TSS');
  assert.equal(plan.evidence.spin,'full');
  const d=execute(e,plan);
  assert.equal(d.view().lastPlacement.spin,'full');
  assert.equal(d.view().lastPlacement.lines,1);
  assert.equal(d.engine.state.attack.totals.generated,3);
});
test('inverse 3-ply I, O, T plan fills line supports, then spin roof, then TSD',()=>{
  const e=puzzle('three');
  const out=searchReverseAttacks(visibleState(e.state),options({targets:['TSD'],maxPlans:2}));
  assert.ok(out.plans.length>0);
  const plan=out.plans[0];
  assert.deepEqual(plan.actions.map(a=>a.move.piece),['i','o','t']);
  assert.equal(plan.planLength,3);
  assert.equal(plan.goal.kind,'TSD');
  assert.deepEqual(plan.goal.requiredRows.sort(),['6,37','7,37','8,37','9,37']);
  const d=execute(e,plan);
  assert.equal(d.view().lastPlacement.spin,'full');
  assert.equal(d.view().lastPlacement.lines,2);
  assert.equal(d.engine.state.attack.totals.generated,5);
});
test('no phantom reverse attack goal on empty board',()=>{
  const e=new Engine({seed:1,mode:'tl'});
  const goals=reverseAttackGoals(e.state.board,e.state.rules,{targets:['TSD'],maxMissing:8});
  assert.deepEqual(goals,[]);
  const out=searchReverseAttacks(visibleState(e.state));
  assert.deepEqual(out.plans,[]);
});
test('unrevealed next, RNG, opponent and replay future do not change the plan',()=>{
  const e=puzzle('two'),v=visibleState(e.state);
  const o=options({targets:['TSD'],maxPlans:1});
  const a=searchReverseAttacks(v,o);
  const b=searchReverseAttacks({...structuredClone(v),bag:{queue:['t','t']},
    opponent:{futureAttack:500},replay:{futureMoves:['t']},randomSeed:42},o);
  assert.deepEqual(b,a);
  assert.throws(()=>searchReverseAttacks({...v,next:[...v.next,'t']},o),/exactly player-visible current and NEXT5/);
});
test('prototype never guesses a future T beyond the five-piece preview',()=>{
  const e=puzzle('two');e.state.bag.queue.fill('o');
  assert.deepEqual(searchReverseAttacks(visibleState(e.state)).plans,[]);
});
