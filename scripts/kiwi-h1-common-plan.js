import assert from 'node:assert/strict';
import {scoreKO} from './kiwi-cc2-series-score.js';
export const PLAN={schema:'h1-common-legacy/1',blocks:100,legsPerBlock:4,seedBase:2026160001,seedStride:100,retryStride:4,maxAttempts:25,
 framesPerPiece:24,nodeBudget:200000,watchdogFrames:360000,buildRun:37004950142,
 native:{accepted:'386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb','h1-off':'96144869b4edd360edafefe7954f1605ba1d40c03da1b7a6a67019f2467b67e2'}};
export function settings(block,leg,attempt=0){
 assert.ok(Number.isInteger(block)&&block>=0&&block<PLAN.blocks);
 assert.ok(Number.isInteger(leg)&&leg>=0&&leg<4);
 assert.ok(Number.isInteger(attempt)&&attempt>=0&&attempt<PLAN.maxAttempts);
 return {block,leg,attempt,policy:leg<2?'accepted':'h1-off',seat:leg%2,seed:PLAN.seedBase+block*PLAN.seedStride+attempt*PLAN.retryStride};
}
export function auditGame(g,block,leg,attempt){
 const s=settings(block,leg,attempt);assert.deepEqual(g.setting,s);assert.equal(g.complete,true);
 assert.equal(g.nativeHash,PLAN.native[s.policy]);assert.equal(g.nodeBudget,PLAN.nodeBudget);
 const r=g.result;assert.equal(r.executionModel,'tl-placement-v1');assert.equal(r.maxFrames,null);
 assert.equal(r.framesPerPiece,24);assert.equal(r.watchdogFrames,PLAN.watchdogFrames);
 assert.deepEqual(r.seeds,[s.seed,s.seed]);assert.deepEqual(r.holeSeeds,[s.seed+1,s.seed+2]);
 assert.ok(r.transportStats.every(t=>t.fallbackRequests===0&&t.rejectedCandidates===0&&t.maxSelectedRank===0));
 for(let i=0;i<2;i++){
  assert.equal(r.parity[i].placements,g.counts.placements[i]);assert.equal(r.parity[i].holds,g.counts.holds[i]);
  assert.equal(r.decisions[i],g.counts.requests[i]);
  assert.equal(g.counts.holds[i],g.counts.reanalyses[i]+g.counts.terminalHolds[i]);
 }
 return scoreKO([0,0],r,s.seat===1);
}
export function summarize(blocks){
 assert.equal(blocks.length,PLAN.blocks);const ids=new Set();
 const rows=blocks.map(b=>{
  assert.ok(!ids.has(b.block));ids.add(b.block);assert.equal(b.complete,true);
  assert.equal(b.attempts.length,b.attempt+1);
  let final;
  b.attempts.forEach((a,i)=>{
   assert.equal(a.attempt,i);assert.equal(a.games.length,4);
   const scores=a.games.map((g,l)=>auditGame(g,b.block,l,i));
   assert.equal(scores.every(s=>s.scored),i===b.attempt,'Only simultaneous KO permits whole-block retry');
   final=scores;
  });
  const on=Number(final[0].seriesWinner===0)+Number(final[1].seriesWinner===0);
  const off=Number(final[2].seriesWinner===0)+Number(final[3].seriesWinner===0);
  return {block:b.block,attempt:b.attempt,onWins:on,offWins:off,difference:(off-on)/2};
 });
 const on=rows.reduce((n,r)=>n+r.onWins,0),off=rows.reduce((n,r)=>n+r.offWins,0);
 const mean=rows.reduce((n,r)=>n+r.difference,0)/rows.length;
 const variance=rows.reduce((n,r)=>n+(r.difference-mean)**2,0)/(rows.length-1),se=Math.sqrt(variance/rows.length);
 return {onScore:[on,200-on],offScore:[off,200-off],offMinusOn:mean,
 pairedApprox95CI:[Math.max(-1,mean-1.984*se),Math.min(1,mean+1.984*se)],
 blocks:rows,retriedBlocks:rows.filter(r=>r.attempt>0).length,
 note:'Difference in KO win rate against frozen Legacy. 100 seed clusters, two seats per policy. Paired t approximation; no automatic promotion, no optional extension. Whole-block simultaneous-KO retries target decisive blocks.'};
}
