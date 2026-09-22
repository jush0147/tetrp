import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine,validatePlacement,commitPlacement,commitHold,assertPlacementContract,placementIdentity} from '../src/analysis/placement-authority.js';
import {schedulePlacement} from '../src/analysis/placement-transport.js';
import {match} from '../scripts/kiwi-arena-core.js';
import {normalizeTopRecommendation,prepareKiwi} from '../src/analysis/kiwi.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/transport/legacy-t-spin.json',import.meta.url)));
function setup(Type=PlacementArenaEngine){
  const v=fixture.snapshot,e=new Type({rules:v.rules}),s=e.state;
  s.board=structuredClone(v.board);s.piece=structuredClone(v.current);s.hold={...v.hold};
  s.bag.queue=[...v.next,'i','o'];s.frame=v.frame;s.stats.pieces=v.piecesPlaced;
  Object.assign(s.attack,structuredClone(v.attack));s.attack.pieces=v.piecesPlaced;
  return e;
}
function place(e,action=fixture.action){
  const proof=validatePlacement(visibleState(e.state),action),end=e.state.frame+23;
  while(e.state.frame<end)e.step();
  e.beginFrame([]);e.advanceSegment(.5);
  const actual=commitPlacement(e,proof,end);e.finishFrame();return {proof,actual};
}
function dropAction(e){
  const p=Engine.restore(e.serialize());p.slam(true);const {spin,...move}=placementIdentity(p.state.piece);
  return {action:{kind:'place'},move:{...move,useHold:false},execution:{moves:['hardDrop'],spin}};
}
test('validated direct commit equals the corrected physical path transaction on the regression snapshot',()=>{
  const e=setup(),physical=setup(Engine),end=e.state.frame+23;
  const inputs=schedulePlacement(physical,fixture.action,end);
  for(let f=physical.state.frame;f<=end;f++)physical.step(inputs.filter(x=>x.frame===f));
  const {actual}=place(e);
  assert.equal(actual.locks[0].spin,'full');assert.equal(actual.clear.lines,1);
  for(const k of ['board','attack','hold','bag','playing','reason','lastClear'])assert.deepEqual(e.state[k],physical.state[k],k);
  assert.equal(e.state.stats.lines,physical.state.stats.lines);
  assert.equal(e.state.attack.totals.sent,2);
});
test('forged pose, cells, spin and witness fail before mutating authority',()=>{
  const e=setup(),before=e.serialize();
  for(const mutate of [a=>a.move.x++,a=>a.move.y--,a=>a.move.rotation=0,a=>a.move.piece='i',
    a=>a.move.cells[0][0]++,a=>a.execution.spin='none',a=>a.execution.moves=['hardDrop']]){
    const a=structuredClone(fixture.action);mutate(a);
    assert.throws(()=>validatePlacement(visibleState(e.state),a));assert.equal(e.serialize(),before);
  }
});
test('certificate binds exact root state and cannot be forged or reused',()=>{
  const e=setup(),p=validatePlacement(visibleState(e.state),fixture.action),end=e.state.frame+23;
  while(e.state.frame<end)e.step();e.beginFrame([]);e.advanceSegment(.5);
  assert.throws(()=>commitPlacement(e,structuredClone(p),end),/Untrusted/);
  e.state.board.rows[39][0]=null;assert.throws(()=>commitPlacement(e,p,end),/stale/);
  const f=setup(),q=validatePlacement(visibleState(f.state),fixture.action),last=f.state.frame+23;
  while(f.state.frame<last)f.step();f.beginFrame([]);f.advanceSegment(.5);commitPlacement(f,q,last);
  assert.throws(()=>commitPlacement(f,q,last),/Untrusted/);
});
test('placement clock freezes active motion but retains incoming activation and multiplier growth',()=>{
  const e=setup();e.state.frame=10800;e.state.g=40;
  const cid=e.receive({from:'P2',iid:1,amt:5});e.confirm(cid);
  const original=structuredClone(e.state.piece),p=validatePlacement(visibleState(e.state),fixture.action);
  for(let i=0;i<20;i++)e.step();
  assert.deepEqual(e.state.piece,original);assert.equal(e.state.attack.pending[0].active,true);
  assert.ok(e.state.attack.multiplier>1);
  for(let i=0;i<3;i++)e.step();e.beginFrame([]);e.advanceSegment(.5);
  const result=commitPlacement(e,p,10823);
  assert.equal(result.clear.lines,1);assert.ok(e.state.attack.totals.cancelled>0);
});
test('nonzero ARE and continuous garbage are explicit unsupported placement contracts',()=>{
  for(const change of [s=>s.rules.are=1,s=>s.rules.garbageare=1,s=>s.rules.garbageentry='delayed',s=>s.attack.are.push({amt:1})]){
    const e=setup();change(e.state);assert.throws(()=>assertPlacementContract(e.state),/Unsupported/);
  }
});
test('empty and occupied Hold preserve the public transition and lock Hold',()=>{
  const e=new PlacementArenaEngine({seed:1});
  for(const hold of [null,'t',e.state.piece.type]){
    e.state.hold={piece:hold,locked:false};const s=visibleState(e.state);
    const a={action:{kind:'hold',mode:hold===null?'empty':'occupied',requiresReanalysis:true,samePiece:(hold??s.next[0])===s.current.type}};
    const actual=commitHold(e,s,a);
    assert.equal(actual.current.type,hold??s.next[0]);assert.equal(actual.hold.piece,s.current.type);
    assert.equal(actual.hold.locked,true);assert.equal(e.state.frame,s.frame);
    assert.throws(()=>commitHold(e,visibleState(e.state),a));
  }
});
test('invalid top-1 never reads a second ranked action; failure dump is complete and unscored',async()=>{
  let secondRead=false;
  const bot=()=>({candidates:(function*(){yield {candidateIndex:0,action:{kind:'place'},move:{},execution:{moves:['hardDrop']}};secondRead=true;yield {};})()});
  const r=await match([bot,bot],{maxFrames:24});
  assert.equal(secondRead,false);assert.equal(r.winner,null);assert.equal(r.frames,0);
  for(const f of r.failures){assert.ok(f.snapshot);assert.ok(f.policyAction);assert.ok(f.actual);assert.ok(f.details.provenance);}
});
test('legacy top-1 normalization does not skip an invalid original candidate',()=>{
  const s=visibleState(new Engine().state),p=prepareKiwi(s);
  const action={kind:'invalid'},report={schema:'kiwi-snapshot-result/3',action,candidates:[{action},{action:{kind:'hold',mode:'empty'}}]};
  assert.throws(()=>normalizeTopRecommendation(s,p,report),e=>e.details.stage==='top-1-normalization'&&e.details.policyAction.kind==='invalid');
});
test('placement intent and transaction are independent of SDF, including 40x and instant',()=>{
  const outcomes=[];
  for(const sdf of [6,40,41]){
    const e=setup();e.state.handling.sdf=sdf;
    const {actual}=place(e);outcomes.push({actual,board:e.state.board,attack:e.state.attack});
  }
  assert.deepEqual(outcomes[0],outcomes[1]);assert.deepEqual(outcomes[1],outcomes[2]);
});
test('direct placement retains Surge / All Clear phase order and cancellation through Engine.lock',()=>{
  for(const ac of [false,true]){
    const e=new PlacementArenaEngine();e.spawn('o');
    for(const row of [38,39])e.state.board.rows[row]=Array.from({length:10},(_,x)=>x===4||x===5?null:'gb');
    if(!ac)e.state.board.rows[37][0]='j';
    e.state.attack.btb=11;e.state.attack.pieces=15;e.state.stats.pieces=15;
    const cid=e.receive({from:'P2',iid:1,amt:20});e.confirm(cid);
    const action=dropAction(e),physical=Engine.restore(e.serialize()),end=e.state.frame+23;
    const inputs=schedulePlacement(physical,action,end);
    for(let f=0;f<=end;f++)physical.step(inputs.filter(x=>x.frame===f));
    const {actual}=place(e,action);
    assert.equal(actual.clear.allClear,ac);assert.equal(actual.clear.garbageRows,2);
    assert.deepEqual(e.state.attack,physical.state.attack);assert.deepEqual(e.state.board,physical.state.board);
    const phases=e.trace.filter(x=>x.type==='attack').map(x=>x.phase);
    assert.deepEqual(phases,ac?['ordinary','all-clear']:['surge','surge','surge','ordinary']);
    assert.ok(e.state.attack.totals.cancelled>0);
  }
});
test('direct commit audits terminal lockout and retains post-clear spawn clutch',()=>{
  const dead=new PlacementArenaEngine({rules:{nolockout:false}});dead.spawn('o');
  dead.state.board.rows[19][4]='gb';dead.state.board.rows[19][5]='gb';
  const {actual}=place(dead,dropAction(dead));assert.equal(actual.locks.length,1);assert.equal(dead.state.reason,'lockout');
  const rescued=new PlacementArenaEngine();rescued.spawn('i');rescued.state.piece.x=1;
  for(const row of [17,18])for(const col of [4,5])rescued.state.board.rows[row][col]='gb';
  rescued.state.board.rows[39]=Array.from({length:10},(_,x)=>x<4?null:'gb');rescued.state.bag.queue[0]='o';
  place(rescued,dropAction(rescued));
  assert.equal(rescued.state.playing,true);assert.equal(rescued.state.piece.type,'o');
  assert.ok(rescued.state.piece.y<17.96);assert.ok(rescued.trace.some(x=>x.type==='clutch'));
});
