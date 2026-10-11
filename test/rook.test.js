import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {enumerateReachable,chooseMove} from '../src/analysis/rook.js';
import * as B from '../src/board.js';
import * as R from '../src/rotation.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';

test('independent search returns a Tetrp-authority validated placement',()=>{
  const game=new Engine({seed:42,rules:{g:0,b2bcharge_base:3}});
  const visible=visibleState(game.state);
  const result=chooseMove(visible,{depth:2,beamWidth:5,maxNodes:650});
  assert.equal(result.kind,'place');
  const proof=validatePlacement(visible,{action:{kind:'place'},move:result.move,execution:result.execution});
  assert.equal(proof.intent.spin,result.execution.spin);
  assert.ok(result.diagnostics.evaluated>0);
});
test('the search enumerates hard drop and nontrivial SRS+ rotations',()=>{
  const game=new Engine({seed:5,rules:{g:0}});
  game.state.piece.type='t';
  const moves=enumerateReachable(game.state.board,game.state.piece,game.state.rules,{maxStates:650});
  assert.ok(moves.some(m=>m.path.at(-1)==='hardDrop'));
  assert.ok(moves.some(m=>m.path.includes('rotate180')));
});
test('Hold path never masquerades as a placement',()=>{
  const game=new Engine({seed:19,rules:{g:0}});
  game.state.hold.locked=true;
  const visible=visibleState(game.state);
  const result=chooseMove(visible,{depth:2,maxNodes:500,beamWidth:4});
  assert.equal(result.kind,'place');
  assert.equal(result.move.useHold,false);
});

test('ROOK ignores fields outside the visible-state contract',()=>{
  const v=visibleState(new Engine({seed:67,rules:{g:0}}).state);
  const opts={depth:2,beamWidth:3,maxNodes:250,maxStates:250};
  const expected=chooseMove(v,opts);
  const altered={...structuredClone(v),internalBag:['i','t'],internalRandom:999,
    previousDraws:['o','z'],otherPlayer:{attack:1000}};
  assert.deepEqual(chooseMove(altered,opts),expected);
});
test('ROOK refuses previews beyond the public five',()=>{
  const v=visibleState(new Engine({seed:67,rules:{g:0}}).state);
  assert.throws(()=>chooseMove({...v,next:[...v.next,'z']}),
    /exactly five publicly visible NEXT/);
});

test('high-stack ROOK obeys TL nolockout instead of inventing a hidden-row KO',()=>{
  for(const nolockout of [true,false]){
    const e=new Engine({mode:'tl',seed:33,
      rules:{g:0,b2bcharge_base:3,nolockout,clutch:true}});
    e.state.piece.type='o';
    e.state.hold.locked=true;
    for(let y=20;y<40;y++){
      e.state.board.rows[y].fill('gb');
      e.state.board.rows[y][9]=null;
    }
    assert.equal(B.legal(e.state.board,e.state.piece),true);
    const visible=visibleState(e.state);
    if(nolockout){
      const chosen=chooseMove(visible,{depth:1,maxNodes:600,beamWidth:24});
      assert.equal(chosen.kind,'place');
      assert.equal(chosen.move.piece,'o');
    }else{
      assert.throws(()=>chooseMove(visible,{depth:1,maxNodes:600,beamWidth:24}),
        /no legal placement/);
    }
  }
});
