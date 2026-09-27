import assert from 'node:assert/strict';
import {readFile,appendFile} from 'node:fs/promises';
let r;try{r=JSON.parse(await readFile('.cache/cc2-integration-results/result.json','utf8'));}catch{}
const ok=process.env.AUDIT_JOB_STATUS==='success'&&r?.complete&&!r.smokeOnly&&r.status==='arena-integration-passed';
const parity=r?.games?.flatMap(g=>g.parity)??[],sum=k=>parity.reduce((n,p)=>n+p[k],0);
const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const message=`Corrected CC2/Kiwi vs Tetrp vendored Kiwi. ${r?.games?.length??0}/2 games; ${sum('placements')} placements; ${sum('holds')} Holds; ${sum('mismatches')} parity mismatches. ${ok?'Continuous authority integration passed; not an FT7 strength result.':r?.error?.message??'Integration incomplete; inspect logs/partial artifacts.'}`;
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n\n'+url+'\n');
const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'CC2 arena integration passed':'CC2 arena integration needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
assert.ok(response.ok,`ntfy HTTP ${response.status}`);const receipt=await response.json();assert.ok(receipt.id);console.log(`ntfy accepted: ${receipt.id}`);
