import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';
import {enumerateReachable,chooseMove} from '../src/analysis/rook.js';
import {BotDemo} from '../src/analysis/demo.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';

function tsdFixture(){
  const e=new Engine({seed:17,mode:'tl',rules:{g:0,spinbonuses:'all-mini+',b2bcharge_base:3}});
  e.state.piece.type='t';
  const b=e.state.board,x=3,y=37;
  for(let xx=0;xx<10;xx++){
    b.rows[y][xx]=Math.abs(xx-x)<=1?null:'gb';
    b.rows[y+1][xx]=xx===x?null:'gb';
  }
  b.rows[y-1][x-1]='gb';
  const moves=enumerateReachable(b,e.state.piece,e.state.rules,{maxStates:2400,maxSteps:60});
  const m=moves.find(m=>{
    if(m.spin!=='full')return false;
    const bb=structuredClone(b);B.commit(bb,m.piece);
    return B.fullLines(bb).length===2;
  });
  assert.ok(m,'fixture must contain a true, reachable full TSD');
  const target={piece:'t',x:m.piece.x,y:Math.ceil(m.piece.y),rotation:m.piece.r,
    useHold:false,cells:B.cells(m.piece).map(([x,y])=>[x,Math.ceil(y)])};
  return {e,m,target};
}

test('atomic ROOK locks real TSD without a 24-input cap, preserves B2B and 24-frame clock',()=>{
  const {e,m,target}=tsdFixture(),original=e.serialize();
  const padded=[...Array.from({length:18},()=>['moveRight','moveLeft']).flat(),...m.path];
  assert.ok(padded.length>24);
  const proposal={action:{kind:'place'},move:target,execution:{moves:padded,spin:'full'}};
  assert.equal(validatePlacement(visibleState(e.state),proposal).clear.lines,2);
  const demo=new BotDemo(e,{placementMode:'atomic'});
  demo.prepare(proposal,0);
  const view=demo.commit(0);
  assert.equal(view.lastPlacement.spin,'full');
  assert.equal(view.lastPlacement.lines,2);
  assert.equal(view.lastPlacement.piece,'t');
  // Garbage-row special bonus on this constructed board adds +1 to base TSD 4.
  assert.equal(demo.engine.state.attack.totals.generated,5);
  assert.equal(demo.engine.state.attack.btb,1);
  assert.equal(demo.engine.state.frame,24);
  assert.equal(e.serialize(),original);
});

test('atomic authority rejects fake spin and unreachable destination, no state change',()=>{
  const {e,m,target}=tsdFixture(),original=e.serialize();
  const demo=new BotDemo(e,{placementMode:'atomic'});
  const request={action:{kind:'place'},move:target,execution:{moves:m.path,spin:'mini'}};
  assert.throws(()=>demo.prepare(request,0),/does not match claimed final position or spin/);
  assert.equal(demo.view().index,0);
  assert.equal(e.serialize(),original);
});

test('timed mode remains the explicit unchanged Kiwi default',()=>{
  const {e,m,target}=tsdFixture();
  const inflated=[...Array.from({length:18},()=>['moveRight','moveLeft']).flat(),...m.path];
  const request={action:{kind:'place'},move:target,execution:{moves:inflated,spin:'full'}};
  const timed=new BotDemo(e);
  assert.throws(()=>timed.prepare(request,0));
  assert.equal(timed.view().index,0);
});

test('atomic legality proof accepts ordinary TL replay ARE and garbage settings',()=>{
  for(const rules of [{g:0,garbagearebump:5},{g:0,garbageentry:'delayed',garbageare:2},{g:0,are:1}]){
    const e=new Engine({seed:8,mode:'tl',rules});
    e.state.hold.locked=true;
    const original=e.serialize(),demo=new BotDemo(e,{placementMode:'atomic'});
    const snapshot=demo.view();
    const decision=chooseMove(snapshot.visible,{depth:1,maxNodes:600});
    assert.equal(decision.kind,'place');
    demo.prepare({action:{kind:'place'},move:decision.move,execution:decision.execution},snapshot.revision);
    const next=demo.commit(snapshot.revision);
    assert.equal(next.index,1);
    assert.equal(demo.engine.state.frame,24);
    assert.equal(e.serialize(),original);
  }
});
