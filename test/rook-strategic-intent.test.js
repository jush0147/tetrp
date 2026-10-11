import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {advanceStrategicIntent,publicStrategicSignals}
  from '../src/analysis/rook-strategic-intent.js';
import {chooseMove} from '../src/analysis/rook.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
const v=()=>visibleState(new Engine({seed:67800,mode:'tl',rules:{g:0}}).state);
const at=(original,piece,{pending=0,height=0,holes=0,garbage=0}={})=>{
  const z=structuredClone(original);
  z.piecesPlaced=piece;
  const H=z.board.rows.length;
  for(let y=H-height;y<H;y++)if(y>=0)z.board.rows[y][0]=garbage?'gb':'t';
  for(let i=0;i<holes;i++){
    const y=H-2-i;
    if(y>=0){z.board.rows[y][0]=null;z.board.rows[y-1][0]='t';}
  }
  z.attack.pending=pending?[{amt:pending}]:[];
  return z;
};
test('public-only attack/protect/balanced mode and strong emergency override',()=>{
  const original=v();
  const a=advanceStrategicIntent(at(original,0));
  assert.equal(a.mode,'attack');
  assert.equal(a.searchOptions.offenseWeight,7.2);
  assert.deepEqual(a.searchOptions,{offenseWeight:7.2,garbageRecovery:false});
  const b=advanceStrategicIntent(at(original,1,{pending:2,height:9}),a.state);
  assert.equal(b.mode,'attack');
  assert.equal(b.retained,true);
  const reactive=advanceStrategicIntent(
    at(original,1,{pending:2,height:9}),a.state,{reactive:true});
  assert.equal(reactive.mode,'balanced');
  const c=advanceStrategicIntent(at(original,2,{pending:5,height:14}),b.state);
  assert.equal(c.mode,'protect');assert.equal(c.emergency,true);
  assert.equal(c.searchOptions.garbageRecovery,true);
  const d=advanceStrategicIntent(at(original,3,{pending:0}),c.state);
  assert.equal(d.mode,'protect');assert.equal(d.retained,true);
  const e=advanceStrategicIntent(at(original,5,{pending:0}),d.state);
  assert.equal(e.mode,'attack');
  assert.equal(e.newLock,true);
});
test('HOLD reanalysis is not a new piece or lost goal',()=>{
  const original=v(),a=advanceStrategicIntent(original);
  const held=structuredClone(original);
  held.current.type='t'===held.current.type?'i':'t';
  held.hold.locked=true;
  const repeated=advanceStrategicIntent(held,a.state);
  assert.equal(repeated.newLock,false);
  assert.deepEqual(repeated.state,a.state);
  assert.equal(repeated.mode,a.mode);
});
test('hidden future and adversary fields cannot affect public controller',()=>{
  const original=v(),plain=advanceStrategicIntent(original);
  const tainted={...structuredClone(original),
    privateQueue:['i','i'],rng:{seed:999},
    hiddenGarbageHole:4,opponentNext:['t']};
  assert.deepEqual(advanceStrategicIntent(tainted),plain);
  assert.deepEqual(publicStrategicSignals(tainted),
    publicStrategicSignals(original));
});
test('live public strategy search returns real Tetrp authority-legal root',()=>{
  const visible=v();
  const control=advanceStrategicIntent(visible);
  const result=chooseMove(visible,{depth:3,beamWidth:12,
    maxNodes:1600,maxStates:600,maxSteps:42,includeRanked:true,
    ...control.searchOptions});
  assert.ok(result.ranked.length>0);
  const executable=result.ranked.find(a=>a.kind==='place'&&
    validatePlacement(visible,{action:{kind:'place'},
      move:a.move,execution:a.execution}));
  assert.ok(executable,'all policy options still require real SRS+ proof');
});
test('reject invalid public signals or a future intent state',()=>{
  const original=v();
  assert.throws(()=>advanceStrategicIntent(original,null,
    {minCommitLocks:0}),/commitment/);
  assert.throws(()=>advanceStrategicIntent(original,
    {mode:'attack',since:8,lastPiece:8}),/future-peeking/);
  const corrupt=structuredClone(original);corrupt.next.push('t');
  assert.throws(()=>advanceStrategicIntent(corrupt),/NEXT5/);
});
