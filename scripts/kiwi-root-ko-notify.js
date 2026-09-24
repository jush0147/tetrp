import {readFile,readdir,appendFile} from 'node:fs/promises';
const dir=process.argv[2]??'artifacts',results=[];
try{for(const file of await readdir(dir,{recursive:true}))if(file.replaceAll('\\','/').endsWith('/result.json')||file==='result.json'){
  results.push(JSON.parse(await readFile(`${dir}/${file}`,'utf8')));
}}catch(error){console.log('Artifacts incomplete: '+error.message);}
const ok=process.env.EXPERIMENT_STATUS==='success'&&results.length===3&&results.every(r=>r.complete&&r.seatParity&&r.technicalFailures===0);
const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const message=[ok?'Paired root KO pilot complete.':'Paired root KO pilot incomplete / technical issue.',
  ...results.map(r=>r.complete?`${r.id}: A-only wins ${r.AOnlyWins}; B-only wins ${r.BOnlyWins}; ${r.independentScenarios} independent scenarios; seat parity ${r.seatParity}.`:`${r.id}: incomplete; inspect artifacts.`),
  'A=Native root, B=Legacy root; both continue with Legacy. Pilot only, not an FT7 or strength proof.',url].join('\n');
console.log(message);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n');
let last;for(let i=0;i<3;i++){
  try{const r=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),
    body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi 配對 KO 實驗完成':'Kiwi 配對 KO 實驗需要檢查',message,click:url})});
    if(!r.ok)throw new Error('ntfy HTTP '+r.status);const receipt=await r.json();if(!receipt.id)throw new Error('Missing receipt');console.log('ntfy accepted: '+receipt.id);last=null;break;
  }catch(error){last=error;if(i<2)await new Promise(r=>setTimeout(r,2000));}
}if(last)throw last;
