import {readFile,appendFile} from 'node:fs/promises';
let result;try{result=JSON.parse(await readFile(process.argv[2]??'rollout-results/result.json','utf8'));}catch{}
const success=process.env.EXPERIMENT_STATUS==='success'&&result?.complete;
const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const message=success?`Resource rollout complete. Proceed-to-design gate: ${result.proceedToDesign?'PASS':'FAIL'}. Authority placements ${result.parity.placements}, Holds ${result.parity.holds}, mismatches ${result.parity.mismatches}. Offline diagnostic only; not an FT7 or strength result.`:'Resource rollout incomplete / technical failure. Inspect partial artifacts; no outcome or promotion claim.';
const title=success?'Kiwi 資源 rollout 完成':'Kiwi 資源 rollout 需要檢查';
console.log(message+'\n'+url);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`${message}\n\n[Run and artifacts](${url})\n`);
let last;
for(let i=0;i<3;i++){
  try{const r=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title,message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error('ntfy HTTP '+r.status);const receipt=await r.json();if(!receipt.id)throw new Error('Missing receipt');
    console.log('ntfy accepted: '+receipt.id);last=null;break;
  }catch(e){last=e;if(i<2)await new Promise(r=>setTimeout(r,2000));}
}
if(last)throw last;
