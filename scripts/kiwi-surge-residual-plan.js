import {VARIANT} from './kiwi-surge-variant.js';
import assert from 'node:assert/strict';
import {auditGame as auditOriginal} from './kiwi-h1-common-plan.js';
import {CONTROL} from './kiwi-wasted-reuse.js';
import {scoreKO} from './kiwi-cc2-series-score.js';
export const PLAN={schema:'surge-residual-reused-control/1',hypothesis:'0.5 * floor(bankBaseUnits * nextLockMultiplier); gross leaf asset; no pending deduction',control:CONTROL,blocks:100,legsPerBlock:4,seedBase:2026160001,seedStride:100,retryStride:4,maxAttempts:25,
 framesPerPiece:24,nodeBudget:200000,watchdogFrames:360000,buildRun:null,
 native:{accepted:'386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb','surge-residual':null}};
if(VARIANT.name!=='residual'){PLAN.variant=VARIANT;PLAN.hypothesis=`Boolean ${VARIANT.boolean}; ${VARIANT.bank} * floor(bankBaseUnits * nextLockMultiplier); gross leaf asset`; }
if(VARIANT.clearOff)PLAN.hypothesis='Only normal_clears, mini_spin_clears and spin_clears tables off; authority and other rewards unchanged';
if(VARIANT.btbClear!==undefined)PLAN.hypothesis=`Only back_to_back_clear 1 -> ${VARIANT.btbClear}; all other accepted parameters unchanged`;
if(VARIANT.wellDepth!==undefined)PLAN.hypothesis=`Only tetris_well_depth 0.3 -> ${VARIANT.wellDepth}; all other accepted parameters unchanged`;
export function settings(block,leg,attempt=0){
 assert.ok(Number.isInteger(block)&&block>=0&&block<PLAN.blocks);
 assert.ok(Number.isInteger(leg)&&leg>=0&&leg<4);
 assert.ok(Number.isInteger(attempt)&&attempt>=0&&attempt<PLAN.maxAttempts);
 return {block,leg,attempt,policy:leg<2?'accepted':'surge-residual',seat:leg%2,seed:PLAN.seedBase+block*PLAN.seedStride+attempt*PLAN.retryStride};
}
export function auditGame(g,block,leg,attempt){
 const s=settings(block,leg,attempt);assert.deepEqual(g.setting,s);assert.equal(g.complete,true);
 assert.equal(g.nativeHash,s.policy==='accepted'?PLAN.native.accepted:g.identities.manifest.candidateNative);assert.match(g.nativeHash,/^[a-f0-9]{64}$/);assert.equal(g.nodeBudget,PLAN.nodeBudget);
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
   const scores=a.games.map((g,l)=>i===0&&l<2?auditOriginal(g,b.block,l,0):auditGame(g,b.block,l,i));
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
 return {acceptedScore:[on,200-on],candidateScore:[off,200-off],candidateMinusAccepted:mean,
 pairedApprox95CI:[Math.max(-1,mean-1.984*se),Math.min(1,mean+1.984*se)],
 blocks:rows,retriedBlocks:rows.filter(r=>r.attempt>0).length,
 note:'Follow-up comparison with previously observed frozen control; not independent confirmation. Difference in KO win rate against frozen Legacy. 100 seed clusters, two seats per policy. Paired t approximation; no automatic promotion, no optional extension. Whole-block simultaneous-KO retries target decisive blocks.'};
}
