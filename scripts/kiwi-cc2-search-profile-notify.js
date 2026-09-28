import assert from 'node:assert/strict';
import {readFile,appendFile} from 'node:fs/promises';
const dense=process.argv.includes('--dense');
const results=[];for(const mode of dense?['dense','candidate']:['candidate','legacy'])try{results.push(JSON.parse(await readFile(`.cache/cc2-search-profile/${mode}.json`)));}catch{}
let crossParity=true;
if(dense)try{assert.deepEqual(JSON.parse(await readFile('.cache/cc2-search-profile/dense-reports.json')),JSON.parse(await readFile('.cache/cc2-search-profile/candidate-reports.json')));}catch(e){crossParity=false;console.error(e.message);}
const ok=process.env.AUDIT_JOB_STATUS==='success'&&crossParity&&results.length===2&&results.every(r=>!r.smokeOnly&&r.requests===12&&r.budget===200000&&r.fullReportParityChecks===36&&r.mismatches===0);
const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const message=ok?(dense?'Accepted dense and pre-dense corrected WASM profiled on the same 12 public snapshots; within-run and cross-artifact full-report parity passed. Profiles ready to identify the next bottleneck. No new optimization or arena.':'Unchanged corrected/legacy WASM profiled on 12 real arena snapshots; full-report parity passed. CPU profiles ready for analysis; no new optimization or arena result.'):'Profiling incomplete or failed; inspect artifacts before conclusions.';
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n\n'+url+'\n');
const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi search profiling completed':'Kiwi profiling needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
assert.ok(response.ok);assert.ok((await response.json()).id);if(!ok)process.exitCode=1;
