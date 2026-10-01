import test from 'node:test';
import assert from 'node:assert/strict';
import {config,legSettings,shardLegs,auditAttempt,pairedSummary} from '../scripts/kiwi-visible-t-200-config.js';
function report(leg=0,attempt=0){
 const {seed}=legSettings(leg,attempt);
 return {complete:true,batchValidated:true,leg,seed,nodeBudget:config.nodeBudget,hashes:{accepted:{native:config.baselineNative},'visible-t':{native:config.candidateNative}},runs:{parallel:{counts:{placements:[1,1],holds:[0,0],requests:[1,1]},result:{executionModel:'tl-placement-v1',framesPerPiece:24,maxFrames:null,watchdogFrames:config.watchdogFrames,seeds:[seed,seed],holeSeeds:[seed+1,seed+2],transportStats:[0,1].map(()=>({fallbackRequests:0,rejectedCandidates:0,maxSelectedRank:0})),parity:[0,1].map(()=>({placements:1,holds:0,mismatches:0})),decisions:[1,1],reason:'topout',failures:[null,null],ko:[false,true],winner:0}}}};
}
test('fixed 100 paired seeds cover exactly 200 legs and disjoint retry streams',()=>{
 assert.deepEqual(Array.from({length:config.shards},(_,i)=>shardLegs(i)).flat(),Array.from({length:200},(_,i)=>i));
 const seeds=new Set();for(let p=0;p<100;p++)for(let a=0;a<25;a++){
  const x=legSettings(p*2,a),y=legSettings(p*2+1,a);assert.equal(x.seed,y.seed);assert.equal(x.swapped,false);assert.equal(y.swapped,true);
  for(let offset=0;offset<3;offset++){assert.ok(!seeds.has(x.seed+offset));seeds.add(x.seed+offset);}
 }
 assert.throws(()=>legSettings(200));assert.throws(()=>legSettings(0,25));assert.throws(()=>shardLegs(50));
});
test('audit maps seats, retries simultaneous KO and rejects technical/parity/seed failures',()=>{
 assert.equal(auditAttempt(report(0),0,0).seriesWinner,0);assert.equal(auditAttempt(report(1),1,0).seriesWinner,1);
 const draw=report();draw.runs.parallel.result.ko=[true,true];draw.runs.parallel.result.winner=null;assert.equal(auditAttempt(draw,0,0).scored,false);
 for(const mutate of [r=>r.runs.parallel.result.transportStats[0].fallbackRequests++,r=>r.runs.parallel.result.parity[0].mismatches++,r=>r.runs.parallel.result.reason='watchdog',r=>r.runs.parallel.result.seeds[1]++,r=>r.runs.parallel.counts.holds[0]++,r=>r.hashes.accepted.native='wrong',r=>r.complete=false]){const r=report();mutate(r);assert.throws(()=>auditAttempt(r,0,0));}
});
test('summary uses paired blocks and refuses missing/duplicate games',()=>{
 const legs=Array.from({length:200},(_,leg)=>({...legSettings(leg),complete:true,winner:Math.floor(leg/2)%2}));
 const s=pairedSummary(legs);assert.deepEqual(s.score,[100,100]);assert.deepEqual(s.blockCounts,{'2-0':50,'1-1':0,'0-2':50});assert.equal(s.exactTwoSidedSweepSignP,1);assert.ok(s.pairedApprox95CI[0]<0.41);assert.ok(s.pairedApprox95CI[1]>0.59);
 assert.throws(()=>pairedSummary(legs.slice(1)));assert.throws(()=>pairedSummary([...legs.slice(1),legs[1]]));
 const ties=legs.map(l=>({...l,winner:l.leg%2}));assert.equal(pairedSummary(ties).exactTwoSidedSweepSignP,1);
});
