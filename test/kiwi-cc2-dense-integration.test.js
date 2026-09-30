import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeDense} from '../scripts/kiwi-cc2-dense-integration-summary.js';
import pilot from '../docs/audits/cc2-alignment/VISIBLE_T_PILOT.json' with {type:'json'};

function fixtures(){return Array.from({length:8},(_,leg)=>{
 const seed=2026100001+Math.floor(leg/2)*100,swapped=leg%2===1;
 return {batchLeg:leg,pair:Math.floor(leg/2),complete:true,batchScored:true,smokeOnly:false,status:'batch-leg-completed',
  maxFrames:null,nodeBudget:200000,framesPerPiece:24,executionModel:'tl-placement-v1',artifactRun:36380902069,
  artifactHashes:{'cold_clear_2_bg.wasm':'bd21800742a8d5abd54118cb51f458fb987d8f6c4f5e6cd940b12ae4deafa6ba','cold_clear_2.js':'728881d30d20e6751b321fa4279fb63bd2aaace6161b485f3479f18967eca691'},
  games:[{game:1,reason:'topout',failures:[null,null],parity:[0,1].map(()=>({placements:30,holds:2,mismatches:0})),
   transportStats:[0,1].map(()=>({fallbackRequests:0,rejectedCandidates:0,maxSelectedRank:0})),swapped,framesPerPiece:24,
   seeds:[seed,seed],holeSeeds:[seed+1,seed+2],ko:[false,true],winner:0,scored:true,seriesWinner:swapped?1:0,
   counts:{placements:[30,30],holds:[2,2],reanalyses:[2,2],receives:[1,1]}}]};
 });}

test('dense integration requires eight distinct valid legs and aggregates policy seats',()=>{
 const s=summarizeDense(fixtures(),'success');assert.ok(s.complete);assert.deepEqual(s.score,[4,4]);
 assert.equal(s.coverage[0].placements,240);assert.equal(s.coverage[1].holds,16);
 assert.ok(!summarizeDense(fixtures().slice(0,7),'success').complete);
 const duplicate=fixtures();duplicate[7]=duplicate[0];assert.ok(!summarizeDense(duplicate,'success').complete);
 assert.ok(!summarizeDense(fixtures(),'failure').complete);
});
test('dense integration rejects transport, artifact, seed, parity and frame-cap failures',()=>{
 for(const change of [
  r=>r.games[0].transportStats[0].fallbackRequests++,r=>r.games[0].parity[0].mismatches++,
  r=>r.games[0].failures[0]={error:'certificate failure'},r=>r.artifactHashes['cold_clear_2_bg.wasm']='wrong',
  r=>r.games[0].seeds[1]++,r=>r.games[0].framesPerPiece=23,r=>r.games[0].reason='frame-cap',
  r=>r.games[0].counts.holds[0]++,r=>r.games[0].seriesWinner=1,r=>r.smokeOnly=true,
 ]){const rs=fixtures();change(rs[0]);assert.ok(!summarizeDense(rs,'success').complete);}
});
test('simultaneous KO is unscored and requires a new-seed retry',()=>{
 const rs=fixtures(),g=rs[0].games[0],retry=structuredClone(g);
 Object.assign(g,{ko:[true,true],winner:null,scored:false,seriesWinner:null});
 assert.ok(!summarizeDense(rs,'success').complete);
 retry.game=2;retry.seeds=retry.seeds.map(s=>s+4);retry.holeSeeds=retry.holeSeeds.map(s=>s+4);rs[0].games.push(retry);
 assert.ok(summarizeDense(rs,'success').complete);
});
test('landing integration accepts only its exact artifact and retains all gates',()=>{
 const rs=fixtures();assert.ok(!summarizeDense(rs,'success',{landing:true}).complete);
 for(const r of rs){r.artifactRun=36387270053;r.artifactHashes['cold_clear_2_bg.wasm']='ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767';}
 assert.ok(summarizeDense(rs,'success',{landing:true}).complete);
 assert.ok(!summarizeDense(rs,'success').complete);
 rs[0].games[0].transportStats[0].fallbackRequests++;
 assert.ok(!summarizeDense(rs,'success',{landing:true}).complete);
});

test('visible-T pilot freezes both artifacts and paired seeds; no partial batch promotion',()=>{
 const rs=fixtures();
 for(const r of rs){
  Object.assign(r,{pilot:structuredClone(pilot),artifactRun:pilot.candidateRun,baselineArtifactRun:pilot.baselineRun,baselineWasm:pilot.baselineWasm,watchdogFrames:pilot.watchdogFrames});
  r.artifactHashes['cold_clear_2_bg.wasm']=pilot.candidateWasm;
  const seed=pilot.seeds[r.pair];r.games[0].seeds=[seed,seed];r.games[0].holeSeeds=[seed+1,seed+2];
 }
 assert(summarizeDense(rs,'success',{visibleT:true}).complete);
 for(const change of [r=>r.baselineWasm='wrong',r=>r.artifactRun++,r=>r.pilot.seeds[0]++,
  r=>r.games[0].seeds[0]++,r=>r.games[0].failures[0]={error:'watchdog'},r=>r.games[0].transportStats[0].fallbackRequests++,
  r=>r.games[0].parity[0].mismatches++,r=>r.watchdogFrames=48]){
  const altered=structuredClone(rs);change(altered[0]);assert(!summarizeDense(altered,'success',{visibleT:true}).complete);
 }
 assert(!summarizeDense(rs.slice(0,7),'success',{visibleT:true}).complete);
 assert(!summarizeDense(rs,'failure',{visibleT:true}).complete);
 const g=rs[0].games[0],retry=structuredClone(g);
 Object.assign(g,{ko:[true,true],winner:null,scored:false,seriesWinner:null});
 retry.game=2;retry.seeds=retry.seeds.map(s=>s+4);retry.holeSeeds=retry.holeSeeds.map(s=>s+4);rs[0].games.push(retry);
 assert(summarizeDense(rs,'success',{visibleT:true}).complete);
});
