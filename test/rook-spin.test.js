import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {forecastSpinClears,hasSpinClearGeometry,chooseMove} from '../src/analysis/rook.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
import {BotDemo} from '../src/analysis/demo.js';

// Deterministically synthesized small cavity boards with no initially full
// lines. In every fixture a specific, legal SRS+ mini-spin completes a line.
const pockets={
  z:['..........','..........','###..####.','####..####','##.#...###','.###.####.','.#########','#.########'],
  l:['..........','..........','..........','..........','######..##','##........','###.######','#.#..####.'],
  s:['..........','.#...##.##','##...#####','#..#...##.','###..#####','....#...##','..#.#....#','.#########'],
  j:['..........','..........','..........','.#.##..#.#','######...#','##.##....#','..#....###','..###....#'],
  t:['..........','..........','..........','..........','..........','.#########','##.#####.#','#######..#'],
  i:['..........','..........','.#####..##','....######','####.#####','####.#..##','###.#####.','##..#.##.#']
};
function prepareFixture(type){
  const e=new Engine({seed:87,mode:'tl',rules:{g:0,spinbonuses:'all-mini+',b2bcharge_base:3}});
  e.state.piece.type=type;
  for(let y=32;y<40;y++)e.state.board.rows[y]=[...pockets[type][y-32]].map(x=>x==='#'?'gb':null);
  assert.deepEqual(B.fullLines(e.state.board),[],'no pre-filled lines allowed');
  return e;
}
function playMove(e,action){
  if(action==='down')return e.descend(1);
  if(action==='moveLeft')return e.move(-1);
  if(action==='moveRight')return e.move(1);
  if(action==='rotateCW')return e.rotate(1);
  if(action==='rotateCCW')return e.rotate(3);
  if(action==='rotate180')return e.rotate(2);
  throw Error('unsupported move '+action);
}
for(const type of Object.keys(pockets)){
  test(`all-mini+ ${type.toUpperCase()} spin-clear forecast is SRS+ reachable, executable, and contributes B2B`,()=>{
    const e=prepareFixture(type),rules=e.state.rules;
    const moves=forecastSpinClears(e.state.board,type,rules,{maxStates:1900,maxSteps:42});
    assert.equal(hasSpinClearGeometry(e.state.board,type,rules),true);
    assert.ok(moves.length>0,'forecast must prove a real spin path');
    const m=moves.find(m=>m.spin!=='none');
    assert.ok(m.path.some(x=>x.startsWith('rotate')));
    const prior=m.path.slice(0,-1),index=prior.findLastIndex(x=>x.startsWith('rotate'));
    assert.ok(index>0,'stage the genuine position immediately before the last rotation');
    for(const a of prior.slice(0,index))assert.equal(playMove(e,a),true,a);
    e.state.attack.btb=3;
    const before=e.serialize(),v=visibleState(e.state);
    const candidate={action:{kind:'place'},move:{piece:type,x:m.piece.x,y:Math.ceil(m.piece.y),rotation:m.piece.r,
      useHold:false,cells:B.cells(m.piece).map(([x,y])=>[x,Math.ceil(y)])},
    execution:{moves:[...prior.slice(index),'hardDrop'],spin:m.spin}};
    const proof=validatePlacement(v,candidate);
    assert.ok(proof.clear.lines>0);
    const demo=new BotDemo(e);demo.prepare(candidate,0);
    const actual=demo.commit(0);
    assert.equal(actual.lastPlacement.spin,m.spin);
    assert.equal(actual.lastPlacement.lines,proof.clear.lines);
    assert.equal(demo.engine.state.attack.btb,4,'non-T mini must keep charging B2B');
    assert.equal(e.serialize(),before,'original input checkpoint unchanged');
  });
}
test('non-T spins are enabled by all-mini+, but not incorrectly credited under T-spins mode',()=>{
  for(const type of ['z','l','s','j','i']){
    const e=prepareFixture(type),r=e.state.rules;
    assert.ok(forecastSpinClears(e.state.board,type,r,{maxStates:1900}).length>0,type);
    const onlyT={...r,spinbonuses:'T-spins'};
    assert.equal(hasSpinClearGeometry(e.state.board,type,onlyT),false);
    assert.deepEqual(forecastSpinClears(e.state.board,type,onlyT),[]);
  }
});
test('sealed overhangs cannot produce a phantom reachable all-mini chain',()=>{
  const e=prepareFixture('z');e.state.board.rows[31].fill('gb');
  assert.equal(hasSpinClearGeometry(e.state.board,'z',e.state.rules),true);
  assert.deepEqual(forecastSpinClears(e.state.board,'z',e.state.rules,{maxStates:1900}),[]);
});
test('the planner can see a public NEXT Z-mini line clear at a future ply',()=>{
  const e=prepareFixture('z');e.state.piece.type='o';e.state.hold.locked=true;e.state.bag.queue[0]='z';
  const options={depth:2,beamWidth:12,maxNodes:1500,maxStates:900,includeRanked:true,
    spinForecastPly:1,spinForecastProbes:12,spinForecastStates:1900};
  const off=chooseMove(visibleState(e.state),{...options,spinForecast:false});
  const on=chooseMove(visibleState(e.state),{...options,spinForecast:true});
  assert.equal(off.diagnostics.forecastedSpinClears,0);
  assert.ok(on.diagnostics.forecastedSpinClears>0);
  assert.ok(on.diagnostics.spinProbes>0);
});
