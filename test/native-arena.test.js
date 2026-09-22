import test from 'node:test';
import assert from 'node:assert/strict';
import {match,pairedMatches,firstTo} from '../scripts/kiwi-arena-core.js';
import {analyze,recommendation} from '../src/analysis/native/search.js';
const bot=s=>recommendation(analyze(s,{horizon:1}));
test('arena A/A side swap preserves deterministic authority result, reveals Hold and only passes snapshots',async()=>{
  const inspected=s=>{
    assert.equal(s.next.length,5);for(const forbidden of ['bag','holes','events','opponent','history','checkpoint'])assert.equal(forbidden in s,false);
    return bot(s);
  };
  const r=await pairedMatches([inspected,inspected],{pairs:1,maxFrames:96});
  assert.equal(r.failureGames,0);assert.equal(r.score,null);assert.equal(r.unscoredGames,2);
  assert.deepEqual(r.games[0].totals,r.games[1].totals);
  assert.deepEqual(r.games[0].pieces,[4,4]);assert.ok(r.games[0].holds.some(n=>n>0));
  for(const g of r.games)for(let i=0;i<2;i++){
    assert.equal(g.parity[i].placements,g.pieces[i]);assert.equal(g.parity[i].holds,g.holds[i]);
    assert.equal(g.parity[i].mismatches,0);assert.equal(g.transportStats[i].fallbackRequests,0);
  }
});
test('arena never awards a win for invalid policy output, even in a bounded diagnostic',async()=>{
  const r=await match([()=>({action:{kind:'invalid'}}),bot],{maxFrames:24});
  assert.equal(r.winner,null);assert.equal(r.reason,'policy-or-transport-failure');assert.ok(r.failures[0]);
});

test('KO-only watchdog and policy failure never award a win',async()=>{
  const failure=await match([()=>({action:{kind:'invalid'}}),bot],{maxFrames:null,watchdogFrames:24});
  assert.equal(failure.winner,null);assert.equal(failure.reason,'policy-or-transport-failure');
  const watchdog=await match([bot,bot],{maxFrames:null,watchdogFrames:1});
  assert.equal(watchdog.winner,null);assert.equal(watchdog.reason,'watchdog');
});

test('first-to scores only KO, replays double KO, switches seat and reseeds every attempt',async()=>{
  const a=()=>{},b=()=>{};let n=0;const seeds=new Set();
  const r=await firstTo([a,b],{target:2,playMatch:async(bots,options)=>{
    assert.equal(options.framesPerPiece,24);assert.equal(options.maxFrames,null);
    assert.equal(bots[0],n%2?b:a);for(const s of [...options.seeds,...options.holeSeeds]){assert.ok(!seeds.has(s));seeds.add(s);}
    n++;
    if(n===1)return {reason:'watchdog',winner:null,ko:[false,false],failures:[null,null]};
    if(n===2)return {reason:'topout',winner:null,ko:[true,true],failures:[null,null]};
    const seat=n%2?0:1;
    return {reason:'topout',winner:seat,ko:seat===0?[false,true]:[true,false],failures:[null,null]};
  }});
  assert.equal(r.complete,true);assert.deepEqual(r.score,[2,0]);assert.equal(r.games.length,4);
  assert.deepEqual(r.games.map(g=>g.scored),[false,false,true,true]);
});
