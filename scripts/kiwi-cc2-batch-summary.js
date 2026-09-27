import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,appendFile} from 'node:fs/promises';
import {scoreKO} from './kiwi-cc2-series-score.js';
const root='.cache/cc2-batch-downloads',legs=[],problems=[],score=[0,0];
let placements=0,holds=0;
for(const folder of await readdir(root).catch(()=>[])){
 try{
  const r=JSON.parse(await readFile(`${root}/${folder}/result.json`,'utf8'));
  assert.ok(Number.isInteger(r.batchLeg)&&r.batchLeg>=0&&r.batchLeg<24);assert.equal(r.pair,Math.floor(r.batchLeg/2));
  assert.ok(r.complete&&r.batchScored&&r.status==='batch-leg-completed');assert.ok(!legs.some(l=>l.leg===r.batchLeg));
  assert.equal(r.maxFrames,null);assert.equal(r.nodeBudget,200000);
  assert.equal(r.artifactHashes['cold_clear_2_bg.wasm'],'892a6cbea43ae280bb09fc9d993a7e9d51307e39881aff9b92fb5c37177063fa');
  for(const g of r.games){
   assert.equal(g.reason,'topout');assert.ok(g.failures.every(f=>f===null));assert.ok(g.parity.every(p=>p.mismatches===0));
   assert.ok(g.transportStats.every(s=>s.fallbackRequests===0&&s.rejectedCandidates===0&&s.maxSelectedRank===0));
   assert.equal(g.swapped,r.batchLeg%2===1);assert.equal(g.seeds[0],g.seeds[1]);
   assert.equal(g.seeds[0],2026100001+r.pair*100+(g.game-1)*4);assert.equal(g.framesPerPiece,24);
   const scoring=scoreKO([0,0],g,g.swapped);assert.equal(g.scored,scoring.scored);assert.equal(g.seriesWinner,scoring.seriesWinner);
   for(const p of g.parity){placements+=p.placements;holds+=p.holds;}
  }
  const scored=r.games.filter(g=>g.scored);assert.equal(scored.length,1);
  const last=scored[0];assert.ok(last.seriesWinner===0||last.seriesWinner===1);score[last.seriesWinner]++;
  legs.push({leg:r.batchLeg,pair:r.pair,winner:last.seriesWinner,attempts:r.games.length,seeds:last.seeds});
 }catch(e){problems.push({folder,error:e.message});}
}
const complete=legs.length===24&&!problems.length&&process.env.BATCH_JOB_STATUS==='success';
const result={complete,score,validLegs:legs.length,expectedLegs:24,placements,holds,problems,legs:legs.sort((a,b)=>a.leg-b.leg)};
await writeFile('.cache/cc2-batch-summary.json',JSON.stringify(result,null,2));
const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const message=`Corrected Kiwi ${score[0]} : ${score[1]} vendored Kiwi; ${legs.length}/24 valid legs (12 seed pairs). ${placements} placements, ${holds} Holds. ${complete?'Fixed batch completed; review raw correctness before conclusions.':'Batch incomplete: missing/failed legs; not a complete strength result.'}`;
console.log(message);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n\n'+url+'\n');
const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:complete?'Kiwi 24-game batch completed':'Kiwi batch needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
assert.ok(response.ok,`ntfy HTTP ${response.status}`);assert.ok((await response.json()).id);
if(!complete)process.exitCode=1;
