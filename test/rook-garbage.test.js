import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {visibleCombat} from '../src/analysis/rook-combat.js';
import {enumeratePublicTankOutcomes} from '../src/analysis/rook-garbage.js';

function incoming(amounts,rules={}){
  const engine=new Engine({mode:'tl',seed:210,rules:{g:0,garbagecap:8,...rules}});
  for(let i=0;i<amounts.length;i++){
    const cid=engine.receive({from:'P2',iid:i+1,amt:amounts[i]});
    engine.confirm(cid);
    const p=engine.state.attack.pending.find(p=>p.cid===cid);
    p.active=true;
  }
  engine.state.piece.sleeping=true; // Tank happens after lock, before next spawn.
  return engine;
}
const snapshot=e=>{
  const v=visibleState(e.state);
  return {board:v.board,combat:visibleCombat(v)};
};

test('all ten one-packet garbage outcomes match Tetrp authority without reading hidden columns',()=>{
  const base=incoming([5]);
  const {board,combat}=snapshot(base);
  const before=base.serialize();
  const outcomes=enumeratePublicTankOutcomes(board,combat,base.state.rules);
  assert.equal(outcomes.length,board.width);
  assert.ok(outcomes.every(x=>x.weight===1/board.width&&x.tanked===5&&!x.topout));
  assert.equal(new Set(outcomes.map(x=>x.holes[0])).size,board.width);
  for(const outcome of outcomes){
    const e=incoming([5]);
    e.state.attack.pending[0].column=outcome.holes[0];
    e.takeDamage();
    assert.deepEqual(outcome.board,e.state.board,'garbage board at hole '+outcome.holes[0]);
    assert.deepEqual(outcome.combat.pending.map(p=>p.amt),
      e.state.attack.pending.map(p=>p.amt));
    assert.ok(!outcome.combat.pending.some(p=>Object.hasOwn(p,'column')));
  }
  assert.equal(base.serialize(),before,'hypotheses must never mutate the authority');
  assert.equal(combat.pending[0].active,true);
});

test('two active packets enumerate all 100 independent hole combinations',()=>{
  const base=incoming([2,3]);const {board,combat}=snapshot(base);
  const outcomes=enumeratePublicTankOutcomes(board,combat,base.state.rules);
  assert.equal(outcomes.length,100);
  const outcome=outcomes.find(x=>x.holes[0]===1&&x.holes[1]===8);
  const e=incoming([2,3]);
  e.state.attack.pending[0].column=1;
  e.state.attack.pending[1].column=8;
  e.takeDamage();
  assert.deepEqual(outcome.board,e.state.board);
  assert.equal(outcome.tanked,5);
  assert.equal(outcome.weight,1/100);
  assert.throws(()=>enumeratePublicTankOutcomes(board,combat,base.state.rules,
    {maxOutcomes:10}),/scenario limit/);
});

test('blocked or inactive packets leave the board unchanged and generate no imagined holes',()=>{
  const base=incoming([4]);const {board,combat}=snapshot(base);
  const a=enumeratePublicTankOutcomes(board,combat,base.state.rules,{blocked:true});
  assert.equal(a.length,1);assert.equal(a[0].tanked,0);
  assert.deepEqual(a[0].board,board);
  combat.pending[0].active=false;
  assert.equal(enumeratePublicTankOutcomes(board,combat,base.state.rules).length,1);
});
