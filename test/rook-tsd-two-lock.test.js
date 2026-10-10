import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {BotDemo} from '../src/analysis/demo.js';
import {findPublicTwoLockTsd} from '../src/analysis/rook-tsd-two-lock.js';
import {enumerateReachable} from '../src/analysis/rook.js';
import * as B from '../src/board.js';
const cells=p=>B.cells(p).map(([x,y])=>[x,Math.ceil(y)]);
const key=x=>JSON.stringify(x.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]));

function setup(){
  const e=new Engine({seed:31,mode:'tl',rules:{g:0,
    spinbonuses:'all-mini+',b2bcharge_base:3}});
  e.state.piece.type='o';e.state.hold.locked=true;
  e.state.bag.queue[0]='t';
  const board=e.state.board,y=37,x=3;
  for(let c=0;c<10;c++){
    board.rows[y][c]=Math.abs(c-x)<=1?null:'gb';
    board.rows[y+1][c]=c===x?null:'gb';
  }
  return e;
}
function request(board,current,rules,plan){
  const move=enumerateReachable(board,current,rules,{maxStates:2500,
    maxSteps:70}).find(m=>m.spin===plan.spin&&
    key(cells(m.piece))===key(plan.cells)&&
    JSON.stringify(m.path)===JSON.stringify(plan.path));
  assert.ok(move,'each published plan has a fresh SRS+ witness');
  return {action:{kind:'place'},
    move:{piece:move.piece.type,x:move.piece.x,
      y:Math.ceil(move.piece.y),rotation:move.piece.r,
      cells:cells(move.piece),useHold:false},
    execution:{moves:move.path,spin:move.spin}};
}
test('two known public locks: build via O, prove and execute genuine Full TSD',()=>{
  const original=setup(),before=original.serialize(),v=visibleState(original.state);
  const plans=findPublicTwoLockTsd(v,{firstStates:1400,secondStates:2500,
    maxSteps:70,maxPlans:4});
  assert.equal(plans.nextT,true);
  assert.ok(plans.plans.length>0);
  const chosen=plans.plans.find(x=>!x.second.viaHold);
  assert.ok(chosen);
  assert.equal(chosen.first.type,'o');
  assert.equal(chosen.second.type,'t');
  assert.equal(chosen.second.spin,'full');
  const demo=new BotDemo(original,{placementMode:'atomic'});
  demo.prepare(request(v.board,v.current,v.rules,chosen.first),0);
  demo.commit(0);
  const afterFirst=demo.view().visible;
  assert.equal(afterFirst.current.type,'t');
  demo.prepare(request(afterFirst.board,afterFirst.current,
    afterFirst.rules,chosen.second),1);
  const result=demo.commit(1);
  assert.equal(result.lastPlacement.spin,'full');
  assert.equal(result.lastPlacement.lines,2);
  assert.equal(original.serialize(),before,'search never mutates original authority');
});
test('two-lock TSD refuses unknown NEXT, permanent garbage, and private RNG',()=>{
  const e=setup(),v=visibleState(e.state);
  const options={firstStates:1400,secondStates:2500,maxSteps:70,
    maxPlans:4};
  const verified=findPublicTwoLockTsd(v,options);
  const contaminated={...structuredClone(v),hiddenNextSix:'t',
    privateHole:3,unrevealedBag:['t','t']};
  assert.deepEqual(findPublicTwoLockTsd(contaminated,options),verified);
  const noT=structuredClone(v);noT.next[0]='j';
  assert.equal(findPublicTwoLockTsd(noT,options).plans.length,0);
  const blocked=structuredClone(v);
  blocked.board.rows[37][0]='gbd';
  assert.equal(findPublicTwoLockTsd(blocked,options).plans.length,0);
  assert.throws(()=>findPublicTwoLockTsd({...v,next:[...v.next,'t']},options),
    /exactly player-visible/);
  assert.throws(()=>findPublicTwoLockTsd(v,{...options,secondStates:0}),
    /Invalid two-lock TSD budget/);
});
