import test from 'node:test';

import assert from 'node:assert/strict';
import {PLAN,settings,auditGame,summarize} from '../scripts/kiwi-surge-residual-plan.js';
function game(block,leg,won=true,attempt=0){
 const s=settings(block,leg,attempt),winner=won?s.seat:1-s.seat;
 return {setting:s,complete:true,nativeHash:s.policy==='accepted'?PLAN.native.accepted:'a'.repeat(64),identities:{manifest:{candidateNative:'a'.repeat(64)}},nodeBudget:200000,
 counts:{requests:[11,11],placements:[10,10],holds:[1,1],reanalyses:[1,1],terminalHolds:[0,0]},
 result:{reason:'topout',winner,ko:[winner===1,winner===0],failures:[null,null],executionModel:'tl-placement-v1',maxFrames:null,
 framesPerPiece:24,watchdogFrames:360000,seeds:[s.seed,s.seed],holeSeeds:[s.seed+1,s.seed+2],decisions:[11,11],
 parity:[0,1].map(()=>({placements:10,holds:1,mismatches:0})),
 transportStats:[0,1].map(()=>({fallbackRequests:0,rejectedCandidates:0,maxSelectedRank:0}))}};
}
const blocks=()=>Array.from({length:100},(_,block)=>({block,attempt:0,complete:true,attempts:[{attempt:0,games:[0,1,2,3].map(l=>game(block,l,l>=2))}]}));
test('100 disjoint seed blocks give each policy each seat; all retries retain shared seeds',()=>{
 const seeds=new Set();
 for(let b=0;b<100;b++)for(let a=0;a<25;a++){
  const s=[0,1,2,3].map(l=>settings(b,l,a));assert.deepEqual(s.map(x=>[x.policy,x.seat]),[['accepted',0],['accepted',1],['surge-residual',0],['surge-residual',1]]);
  assert.ok(s.every(x=>x.seed===s[0].seed));assert.ok(!seeds.has(s[0].seed));seeds.add(s[0].seed);
 }
 assert.throws(()=>settings(100,0));assert.throws(()=>settings(0,4));assert.throws(()=>settings(0,0,25));
});
test('score maps either seat to policy win; fail closed for cadence, cap, fallback and Hold errors',()=>{
 for(let leg=0;leg<4;leg++)assert.equal(auditGame(game(0,leg),0,leg,0).seriesWinner,0);
 for(const mutate of [g=>g.result.reason='watchdog',g=>g.result.maxFrames=2400,g=>g.result.framesPerPiece=25,
  g=>g.result.seeds[1]++,g=>g.result.parity[0].mismatches++,g=>g.result.transportStats[0].fallbackRequests++,
  g=>g.counts.reanalyses[0]=0,g=>g.nativeHash='bad',g=>g.result.failures[1]={error:'certificate failed'}]){
  const g=game(0,0);mutate(g);assert.throws(()=>auditGame(g,0,0,0));
 }
});
test('paired difference has correct sign and rejects missing or duplicate blocks',()=>{
 const b=blocks(),r=summarize(b);assert.deepEqual(r.acceptedScore,[0,200]);assert.deepEqual(r.candidateScore,[200,0]);assert.equal(r.candidateMinusAccepted,1);assert.deepEqual(r.pairedApprox95CI,[1,1]);
 assert.throws(()=>summarize(b.slice(1)));b[99]=b[0];assert.throws(()=>summarize(b));
});
test('simultaneous KO is unscored and requires replacing the entire block',()=>{
 const b=blocks(),old=b[0].attempts[0];old.games[0].result.ko=[true,true];old.games[0].result.winner=null;
 assert.equal(auditGame(old.games[0],0,0,0).scored,false);assert.throws(()=>summarize(b));
 b[0].attempt=1;b[0].attempts.push({attempt:1,games:[0,1,2,3].map(l=>game(0,l,l>=2,1))});
 assert.equal(summarize(b).retriedBlocks,1);
 b[0].attempts[1].games[1]=game(0,1,false,0);assert.throws(()=>summarize(b));
});
test('CI uses variation of paired differences, not independent game variance',()=>{
 const b=blocks();for(const x of b){const win=x.block%2===0;x.attempts[0].games=[0,1,2,3].map(l=>game(x.block,l,win));}
 const r=summarize(b);assert.deepEqual(r.acceptedScore,[100,100]);assert.deepEqual(r.candidateScore,[100,100]);assert.equal(r.candidateMinusAccepted,0);assert.deepEqual(r.pairedApprox95CI,[0,0]);
 b[0].attempts[0].games[2]=game(0,2,false);assert.ok(summarize(b).pairedApprox95CI[0]<0);
});
