import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {availableParallelism,cpus} from 'node:os';
import {resolve} from 'node:path';
import {runMatchPool} from './kiwi-match-pool.js';
const root='.cache/two-match-results';
if(process.argv[2]==='run'){
 await mkdir(root,{recursive:true});
 const summary={complete:false,workers:2,cpu:cpus()[0]?.model,availableParallelism:availableParallelism(),games:[],strengthEvidence:false};
 const save=()=>writeFile(`${root}/summary.json`,JSON.stringify(summary,null,2));await save();
 const start=performance.now();
 try{
  assert.ok(summary.availableParallelism>=4,'Two-match validation requires at least four available logical CPUs');
  summary.games=await runMatchPool([0,1],2,async leg=>{
   const out=resolve(root,`leg-${leg}`);await mkdir(out,{recursive:true});
   await new Promise((res,rej)=>{
    const child=spawn(process.execPath,['scripts/kiwi-native-arena.js','run','--parallel','--single'],{env:{...process.env,NATIVE_ARENA_LEG:String(leg),NATIVE_ARENA_OUT:out},stdio:'inherit',windowsHide:true});
    child.on('error',rej);child.on('exit',(code,signal)=>code===0?res():rej(Error(`leg ${leg} failed: ${code}/${signal}`)));
   });
   const result=JSON.parse(await readFile(`${out}/result.json`));assert.equal(result.complete,true);assert.equal(result.referenceRun,36859147183);return result;
  });
  summary.wallMs=performance.now()-start;summary.complete=true;await save();
 }catch(e){summary.wallMs=performance.now()-start;summary.error={message:e.message,stack:e.stack};await save();throw e;}
}else if(process.argv[2]==='notify'){
 let r;try{r=JSON.parse(await readFile(`${root}/summary.json`));}catch{}
 const ok=process.env.AUDIT_JOB_STATUS==='success'&&r?.complete;
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=ok?`Two isolated matches completed on one runner in ${(r.wallMs/60000).toFixed(2)} minutes. Both full report/event streams match the prior validated traces. No new strength samples.`:'Two-match integration failed/incomplete; inspect per-game dumps. No 200-game batch launched.';
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi two-match integration passed':'Kiwi two-match integration needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});assert.ok(response.ok);assert.ok((await response.json()).id);
}else throw Error('run | notify');
