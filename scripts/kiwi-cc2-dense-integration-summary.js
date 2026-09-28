import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {scoreKO} from './kiwi-cc2-series-score.js';

export function summarizeDense(reports,jobStatus){
 const legs=[],problems=[],score=[0,0],coverage=[0,1].map(()=>({placements:0,holds:0,reanalyses:0,receives:0}));
 for(const [index,r]of reports.entries())try{
  assert.ok(Number.isInteger(r.batchLeg)&&r.batchLeg>=0&&r.batchLeg<8);
  assert.equal(r.pair,Math.floor(r.batchLeg/2));assert.ok(!legs.some(l=>l.leg===r.batchLeg));
  assert.ok(r.complete&&r.batchScored&&!r.smokeOnly);assert.equal(r.status,'batch-leg-completed');
  assert.equal(r.maxFrames,null);assert.equal(r.nodeBudget,200000);assert.equal(r.framesPerPiece,24);
  assert.equal(r.executionModel,'tl-placement-v1');assert.equal(r.artifactRun,36380902069);
  assert.equal(r.artifactHashes['cold_clear_2_bg.wasm'],'bd21800742a8d5abd54118cb51f458fb987d8f6c4f5e6cd940b12ae4deafa6ba');
  assert.equal(r.artifactHashes['cold_clear_2.js'],'728881d30d20e6751b321fa4279fb63bd2aaace6161b485f3479f18967eca691');
  assert.ok(r.games.length>0&&r.games.length<=25);
  const local=[0,1].map(()=>({placements:0,holds:0,reanalyses:0,receives:0}));
  for(const [i,g]of r.games.entries()){
   assert.equal(g.game,i+1);assert.equal(g.reason,'topout');assert.deepEqual(g.failures,[null,null]);
   assert.equal(g.parity.length,2);assert.ok(g.parity.every(p=>p.mismatches===0));
   assert.equal(g.transportStats.length,2);
   assert.ok(g.transportStats.every(s=>s.fallbackRequests===0&&s.rejectedCandidates===0&&s.maxSelectedRank===0));
   assert.equal(g.swapped,r.batchLeg%2===1);assert.equal(g.framesPerPiece,24);
   const seed=2026100001+r.pair*100+i*4;assert.deepEqual(g.seeds,[seed,seed]);assert.deepEqual(g.holeSeeds,[seed+1,seed+2]);
   const scored=scoreKO([0,0],g,g.swapped);assert.equal(g.scored,scored.scored);assert.equal(g.seriesWinner,scored.seriesWinner);
   assert.equal(g.scored,i===r.games.length-1,'Only final attempt may score; double KO must retry');
   for(let policy=0;policy<2;policy++){
    const seat=g.swapped?1-policy:policy;
    for(const key of ['placements','holds'])assert.equal(g.parity[seat][key],g.counts[key][seat]);
    assert.ok(g.counts.reanalyses[seat]<=g.counts.holds[seat]);
    // Runner also validates post-Hold snapshots and the exceptional terminal Hold.
    for(const key of Object.keys(local[policy])){const n=g.counts[key][seat];assert.ok(Number.isInteger(n)&&n>=0);local[policy][key]+=n;}
   }
  }
  for(let p=0;p<2;p++)for(const key of Object.keys(coverage[p]))coverage[p][key]+=local[p][key];
  const winner=r.games.at(-1).seriesWinner;score[winner]++;
  legs.push({leg:r.batchLeg,pair:r.pair,winner,attempts:r.games.length});
 }catch(e){problems.push({index,leg:r?.batchLeg,error:e.message});}
 const coveragePassed=coverage.every(c=>c.placements>=24&&c.reanalyses>0&&c.receives>0);
 return {complete:legs.length===8&&!problems.length&&coveragePassed&&jobStatus==='success',expectedLegs:8,validLegs:legs.length,
  score,coverage,coveragePassed,problems,legs:legs.sort((a,b)=>a.leg-b.leg),purpose:'Full-runner correctness regression; not strength promotion'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root='.cache/cc2-dense-integration-downloads',reports=[],readErrors=[];
 for(const folder of await readdir(root).catch(()=>[]))try{reports.push(JSON.parse(await readFile(`${root}/${folder}/result.json`)));}
 catch(e){readErrors.push({folder,error:e.message});}
 const result=summarizeDense(reports,process.env.BATCH_JOB_STATUS);result.readErrors=readErrors;if(readErrors.length)result.complete=false;
 await writeFile('.cache/cc2-dense-integration-summary.json',JSON.stringify(result,null,2));
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const sum=k=>result.coverage.reduce((n,c)=>n+c[k],0);
 const message=`Dense Kiwi integration: ${result.validLegs}/8 valid KO legs; ${sum('placements')} placements; ${sum('holds')} Holds. Score ${result.score.join(':')} vs vendored Kiwi (diagnostic only). ${result.complete?'Correctness gates passed.':'Incomplete/failed; inspect artifacts.'}`;
 console.log(message);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n\n'+url+'\n');
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:result.complete?'Kiwi dense integration passed':'Kiwi dense integration needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
 assert.ok(response.ok);assert.ok((await response.json()).id);if(!result.complete)process.exitCode=1;
}
