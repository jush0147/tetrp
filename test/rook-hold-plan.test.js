import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove} from '../src/analysis/rook.js';

// A held piece is NOT executable until the canonical authority exchanges it.
// No extra preview or engine checkpoint is allowed into the search.
const budget={depth:3,beamWidth:14,maxNodes:1700,maxStates:650,
  maxSteps:42,spinForecast:false,futureReachableProbes:3,
  includeRanked:true};

test('optional post-Hold plan is verified after canonical exchange and baseline stays unchanged',()=>{
  let observed=0;
  for(let seed=1;seed<=16&&observed<2;seed++){
    const demo=new BotDemo(new Engine({mode:'tl',seed,
      rules:{g:0,b2bcharge_base:3}}),{placementMode:'atomic'});
    const v=demo.view();
    const plain=chooseMove(v.visible,budget);
    const planned=chooseMove(v.visible,{...budget,includeHoldPlan:true});
    const {holdPlan,...without}=planned;
    assert.deepEqual(without,plain,'diagnostic plan never changes root policy');
    if(planned.kind!=='hold'){
      assert.equal(holdPlan,undefined);
      continue;
    }
    observed++;
    assert.equal(holdPlan.kind,'place');
    assert.equal(holdPlan.move.piece,planned.mode==='occupied'
      ?v.visible.hold.piece:v.visible.next[0]);
    demo.prepare({action:{kind:'hold',mode:planned.mode,
      samePiece:planned.samePiece}},v.revision);
    const after=demo.commit(v.revision);
    assert.equal(after.visible.hold.locked,true);
    assert.equal(after.visible.current.type,holdPlan.move.piece);
    // This intentionally exercises authority path/spin/cells proof, not
    // a visual equality or speculative placement reimplementation.
    assert.equal(demo.prepare({action:{kind:'place'},
      move:holdPlan.move,execution:holdPlan.execution},after.revision).kind,'place');
    const played=demo.commit(after.revision);
    assert.equal(played.state.stats.pieces,1);
  }
  assert.ok(observed>0,'exercise an actual Hold choice, not just ordinary placements');
});
