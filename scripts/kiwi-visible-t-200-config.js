import assert from 'node:assert/strict';
import {scoreKO} from './kiwi-cc2-series-score.js';
import {readFileSync} from 'node:fs';
export const manifestPath=process.env.KIWI_BATCH_MANIFEST??'docs/audits/cc2-alignment/VISIBLE_T_200.json';
export const config=JSON.parse(readFileSync(manifestPath,'utf8'));
export const batchName=`kiwi-${config.candidate}-200`;
export function legSettings(leg,attempt=0){
 assert.ok(Number.isInteger(leg)&&leg>=0&&leg<config.legs);
 assert.ok(Number.isInteger(attempt)&&attempt>=0&&attempt<config.maxAttemptsPerLeg);
 return {leg,pair:Math.floor(leg/2),swapped:leg%2===1,attempt,seed:config.seeds[Math.floor(leg/2)]+attempt*config.retryStride};
}
export function shardLegs(shard){
 assert.ok(Number.isInteger(shard)&&shard>=0&&shard<config.shards);
 return Array.from({length:config.legsPerShard},(_,i)=>shard*config.legsPerShard+i);
}
export function auditAttempt(report,leg,attempt){
 const expected=legSettings(leg,attempt),r=report.runs?.parallel?.result,c=report.runs?.parallel?.counts;
 assert.equal(report.complete,true);assert.equal(report.batchValidated,true);assert.equal(report.leg,leg);assert.equal(report.seed,expected.seed);
 assert.equal(report.nodeBudget,config.nodeBudget);assert.equal(report.hashes.accepted.native,config.baselineNative);assert.equal(report.hashes[config.candidate].native,config.candidateNative);
 assert.equal(r.executionModel,'tl-placement-v1');assert.equal(r.framesPerPiece,config.framesPerPiece);assert.equal(r.maxFrames,null);assert.equal(r.watchdogFrames,config.watchdogFrames);
 assert.deepEqual(r.seeds,[expected.seed,expected.seed]);assert.deepEqual(r.holeSeeds,[expected.seed+1,expected.seed+2]);
 assert.ok(r.transportStats.every(t=>t.fallbackRequests===0&&t.rejectedCandidates===0&&t.maxSelectedRank===0));
 for(let i=0;i<2;i++){assert.equal(r.parity[i].placements,c.placements[i]);assert.equal(r.parity[i].holds,c.holds[i]);assert.equal(r.decisions[i],c.requests[i]);}
 return scoreKO([0,0],r,expected.swapped);
}
export function pairedSummary(legs){
 assert.equal(legs.length,config.legs);const ids=new Set();const blocks=[];
 for(const l of legs){assert.ok(!ids.has(l.leg));ids.add(l.leg);assert.equal(l.complete,true);assert.ok(l.winner===0||l.winner===1);const expected=legSettings(l.leg,l.attempt);assert.equal(l.seed,expected.seed);}
 for(let pair=0;pair<config.seeds.length;pair++){
  const a=legs.find(l=>l.leg===pair*2),b=legs.find(l=>l.leg===pair*2+1);assert.ok(a&&b);
  blocks.push({pair,candidateWins:Number(a.winner===0)+Number(b.winner===0),retryDiverged:a.seed!==b.seed});
 }
 const wins=blocks.reduce((n,b)=>n+b.candidateWins,0),mean=wins/config.legs;
 const variance=blocks.reduce((n,b)=>n+(b.candidateWins/2-mean)**2,0)/(blocks.length-1),se=Math.sqrt(variance/blocks.length);
 const sweeps=blocks.filter(b=>b.candidateWins===2).length,losses=blocks.filter(b=>b.candidateWins===0).length,n=sweeps+losses,k=Math.min(sweeps,losses);
 let term=2**(-n),tail=term;for(let i=1;i<=k;i++){term*= (n-i+1)/i;tail+=term;}
 return {score:[wins,config.legs-wins],candidateWinRate:mean,blockCounts:{'2-0':sweeps,'1-1':blocks.length-n,'0-2':losses},pairedApprox95CI:[Math.max(0,mean-1.984*se),Math.min(1,mean+1.984*se)],exactTwoSidedSweepSignP:Math.min(1,2*tail),retryDivergedBlocks:blocks.filter(b=>b.retryDiverged).length,blocks,note:'100 base-seed clusters; t approximation for mean block score and exact sign test on non-tied blocks. Not 200 independent Bernoulli trials. No optional stopping or automatic promotion.'};
}
