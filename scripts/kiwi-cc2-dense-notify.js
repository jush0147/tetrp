import assert from 'node:assert/strict';
import {readFile,appendFile} from 'node:fs/promises';
const read=async path=>{try{return JSON.parse(await readFile(path));}catch{return null;}};
const combined=await read('.cache/cc2-combined-results/summary.json');
const trace=await read('.cache/cc2-trace-results/summary.json');
const browser=await read('.cache/cc2-wasm-results/summary.json');
const ok=process.env.AUDIT_JOB_STATUS==='success'&&combined?.checks===2038&&combined.mismatches===0&&
 trace?.checks===96&&trace.mismatches===0&&browser?.fullReportPairs===36&&browser.mismatches===0&&!browser.smokeOnly;
const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const message=ok?`Dense visited table: correctness and 36 full-report pairs passed. Browser median paired latency reduction ${(100*browser.medianReduction).toFixed(1)}%; performance gate ${browser.performancePassed?'passed':'not met'}. No production update or strength claim.`:
 'Dense visited-table experiment incomplete or failed. Inspect artifacts; no correctness/performance acceptance.';
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n\n'+url+'\n');
const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi dense-table experiment completed':'Kiwi dense-table experiment needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
assert.ok(response.ok);assert.ok((await response.json()).id);if(!ok)process.exitCode=1;
