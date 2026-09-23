import {readFile,appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function describeFt7(report,jobStatus){
  const games=report?.games??[],score=report?.score??[0,0];
  const technical=games.filter(g=>g.reason!=='topout'||g.failures?.some(Boolean));
  const parity=games.flatMap(g=>g.parity??[]);
  const placements=parity.reduce((n,p)=>n+p.placements,0),holds=parity.reduce((n,p)=>n+p.holds,0);
  const mismatches=parity.reduce((n,p)=>n+p.mismatches,0);
  const complete=jobStatus==='success'&&report?.complete===true&&report.executionModel==='tl-placement-v1'&&
    Math.max(...score)===7&&technical.length===0&&games.length>0&&games.every(g=>g.parity?.length===2)&&mismatches===0;
  return {title:complete?'Kiwi FT7 完成':'Kiwi FT7 未完成／需要檢查',
    message:[report?.score?`Native ${score[0]} : ${score[1]} Legacy`:'Score unavailable (run did not produce a readable result)',
      `Geometry budget: ${report?.profiles?.[0]?.config?.geometryBudget??'unknown'}; seed: ${report?.seed??'unknown'}`,
      `Objective: ${report?.profiles?.[0]?.config?.objective??'sent-safety'}`,
      `Frontier extension: ${report?.profiles?.[0]?.config?.frontierExtension===true?'on':'off'}; applied requests: ${report?.profiles?.[0]?.diagnostics?.applied??0}; changed top-1: ${report?.profiles?.[0]?.diagnostics?.changedTop1??0}`,
      `Model: ${report?.executionModel??'not started'}; KO-only; 24 frames/placement`,
      `Scored rounds: ${games.filter(g=>g.scored).length}; unscored: ${games.filter(g=>!g.scored).length}; technical: ${technical.length}`,
      `Audited placements: ${placements}; Holds: ${holds}; mismatches: ${mismatches}`,
      `Status: ${jobStatus}; ${complete?'first to 7 complete':report?.reason??'see workflow logs / partial artifact'}`,
      `Commit: ${report?.git?.slice(0,12)??'see workflow'}`].join('\n'),complete};
}

async function main(){
  let report;try{report=JSON.parse(await readFile(process.argv[2]??'ft7-results/result.json','utf8'));}
  catch(error){report={reason:'result-unavailable: '+error.message};}
  const summary=describeFt7(report,process.env.ARENA_JOB_STATUS??'unknown');
  const topic=process.env.NTFY_TOPIC??'just_a_kiwi_for_tetrp';
  if(!/^[-_A-Za-z0-9]{1,64}$/.test(topic))throw new Error('Invalid ntfy topic');
  const url=`${process.env.GITHUB_SERVER_URL??'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  console.log(summary.message+'\n'+url);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `## ${summary.title}\n\n${summary.message.replaceAll('\n','  \n')}\n\n[Run and artifacts](${url})\n`);
  const body=JSON.stringify({topic,title:summary.title,message:summary.message+'\n'+url,click:url,
    tags:[summary.complete?'white_check_mark':'warning']});
  let last;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(`ntfy HTTP ${response.status}`);
      const receipt=await response.json();if(!receipt.id)throw new Error('Missing ntfy receipt');
      console.log('ntfy notification accepted: '+receipt.id);return;
    }catch(error){last=error;if(attempt<2)await new Promise(r=>setTimeout(r,2000*(attempt+1)));}
  }
  throw last;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
