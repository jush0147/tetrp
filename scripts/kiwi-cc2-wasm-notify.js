import assert from 'node:assert/strict';
import {readFile,appendFile} from 'node:fs/promises';
let result;try{result=JSON.parse(await readFile('.cache/cc2-wasm-results/summary.json','utf8'));}catch{}
const ok=process.env.AUDIT_JOB_STATUS==='success'&&result?.status==='browser-smoke-passed';
const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const message=ok?`${result.checks} top-1 checks passed. Warm search median/p95 ms: ${result.timings.map(t=>`${t.budget} nodes: corrected ${t.candidate.medianMs.toFixed(1)}/${t.candidate.p95Ms.toFixed(1)}, legacy ${t.legacy.medianMs.toFixed(1)}/${t.legacy.p95Ms.toFixed(1)}`).join('; ')}. Browser smoke/cost only, not strength evidence.`:
 'Corrected WASM build or browser audit failed. Check logs and partial artifacts; no strength result.';
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n\n'+url+'\n');
const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'CC2 WASM browser audit completed':'CC2 WASM browser audit failed',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
assert.ok(response.ok,`ntfy HTTP ${response.status}`);const receipt=await response.json();assert.ok(receipt.id);console.log(`ntfy accepted: ${receipt.id}`);
