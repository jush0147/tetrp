import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {publicBoardFeatures,buildRealizedWindows,FEATURE_NAMES}
  from '../src/analysis/rook-realized-value-data.js';

const vis=seed=>visibleState(new Engine({mode:'tl',seed,rules:{g:0}}).state);
const totals=i=>({generated:3*i,sent:2*i,cancelled:i,
  tanked:0,received:0});
const lock=(seed,slot,turn,count=10)=>({
  seed,slot,kind:slot===0?'rook':'kiwi',turn,
  visible:vis(seed),authorityBeforeTotals:totals(turn),
  outcome:{alive:turn<count-1,combatTotals:totals(turn+1)}
});

test('offline features are public NEXT5 only, stable and typed',()=>{
  const v=vis(67610),unchanged=structuredClone(v);
  const a=publicBoardFeatures(v);
  assert.deepEqual(Object.keys(a),FEATURE_NAMES);
  assert.ok(Object.values(a).every(Number.isFinite));
  const polluted={...v,privateFutureBag:['t','t'],hiddenHole:9,
    nextSixth:'t',winnerTomorrow:'kiwi'};
  assert.deepEqual(publicBoardFeatures(polluted),a);
  assert.deepEqual(v,unchanged);
  assert.throws(()=>publicBoardFeatures({...v,next:[...v.next,'i']}),
    /player-visible/);
  const occupied=structuredClone(v);
  const H=occupied.board.rows.length;
  occupied.board.rows[H-3][3]='t';
  occupied.board.rows[H-1][3]='t';
  const hole=publicBoardFeatures(occupied);
  assert.ok(hole.holes>a.holes&&hole.covered>a.covered);
});
test('horizon labels are actual POST-authority counter deltas; tail is censored',()=>{
  const traces=[...Array.from({length:10},(_,i)=>lock(67610,0,i)),
    ...Array.from({length:10},(_,i)=>({
      ...lock(67611,1,i),
      outcome:{alive:true,combatTotals:totals(i+1)}
    }))];
  const ds=buildRealizedWindows(traces,{
    horizon:3,matchCaps:new Map([[67610,'KO'],[67611,'capped']])});
  assert.equal(ds.independentSeeds,2);
  assert.equal(ds.rawLocks,20);
  assert.equal(ds.windows.length,16);
  assert.equal(ds.censored.length,4);
  for(const e of ds.windows){
    assert.equal(e.futureLocks,3);
    assert.equal(e.targets.sent,6);
    assert.equal(e.targets.generated,9);
    assert.equal(e.targets.cancelled,3);
    assert.ok([67610,67611].includes(e.seed));
  }
  assert.deepEqual(ds.censored.filter(x=>x.seed===67610).map(x=>x.reason),
    ['KO-before-horizon','KO-before-horizon']);
  assert.deepEqual(ds.censored.filter(x=>x.seed===67611).map(x=>x.reason),
    ['capped','capped']);
});
test('invalid authority metadata or broken time sequences cannot train',()=>{
  const rows=[lock(67620,0,0),lock(67620,0,2),lock(67620,0,3)];
  assert.throws(()=>buildRealizedWindows(rows,{horizon:2}),
    /Non-contiguous/);
  const bad=[lock(67620,0,0),lock(67620,0,1)];
  bad[0].authorityBeforeTotals=null;
  assert.throws(()=>buildRealizedWindows(bad,{horizon:2}),
    /Missing positive authority combat totals/);
  assert.throws(()=>buildRealizedWindows([lock(67620,0,0)],{horizon:0}),
    /Invalid complete future window/);
});
