import assert from 'node:assert/strict';
import {VARIANT} from './kiwi-surge-variant.js';
import {scoreKO} from './kiwi-cc2-series-score.js';

export const SOURCES=Object.freeze({
 'well-double':{run:37200443114,commit:'c9feb5a5148b9fe6cd685bc73ebbc5bd0f207f28',native:'956e0573bff5e8668455adfa0fd642f9aeb0b06a9bb6e51a8ed7ead8f5ad8e82'},
 'clear-off':{run:37173465050,commit:'caa64a4c5b5fca8b8d701f5c9b4bf461cecf3c41',native:'a80397591038c6cf19202e81cd0327ea5fd0293804c0fd3f885a4e9a35860257'},
});
assert.ok(Object.hasOwn(SOURCES,VARIANT.name),'Only the two preregistered confirmation candidates');
export const PLAN={schema:'kiwi-evaluator-direct-confirm/1',variant:VARIANT,source:SOURCES[VARIANT.name],
 opponent:'frozen aligned accepted (not Legacy)',blocks:100,legsPerBlock:2,
 seedBase:2026200001,seedStride:100,retryStride:4,maxAttempts:25,
 framesPerPiece:24,nodeBudget:200000,watchdogFrames:360000,
 acceptedNative:'386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb',
 decision:{family:['well-double','clear-off'],familyAlpha:0.05,perCandidateTwoSidedAlpha:0.025,
  require:'candidate win rate > 50%, paired 95% lower > 50%, exact sweep sign p <= .025',
  automaticPromotion:false,optionalExtension:false}};

export function settings(block,leg,attempt=0){
 assert.ok(Number.isInteger(block)&&block>=0&&block<PLAN.blocks);
 assert.ok(Number.isInteger(leg)&&leg>=0&&leg<2);
 assert.ok(Number.isInteger(attempt)&&attempt>=0&&attempt<PLAN.maxAttempts);
 return {block,leg,attempt,seat:leg,seed:PLAN.seedBase+block*PLAN.seedStride+attempt*PLAN.retryStride};
}
export function auditGame(g,block,leg,attempt){
 const s=settings(block,leg,attempt);assert.deepEqual(g.setting,s);assert.equal(g.complete,true);
 assert.equal(g.nodeBudget,PLAN.nodeBudget);
 assert.deepEqual(g.nativeHashes,[0,1].map(i=>i===s.seat?PLAN.source.native:PLAN.acceptedNative));
 const r=g.result;assert.equal(r.executionModel,'tl-placement-v1');assert.equal(r.maxFrames,null);
 assert.equal(r.framesPerPiece,24);assert.equal(r.watchdogFrames,PLAN.watchdogFrames);
 assert.deepEqual(r.seeds,[s.seed,s.seed]);assert.deepEqual(r.holeSeeds,[s.seed+1,s.seed+2]);
 assert.equal(r.transportStats.length,2);assert.equal(r.parity.length,2);assert.equal(r.failures.length,2);
 assert.ok(r.transportStats.every(t=>t.fallbackRequests===0&&t.rejectedCandidates===0&&t.maxSelectedRank===0));
 for(let i=0;i<2;i++){
  for(const k of ['requests','placements','holds','reanalyses','terminalHolds'])assert.ok(Number.isInteger(g.counts[k][i])&&g.counts[k][i]>=0);
  assert.equal(r.parity[i].placements,g.counts.placements[i]);assert.equal(r.parity[i].holds,g.counts.holds[i]);
  assert.equal(r.decisions[i],g.counts.requests[i]);
  assert.equal(g.counts.holds[i],g.counts.reanalyses[i]+g.counts.terminalHolds[i]);
 }
 return scoreKO([0,0],r,s.seat===1);
}
export function summarize(blocks){
 assert.equal(blocks.length,100);const seen=new Set();
 const rows=blocks.map(b=>{
  settings(b.block,0);assert.ok(!seen.has(b.block));seen.add(b.block);assert.equal(b.complete,true);
  assert.equal(b.attempts.length,b.attempt+1);let scores;
  b.attempts.forEach((a,i)=>{
   assert.equal(a.attempt,i);assert.equal(a.games.length,2);
   scores=a.games.map((g,l)=>auditGame(g,b.block,l,i));
   assert.equal(scores.every(s=>s.scored),i===b.attempt,'Only simultaneous KO permits whole-pair retry');
  });
  return {block:b.block,attempt:b.attempt,wins:scores.filter(s=>s.seriesWinner===0).length};
 });
 const wins=rows.reduce((n,r)=>n+r.wins,0),mean=wins/200;
 const variance=rows.reduce((n,r)=>n+(r.wins/2-mean)**2,0)/99,se=Math.sqrt(variance/100);
 const sweeps=rows.filter(r=>r.wins===2).length,losses=rows.filter(r=>r.wins===0).length;
 const n=sweeps+losses,k=Math.min(sweeps,losses);let term=2**(-n),tail=term;
 for(let i=1;i<=k;i++){term*=(n-i+1)/i;tail+=term;}
 const p=Math.min(1,2*tail),ci=[Math.max(0,mean-1.984*se),Math.min(1,mean+1.984*se)];
 return {score:[wins,200-wins],candidateWinRate:mean,pairedApprox95CI:ci,
  blockCounts:{'2-0':sweeps,'1-1':100-n,'0-2':losses},exactTwoSidedSweepSignP:p,
  meetsPreregisteredCriterion:mean>0.5&&ci[0]>0.5&&p<=0.025,
  retriedBlocks:rows.filter(r=>r.attempt>0).length,blocks:rows,
  note:'100 fresh seed pairs; direct versus accepted, not Legacy. Bonferroni family of two using exact sweep sign test; approximate cluster CI also reported. No automatic promotion or optional extension. Whole-pair sim-KO retries target decisive pairs.'};
}
