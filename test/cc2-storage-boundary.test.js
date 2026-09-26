import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {tank} from '../src/attack.js';
import {pushLine} from '../src/board.js';
test('authority failed storage insertion preserves pending and tank count',()=>{
  const e=new Engine(),s=e.state;s.board.rows[0].fill('j');
  s.attack.pending=[{amt:2,active:true,status:'spawn',shielded:false,column:0}];
  const before=structuredClone(s.board);
  assert.equal(tank(s.attack,s.rules,s.holes,h=>pushLine(s.board,h)),0);
  assert.deepEqual(s.board,before);assert.equal(s.attack.pending[0].amt,2);
  assert.equal(s.attack.totals.tanked,0);
});
