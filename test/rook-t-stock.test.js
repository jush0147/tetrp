import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {searchPublicForwardTsd} from '../src/analysis/rook-forward-attack.js';
import {evaluateVerifiedPublicPlan} from '../src/analysis/rook.js';
import {auditPublicTStock} from '../src/analysis/rook-t-stock.js';

function testState(){
  const e=new Engine({seed:31,mode:'tl',rules:{
    g:0,spinbonuses:'all-mini+',b2bcharge_base:3}});
  e.state.piece.type='t';
  e.state.hold.piece=null;e.state.hold.locked=false;
  e.state.bag.queue.splice(0,5,'i','i','o','s','l');
  for(let x=0;x<10;x++){
    e.state.board.rows[37][x]=Math.abs(x-3)<=1?null:'gb';
    e.state.board.rows[38][x]=x===3?null:'gb';
  }
  for(let x=6;x<10;x++){
    e.state.board.rows[37][x]=null;
    e.state.board.rows[38][x]=null;
    e.state.board.rows[39][x]='gb';
  }
  return visibleState(e.state);
}
const budgets={beamWidth:30,maxPlacementEvaluations:8000,
  maxProofCalls:210,maxStates:1000,maxSteps:70,maxPlans:4,
  heldTFinish:true,storeCurrentT:true,heldTSetupPieces:3};

test('public T stock plan earns only real same-horizon ROOK value',()=>{
  const visible=testState(),original=structuredClone(visible);
  const result=searchPublicForwardTsd(visible,budgets);
  assert.ok(result.plans.length>0);
  const value=evaluateVerifiedPublicPlan(visible,result.plans[0],{
    maxStates:1000,maxSteps:70});
  assert.equal(value.comparable,true,JSON.stringify(value));
  assert.equal(value.locks,4);
  assert.equal(value.holdActions,2);
  assert.equal(value.proofCalls,4);
  assert.ok(Number.isFinite(value.score));
  const bad=structuredClone(result.plans[0]);
  bad.witnesses[0].path=['hardDrop','rotateCW'];
  assert.equal(evaluateVerifiedPublicPlan(visible,bad).reason,
    'srs-witness-not-reproducible');
  const swapped=structuredClone(result.plans[0]);
  swapped.actions[0].action.mode='occupied';
  assert.equal(evaluateVerifiedPublicPlan(visible,swapped).reason,'hold-mode');
  const poisoned={...structuredClone(visible),hiddenBag:['t'],
    privateGarbageHole:7,opponentFutureMoves:['t','t']};
  assert.deepEqual(evaluateVerifiedPublicPlan(poisoned,result.plans[0],
    {maxStates:1000,maxSteps:70}),value);
  assert.deepEqual(visible,original);
});

test('T stock audit compares plans to ordinary ROOK but never changes policy',()=>{
  const visible=testState();
  const report=auditPublicTStock(visible,{
    depth:4,beamWidth:12,maxNodes:1800,
    planBeamWidth:30,maxPlacementEvaluations:8000,
    maxProofCalls:210,maxPlans:4,maxStates:1000,maxSteps:70
  });
  assert.equal(report.policyChanged,false);
  assert.equal(report.depth,4);
  assert.ok(Number.isFinite(report.baseline.score));
  const bank=report.variants.find(x=>x.kind==='bank-current-t');
  assert.ok(bank);
  assert.ok(bank.candidates.some(x=>x.comparable));
  assert.ok(report.bestPlan);
  assert.equal(report.bestPlan.mode,'bank-current-t');
  assert.equal(report.bestPlan.firstAction.kind,'hold');
  assert.ok(report.conclusion.includes('true-KO'));
});
