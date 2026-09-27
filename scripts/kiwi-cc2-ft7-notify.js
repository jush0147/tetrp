import assert from 'node:assert/strict';
import {readFile,appendFile} from 'node:fs/promises';
let r;try{r=JSON.parse(await readFile('.cache/cc2-ft7-results/result.json','utf8'));}catch{}
const games=r?.games??[],parity=games.flatMap(g=>g.parity??[]),sum=k=>parity.reduce((n,p)=>n+p[k],0);
const ok=process.env.AUDIT_JOB_STATUS==='success'&&r?.complete&&r.status==='ft7-completed'&&Math.max(...r.score)===7&&
 games.every(g=>g.reason==='topout'&&g.failures.every(f=>f===null)&&g.parity.every(p=>p.mismatches===0));
const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const message=`Corrected Kiwi ${r?.score?.[0]??'?'} : ${r?.score?.[1]??'?'} Tetrp vendored Kiwi. ${games.filter(g=>g.scored).length} scored rounds; ${sum('placements')} placements; ${sum('holds')} Holds; ${sum('mismatches')} parity mismatches. ${ok?'KO-only FT7 completed.':r?.error?.message??'Incomplete; inspect partial evidence.'}`;
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n\n'+url+'\n');
const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Corrected Kiwi FT7 completed':'Corrected Kiwi FT7 needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
assert.ok(response.ok,`ntfy HTTP ${response.status}`);const receipt=await response.json();assert.ok(receipt.id);console.log(`ntfy accepted: ${receipt.id}`);
