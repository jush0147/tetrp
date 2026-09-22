import test from 'node:test';
import assert from 'node:assert/strict';
import {describeFt7} from '../scripts/kiwi-ft7-notify.js';
import {firstTo} from '../scripts/kiwi-arena-core.js';

test('unattended FT7 stops on first technical fault and does not award a point',async()=>{
  let calls=0;
  const report=await firstTo([()=>{},()=>{}],{stopOnTechnical:true,playMatch:async()=>{
    calls++;return {reason:'policy-or-transport-failure',winner:null,ko:[false,false],failures:[{message:'bad top-1'},null]};
  }});
  assert.equal(calls,1);assert.equal(report.complete,false);assert.equal(report.reason,'technical-failure');assert.deepEqual(report.score,[0,0]);
});
test('notification distinguishes completed audited FT7 from interruption and failure',()=>{
  const game={scored:true,reason:'topout',failures:[null,null],parity:[{placements:50,holds:2,mismatches:0},{placements:50,holds:3,mismatches:0}]};
  const report={complete:true,executionModel:'tl-placement-v1',score:[7,0],games:Array.from({length:7},()=>structuredClone(game))};
  assert.equal(describeFt7(report,'success').complete,true);
  assert.equal(describeFt7(report,'failure').complete,false);
  report.games[0].parity[0].mismatches=1;
  assert.equal(describeFt7(report,'success').complete,false);
  assert.equal(describeFt7(undefined,'failure').complete,false);
  assert.match(describeFt7({complete:false,score:[3,2],games:[]},'failure').message,/Native 3 : 2 Legacy/);
});
