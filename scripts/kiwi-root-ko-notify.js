import {readFile,readdir,appendFile} from 'node:fs/promises';
import {experimentStatus} from './kiwi-root-ko-status.js';
const dir=process.argv[2]??'artifacts',results=[];
try{for(const file of await readdir(dir,{recursive:true}))if(file.replaceAll('\\','/').endsWith('/result.json')||file==='result.json'){
  results.push(JSON.parse(await readFile(`${dir}/${file}`,'utf8')));
}}catch(error){console.log('Artifacts incomplete: '+error.message);}
const mode=process.argv[3]??'pilot';
const {ok,lines}=experimentStatus(results,process.env.EXPERIMENT_STATUS,mode);
const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const message=[`Paired root KO ${mode}: ${ok?'complete':'incomplete / technical issue'}.`,
  ...lines,
  'Mirrors are correctness duplicates. Shared seeds and related states must not be pooled as independent samples.',
  'A=Native root, B=Legacy root; both continue with Legacy. Pilot only, not an FT7 or strength proof.',url].join('\n');
console.log(message);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n');
let last;for(let i=0;i<3;i++){
  try{const r=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),
    body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi 配對 KO 實驗完成':'Kiwi 配對 KO 實驗需要檢查',message,click:url})});
    if(!r.ok)throw new Error('ntfy HTTP '+r.status);const receipt=await r.json();if(!receipt.id)throw new Error('Missing receipt');console.log('ntfy accepted: '+receipt.id);last=null;break;
  }catch(error){last=error;if(i<2)await new Promise(r=>setTimeout(r,2000));}
}if(last)throw last;
