import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {DEFAULT_KO_LOCK_CAP,parseMatchSeeds,assertMatchingOpening,assertSimultaneousPair,scoreKO} from '../scripts/rook-ko-protocol.js';

const demo=seed=>new BotDemo(new Engine({mode:'tl',seed,
  rules:{g:0,b2bcharge_base:3}}),{placementMode:'atomic'});

test('each seed is an independent trial, never different bags for opposing players',()=>{
  assert.deepEqual(parseMatchSeeds({SEEDS:'67000, 67001'}),[67000,67001]);
  assert.deepEqual(parseMatchSeeds({SEEDS:'67000'}),[67000]);
  assert.deepEqual(parseMatchSeeds({SEED_A:'1',SEED_B:'8'}),[1,8]);
  for(const bad of ['1,1','1,NaN','1,','1.5','9007199254740992','']){
    assert.throws(()=>parseMatchSeeds({SEEDS:bad}),/seed/i,bad);
  }
  const a=demo(67000),b=demo(67000);
  assert.doesNotThrow(()=>assertMatchingOpening([a,b]));
  assert.equal(assertSimultaneousPair([a,b]),0);
  b.engine.state.frame=1;
  assert.throws(()=>assertSimultaneousPair([a,b]),/clocks diverged/);
});

test('2000-piece KO boundary wins over cap; unresolved and double KO remain unscored',()=>{
  assert.equal(DEFAULT_KO_LOCK_CAP,2000);
  assert.deepEqual(scoreKO({alive:[true,false],rounds:2000,cap:DEFAULT_KO_LOCK_CAP}),{
    scored:true,winnerSlot:0,termination:'KO'});
  assert.deepEqual(scoreKO({alive:[false,true],rounds:2000,cap:DEFAULT_KO_LOCK_CAP}),{
    scored:true,winnerSlot:1,termination:'KO'});
  assert.deepEqual(scoreKO({alive:[true,true],rounds:2000,cap:DEFAULT_KO_LOCK_CAP}),{
    scored:false,winnerSlot:null,termination:'capped'});
  assert.deepEqual(scoreKO({alive:[false,false],rounds:2000,cap:DEFAULT_KO_LOCK_CAP}),{
    scored:false,winnerSlot:null,termination:'double-KO'});
  assert.deepEqual(scoreKO({alive:[false,true],rounds:30,cap:DEFAULT_KO_LOCK_CAP,error:'bad placement'}),{
    scored:false,winnerSlot:null,termination:'invalid-match'});
});
