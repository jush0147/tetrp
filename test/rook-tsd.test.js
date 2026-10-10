import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {BotDemo} from '../src/analysis/demo.js';
import {chooseMove} from '../src/analysis/rook.js';
import {tsdScaffolds} from '../src/analysis/rook-tsd.js';

function setup(){
  const e=new Engine({seed:31,mode:'tl',rules:{g:0,spinbonuses:'all-mini+',b2bcharge_base:3}});
  e.state.piece.type='o';e.state.hold.locked=true;e.state.bag.queue[0]='t';
  const b=e.state.board,x=3,y=37;
  for(let xx=0;xx<10;xx++){
    b.rows[y][xx]=Math.abs(xx-x)<=1?null:'gb';
    b.rows[y+1][xx]=xx===x?null:'gb';
  }
  return e;
}

test('TSD-specific tactical search constructs slot with O, then real authority executes full TSD',()=>{
  const e=setup(),before=e.serialize();
  assert.ok(tsdScaffolds(e.state.board,e.state.rules,{maxMissing:0}).some(p=>!p.fullSpinGeometry));
  const demo=new BotDemo(e,{placementMode:'atomic'});
  const params={depth:2,beamWidth:20,maxNodes:2400,maxStates:1400,
    includeRanked:true,spinForecast:false,tsdTacticalProbes:20,tsdTacticalStates:2400};
  const choice=chooseMove(demo.view().visible,params);
  assert.equal(choice.kind,'place');
  assert.ok(choice.diagnostics.tsdProven>0,'known next T must have a proved full TSD');
  demo.prepare({action:{kind:'place'},move:choice.move,execution:choice.execution},0);
  demo.commit(0);
  assert.equal(demo.view().visible.current.type,'t');
  const second=chooseMove(demo.view().visible,{...params,depth:1});
  assert.equal(second.move.piece,'t');
  assert.equal(second.execution.spin,'full');
  demo.prepare({action:{kind:'place'},move:second.move,execution:second.execution},1);
  const after=demo.commit(1);
  assert.equal(after.lastPlacement.spin,'full');
  assert.equal(after.lastPlacement.lines,2);
  assert.equal(demo.engine.state.attack.btb,1);
  assert.equal(demo.engine.state.attack.totals.generated,5,'TSD base 4 + 1 garbage bonus');
  assert.equal(demo.engine.state.frame,48);
  assert.equal(e.serialize(),before,'original replay checkpoint remains immutable');
});

test('an empty board does not contain a phantom TSD scaffold',()=>{
  const e=new Engine({seed:1,mode:'tl'});
  assert.deepEqual(tsdScaffolds(e.state.board,e.state.rules),[]);
  const choice=chooseMove(visibleState(e.state),{depth:1,tsdTacticalProbes:8,maxNodes:500});
  assert.equal(choice.diagnostics.tsdProven,0);
});

test('the TSD builder never uses a hidden sixth preview',()=>{
  const e=setup(),v=visibleState(e.state);
  const options={depth:2,beamWidth:20,maxNodes:2400,maxStates:1400,
    spinForecast:false,tsdTacticalProbes:20,tsdTacticalStates:2400};
  const original=chooseMove(v,options);
  const injected={...structuredClone(v),unrevealedQueue:['t','t'],hiddenGarbageHole:5};
  assert.deepEqual(chooseMove(injected,options),original);
  assert.throws(()=>chooseMove({...v,next:[...v.next,'t']},options),/exactly five/);
});


test('TSD scaffold never credits uncleareable permanent garbage in either target row',()=>{
  const e=setup(),board=e.state.board,rules=e.state.rules;
  const options=tsdScaffolds(board,rules,{maxMissing:5});
  const candidate=options.find(x=>x.rows.includes(37)&&x.rows.includes(38));
  assert.ok(candidate,'original geometry must include the supported target row pair');
  for(const row of candidate.rows){
    const impossible=structuredClone(board);
    impossible.rows[row][0]='gbd';
    const after=tsdScaffolds(impossible,rules,{maxMissing:5});
    assert.ok(!after.some(x=>x.rows[0]===candidate.rows[0]&&
      x.rows[1]===candidate.rows[1]),
    'a permanently blocked line cannot become a genuine two-row TSD slot');
  }
  const clearable=structuredClone(board);
  clearable.rows[candidate.rows[0]][0]='gb';
  assert.ok(tsdScaffolds(clearable,rules,{maxMissing:5}).some(x=>
    x.rows[0]===candidate.rows[0]&&x.rows[1]===candidate.rows[1]));
});
