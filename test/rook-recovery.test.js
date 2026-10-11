import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/board.js';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove,enumerateReachable} from '../src/analysis/rook.js';
import {recoveryBoardPenalty,clearedGarbageReward} from '../src/analysis/rook-recovery.js';

const opts={depth:2,beamWidth:12,maxNodes:1200,maxStates:950,
  tsdTacticalProbes:0,spinForecast:false};
const fixture=()=>{
  const e=new Engine({mode:'tl',seed:11,
    rules:{g:0,gincrease:0,b2bcharge_base:3}});
  e.state.hold.locked=true;e.state.piece.type='i';
  // Public and clearable Tetrp garbage, one real visible hole. The I
  // must legally occupy this exact column before any garbage-row clear.
  for(let x=0;x<10;x++)e.state.board.rows[39][x]=x===5?null:'gb';
  return e;
};
test('survival score is zero when off and rises with actual stack/garbage risk',()=>{
  const clean={max:5,holes:0,covered:0,garbage:0};
  const buried={max:19,holes:13,covered:180,garbage:144};
  assert.equal(recoveryBoardPenalty(clean,{weight:0}),0);
  assert.equal(recoveryBoardPenalty(clean,{weight:1}),0);
  assert.ok(recoveryBoardPenalty(buried,{weight:1})>100);
  assert.ok(recoveryBoardPenalty(buried,{pending:8,weight:1})>
    recoveryBoardPenalty(buried,{pending:0,weight:1}));
  assert.equal(clearedGarbageReward(0,{maxHeight:19,pending:8}),0);
  assert.equal(clearedGarbageReward(1,{weight:0}),0);
  assert.ok(clearedGarbageReward(1,{maxHeight:19,pending:8})>
    clearedGarbageReward(1,{maxHeight:4,pending:0}));
  assert.equal(clearedGarbageReward(2,{maxHeight:19}),
    2*clearedGarbageReward(1,{maxHeight:19}));
});
test('no garbage and no incoming packet keeps both search and move bit-for-bit unchanged',()=>{
  const e=new Engine({mode:'tl',seed:88,rules:{g:0,gincrease:0}});
  const v=visibleState(e.state);
  const old=chooseMove(v,opts);
  const newOne=chooseMove(v,{...opts,garbageRecovery:true});
  assert.equal(newOne.diagnostics.recoveryActive,false);
  assert.equal(newOne.kind,old.kind);
  assert.deepEqual(newOne.move,old.move);
  assert.deepEqual(newOne.execution,old.execution);
  assert.equal(newOne.diagnostics.evaluated,old.diagnostics.evaluated);
});
test('visible garbage activates recovery without reading opponent private state',()=>{
  const e=fixture(),original=e.serialize(),v=visibleState(e.state);
  const baseline=chooseMove(v,opts);
  const recovering=chooseMove(v,{...opts,garbageRecovery:true});
  assert.equal(baseline.diagnostics.recoveryActive,false);
  assert.equal(recovering.diagnostics.recoveryActive,true);
  const hidden={...structuredClone(v),opponent:{futureGarbageHole:7},
    hiddenBag:['i','i'],replay:{futureMoves:['t']}};
  assert.deepEqual(chooseMove(hidden,{...opts,garbageRecovery:true}),recovering);
  assert.equal(e.serialize(),original);
});
test('garbage recovery comes from legal Tetrp fullLines, not an invented forecast',()=>{
  const e=fixture(),original=e.serialize(),v=visibleState(e.state);
  const candidates=enumerateReachable(v.board,v.current,v.rules,
    {maxStates:1400,maxSteps:42});
  const eligible=candidates.find(m=>{
    const copy=structuredClone(v.board);
    if(!B.legal(copy,m.piece))return false;
    B.commit(copy,m.piece);
    return B.fullLines(copy).length===1&&
      copy.rows[39].includes('gb');
  });
  assert.ok(eligible,'vertical I must be able to complete real garbage row');
  const demo=new BotDemo(e,{placementMode:'atomic'});
  const proposal={action:{kind:'place'},move:{
    piece:eligible.piece.type,x:eligible.piece.x,y:Math.ceil(eligible.piece.y),
    rotation:eligible.piece.r,useHold:false,
    cells:B.cells(eligible.piece).map(([x,y])=>[x,Math.ceil(y)])},
    execution:{moves:eligible.path,spin:eligible.spin}};
  demo.prepare(proposal,0);
  const after=demo.commit(0);
  assert.equal(after.lastPlacement.lines,1);
  assert.equal(demo.engine.state.board.rows[39].filter(c=>c==='gb').length,0);
  assert.equal(e.serialize(),original);
});
test('a real public incoming packet, not hidden future opponent plans, activates recovery',()=>{
  const e=new Engine({mode:'tl',seed:45,rules:{g:0,gincrease:0}});
  const cid=e.receive({from:'P2',iid:1,ackiid:0,amt:4});
  e.confirm(cid);
  const v=visibleState(e.state);
  const recovery=chooseMove(v,{...opts,garbageRecovery:true});
  assert.equal(recovery.diagnostics.recoveryActive,true);
  assert.equal(recovery.diagnostics.pending,4);
  assert.deepEqual(chooseMove({...structuredClone(v),opponent:{futureAttack:500}},
    {...opts,garbageRecovery:true}),recovery);
  assert.throws(()=>chooseMove(v,{...opts,garbageRecoveryWeight:-1}),
    /Invalid garbage recovery weight/);
});
