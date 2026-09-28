import assert from 'node:assert/strict';
import {readFile,appendFile} from 'node:fs/promises';
const results=[];for(const mode of ['candidate','legacy'])try{results.push(JSON.parse(await readFile(`.cache/cc2-search-profile/${mode}.json`)));}catch{}
const ok=process.env.AUDIT_JOB_STATUS==='success'&&results.length===2&&results.every(r=>!r.smokeOnly&&r.requests===12&&r.mismatches===0);
const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const message=ok?'Unchanged corrected/legacy WASM profiled on 12 real arena snapshots; full-report parity passed. CPU profiles ready for analysis; no new optimization or arena result.':'Profiling incomplete or failed; inspect artifacts before conclusions.';
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n\n'+url+'\n');
const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi search profiling completed':'Kiwi profiling needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
assert.ok(response.ok);assert.ok((await response.json()).id);if(!ok)process.exitCode=1;
