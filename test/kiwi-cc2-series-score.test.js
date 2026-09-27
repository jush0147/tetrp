import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreKO} from '../scripts/kiwi-cc2-series-score.js';
const base=()=>({reason:'topout',failures:[null,null],parity:[{mismatches:0},{mismatches:0}],ko:[true,false],winner:1});
test('CC2 FT7 maps seat winners to policy identity and reaches seven',()=>{
 assert.deepEqual(scoreKO([6,3],base(),true),{scored:true,seriesWinner:0,score:[7,3]});
 assert.deepEqual(scoreKO([6,3],base(),false),{scored:true,seriesWinner:1,score:[6,4]});
});
test('CC2 FT7 simultaneous KO is unscored and does not mutate score',()=>{
 const score=[6,6];assert.deepEqual(scoreKO(score,{...base(),ko:[true,true],winner:null},false),{scored:false,seriesWinner:null,score:[6,6]});assert.deepEqual(score,[6,6]);
});
test('CC2 FT7 rejects technical results and inconsistent KO/winner records',()=>{
 for(const bad of [{reason:'watchdog'},{reason:'frame-cap'},{failures:[{},null]},
  {parity:[{mismatches:1}]},{ko:[false,false],winner:null},{winner:0}]){
  const score=[6,6];assert.throws(()=>scoreKO(score,{...base(),...bad},true));assert.deepEqual(score,[6,6]);
 }
});
