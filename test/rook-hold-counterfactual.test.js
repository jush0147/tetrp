import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {enumerateReachable,rookBoardKey} from '../src/analysis/rook.js';
import * as B from '../src/board.js';
import {runHoldCounterfactual} from '../scripts/rook-hold-counterfactual.js';

// Fast genuine authority mini-continuation: caps are deliberately UNSCORED.
// This test validates legal branching and the convergence observation schema,
// never claims KO strength or replaces the 2000-lock workflow.
const makeDemo=seed=>new BotDemo(new Engine({mode:'tl',seed,
  rules:{g:0,gincrease:0,b2bcharge_base:3},
  handling:{arr:0,das:1,dcd:0,sdf:20,safelock:false,cancel:false,
    may20g:true,irs:'off',ihs:'off'}}),{placementMode:'atomic'});
function directPublicMove(demo){
  const v=demo.view();
  const x=enumerateReachable(v.visible.board,v.visible.current,
    v.visible.rules,{maxStates:1200,maxSteps:42})
    .find(m=>m.spin==='none'&&m.path.at(-1)==='hardDrop');
  if(!x)throw Error('No direct SRS+ placement found');
  const p=x.piece,move={piece:p.type,x:p.x,y:Math.ceil(p.y),
    rotation:p.r,useHold:false,
    cells:B.cells(p).map(([xx,yy])=>[xx,Math.ceil(yy)])};
  const request={action:{kind:'place'},move,
    execution:{moves:x.path,spin:x.spin}};
  demo.prepare(request,v.revision);
  return {revision:v.revision,placement:move,executionSpin:x.spin,
    holdCount:0,nodes:0,searchMs:0};
}
test('Hold/direct authority fork has distinct first moves and safe equality windows',()=>{
  const demos=[makeDemo(67922),makeDemo(67922)];
  const original=demos.map(d=>d.engine.serialize());
  const v=demos[0].view().visible;
  const probe=demos[0].fork(),before=probe.view();
  probe.prepare({action:{kind:'hold',mode:'empty'}},before.revision);
  probe.commit(before.revision);
  const placed=directPublicMove(probe);
  const forecast={preBoardKey:rookBoardKey(v.board),preCurrent:v.current.type,
    preHold:v.hold.piece,prePending:0,
    preBtb:v.attack?.btb??0,preCombo:v.attack?.combo??0,
    useHold:true,piece:placed.placement.piece,
    cells:placed.placement.cells,spin:placed.executionSpin};
  const result=runHoldCounterfactual({demos,kinds:['rook','kiwi'],
    forecast,seed:67922,turn:0,
    prepareUntilPlace:directPublicMove,cap:3});
  assert.equal(result.verifiedFirstActionDifference,true);
  assert.equal(result.reactive.forced,false);
  assert.equal(result.retained.forced,true);
  assert.equal(result.reactive.error,null);
  assert.equal(result.retained.error,null);
  assert.equal(result.reactive.scored,false);
  assert.equal(result.retained.scored,false);
  assert.equal(result.deltaKO,null);
  assert.equal(result.equality[0].afterLocks,1);
  assert.equal(result.equality[0].rookPublicEqual,false);
  assert.equal(result.firstPrivatePairConvergence===null||
    Number.isInteger(result.firstPrivatePairConvergence),true);
  assert.ok(result.equality.length>=1&&result.equality.length<=3);
  assert.deepEqual(demos.map(d=>d.engine.serialize()),original);
  assert.equal('fingerprints' in result.reactive,false);
  assert.equal('fingerprints' in result.retained,false);
  assert.equal(JSON.stringify(result).includes('privateBag'),false);
});
