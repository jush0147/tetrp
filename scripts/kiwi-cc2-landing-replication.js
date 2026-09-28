import assert from 'node:assert/strict';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='.cache/cc2-wasm-results';
await mkdir(out,{recursive:true});
const hashes={candidate:'ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767',
 reference:'bd21800742a8d5abd54118cb51f458fb987d8f6c4f5e6cd940b12ae4deafa6ba',
 js:'728881d30d20e6751b321fa4279fb63bd2aaace6161b485f3479f18967eca691',
 corpus:'348c09730248410adb8b2e4dd96749afe809c21187bfd82399c6c9379be17261'};
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
async function verify(){
 for(const [arm,pkg]of [['candidate',`${out}/pkg`],['reference','.cache/cc2-dense-reference/pkg']]){
  assert.equal(await hash(`${pkg}/cold_clear_2_bg.wasm`),hashes[arm],arm);
  assert.equal(await hash(`${pkg}/cold_clear_2.js`),hashes.js,`${arm} JS`);
 }
 assert.equal(await hash('docs/audits/cc2-alignment/perf-snapshots.json'),hashes.corpus);
}
if(process.argv[2]==='verify'){
 await verify();await writeFile(`${out}/replication-manifest.json`,JSON.stringify({candidateRun:36387270053,referenceRun:36380902069,hashes,budget:200000,passes:5,minimumReduction:.05,maxRegression:.05},null,2));
 console.log('Exact candidate, reference, JS and corpus hashes verified; no rebuild.');
}else if(process.argv[2]==='notify'){
 let summary,error,complete=false;
 try{
  await verify();summary=JSON.parse(await readFile(`${out}/summary.json`));
  assert.equal(process.env.AUDIT_JOB_STATUS,'success');assert.equal(summary.status,'landing-report-parity-passed');
  assert.equal(summary.smokeOnly,false);assert.equal(summary.fullReportPairs,60);assert.equal(summary.checks,120);
  assert.equal(summary.mismatches,0);assert.equal(summary.warmPasses,4);
  assert.equal(summary.minimumReduction,.05);assert.equal(summary.maxRegression,.05);
  assert.equal(summary.timings[0].budget,200000);assert.equal(summary.perState.length,12);
  complete=true;
 }catch(e){error=e.message;}
 const result={complete,performancePassed:complete&&summary.performancePassed===true,medianReduction:summary?.medianReduction,error,
  note:'Browser-only independent replication; authority Rust suites were not rerun. No arena or production promotion.'};
 await writeFile(`${out}/replication-result.json`,JSON.stringify(result,null,2));
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=complete?`Landing-cost browser replication: 60 full-report pairs identical. Median paired latency reduction ${(100*summary.medianReduction).toFixed(2)}%; unchanged 5% gate ${result.performancePassed?'passed':'not met'}. No new arena or production update.`:`Landing-cost replication incomplete/failed: ${error??'missing results'}. Inspect artifacts.`;
 console.log(message);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n\n'+url+'\n');
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:complete?'Kiwi landing replication completed':'Kiwi landing replication needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
 assert.ok(response.ok);assert.ok((await response.json()).id);if(!complete)process.exitCode=1;
}else throw Error('verify | notify');
