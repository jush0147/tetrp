import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyPreflight} from '../scripts/kiwi-residual-arena-identity.js';

const {PLAN,settings,auditGame,summarize}=await import('../scripts/kiwi-residual-arena-plan.js');


function game(block,leg,won=true,attempt=0){
 const s=settings(block,leg,attempt),winner=won?s.seat:1-s.seat;
 return {setting:s,complete:true,nodeBudget:200000,
  nativeHashes:[0,1].map(i=>i===s.seat?PLAN.source.native:PLAN.acceptedNative),
  counts:{requests:[11,11],placements:[10,10],holds:[1,1],reanalyses:[1,1],terminalHolds:[0,0]},
  result:{reason:'topout',winner,ko:[winner===1,winner===0],failures:[null,null],executionModel:'tl-placement-v1',maxFrames:null,
   framesPerPiece:24,watchdogFrames:360000,seeds:[s.seed,s.seed],holeSeeds:[s.seed+1,s.seed+2],decisions:[11,11],
   parity:[0,1].map(()=>({placements:10,holds:1,mismatches:0})),
   transportStats:[0,1].map(()=>({fallbackRequests:0,rejectedCandidates:0,maxSelectedRank:0}))}};
}
const blocks=()=>Array.from({length:100},(_,block)=>({block,attempt:0,complete:true,
 attempts:[{attempt:0,games:[game(block,0),game(block,1)]}]}));

test('cost exception only admits the completed frozen preflight, not missing correctness',()=>{
 const s={sourceSha:PLAN.source.commit,complete:true,costGate:'not met',activationGate:'passed',placements:20,holds:8,changedTop1:2,witnesses:480,
  measurements:Array(60).fill({}),rows:Array.from({length:20},()=>({off:{report:{a:1}},accepted:{report:{a:1}},on:{report:{b:2}},trace:{report:{b:2}},parity:{actual:{}}}))};
 verifyPreflight(s);
 for(const mutate of [s=>s.sourceSha='other',s=>s.complete=false,s=>s.placements=19,s=>s.rows[0].trace.report.b=3]){const d=structuredClone(s);mutate(d);assert.throws(()=>verifyPreflight(d));}
});
test('fresh seed pairs and reserved retries are disjoint; candidate occupies each seat',()=>{
 const seen=new Set();for(let b=0;b<100;b++)for(let a=0;a<25;a++){
  const l=settings(b,0,a),r=settings(b,1,a);assert.equal(l.seed,r.seed);assert.equal(l.seat,0);assert.equal(r.seat,1);
  assert.ok(!seen.has(l.seed));seen.add(l.seed);assert.ok(l.seed>2026170000);
 }
 for(const args of [[100,0],[0,2],[0,0,25],[-1,0]])assert.throws(()=>settings(...args));
});
test('direct score follows candidate identity after seat swap',()=>{
 for(const leg of [0,1])for(const win of [true,false])assert.equal(auditGame(game(0,leg,win),0,leg,0).seriesWinner,win?0:1);
});
test('reject wrong binaries, cadence, non-KO, fallback, rules/certificate error and Hold mismatch',()=>{
 for(const mutate of [g=>g.nativeHashes.reverse(),g=>g.result.reason='watchdog',g=>g.result.maxFrames=48,
  g=>g.result.framesPerPiece=25,g=>g.result.seeds[1]++,g=>g.result.parity[0].mismatches++,
  g=>g.result.transportStats[0].fallbackRequests++,g=>g.result.transportStats[0].rejectedCandidates++,
  g=>g.result.failures[0]={message:'unsupported rule / certificate failure'},g=>g.counts.reanalyses[0]=0]){
  const g=game(0,0);mutate(g);assert.throws(()=>auditGame(g,0,0,0));
 }
 const g=game(0,0);g.counts.reanalyses[0]=0;g.counts.terminalHolds[0]=1;assert.ok(auditGame(g,0,0,0).scored);
});
test('only sim-KO retries entire pair; technical failures cannot be retried into success',()=>{
 const b=blocks(),first=b[0].attempts[0];first.games[0].result.ko=[true,true];first.games[0].result.winner=null;
 assert.equal(auditGame(first.games[0],0,0,0).scored,false);assert.throws(()=>summarize(b));
 b[0].attempt=1;b[0].attempts.push({attempt:1,games:[game(0,0,true,1),game(0,1,true,1)]});
 assert.equal(summarize(b).retriedBlocks,1);
 first.games[0].result.failures[0]={message:'technical'};assert.throws(()=>summarize(b));
});
test('reject missing, duplicate blocks and stale seeds',()=>{
 assert.throws(()=>summarize(blocks().slice(1)));const b=blocks();b[99]=b[0];assert.throws(()=>summarize(b));
 const c=blocks();c[0].attempts[0].games[1].setting.seed++;assert.throws(()=>summarize(c));
});
test('cluster statistics and fixed single-test criterion distinguish tied, strong and wrong-direction scores',()=>{
 const b=blocks();assert.equal(summarize(b).meetsPreregisteredCriterion,true);
 for(const x of b)x.attempts[0].games=[game(x.block,0,true),game(x.block,1,false)];
 let r=summarize(b);assert.deepEqual(r.score,[100,100]);assert.deepEqual(r.pairedApprox95CI,[.5,.5]);
 assert.equal(r.exactTwoSidedSweepSignP,1);assert.equal(r.meetsPreregisteredCriterion,false);
 // Six candidate sweeps, no losses: p=.03125 passes the one-candidate .05 threshold.
 for(let i=0;i<6;i++)b[i].attempts[0].games[1]=game(i,1,true);
 r=summarize(b);assert.equal(r.exactTwoSidedSweepSignP,.03125);assert.ok(r.pairedApprox95CI[0]>.5);assert.equal(r.meetsPreregisteredCriterion,true);
 b[6].attempts[0].games[1]=game(6,1,true);assert.equal(summarize(b).meetsPreregisteredCriterion,true);
 for(const x of b)x.attempts[0].games=[game(x.block,0,false),game(x.block,1,false)];
 r=summarize(b);assert.deepEqual(r.score,[0,200]);assert.equal(r.meetsPreregisteredCriterion,false);
});
