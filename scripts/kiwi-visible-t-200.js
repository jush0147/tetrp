import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,unlink} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {spawn} from 'node:child_process';
import {availableParallelism,cpus} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {runMatchPool} from './kiwi-match-pool.js';
import {config,legSettings,shardLegs,auditAttempt,pairedSummary} from './kiwi-visible-t-200-config.js';
const root='.cache/visible-t-200',manifestHash=createHash('sha256').update(await readFile('docs/audits/cc2-alignment/VISIBLE_T_200.json')).digest('hex');
async function json(path,value){await writeFile(path,JSON.stringify(value,null,2));}
if(process.argv[2]==='shard'){
 const shard=Number(process.env.KIWI_200_SHARD),tasks=shardLegs(shard);await mkdir(`${root}/summaries`,{recursive:true});
 const report={shard,manifestHash,commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,complete:false,legs:[],cpu:cpus()[0]?.model,availableParallelism:availableParallelism()};const start=performance.now();
 const save=()=>json(`${root}/summaries/shard-${shard}.json`,report);await save();
 try{
  assert.ok(report.availableParallelism>=4,'Expected four logical CPUs for two-match worker configuration');
  report.legs=await runMatchPool(tasks,config.workersPerRunner,async leg=>{
   const legReport={leg,manifestHash,complete:false,attempts:[]},path=`${root}/summaries/leg-${leg}.json`;await json(path,legReport);
   for(let attempt=0;attempt<config.maxAttemptsPerLeg;attempt++){
    const setting=legSettings(leg,attempt),out=resolve(root,`games/leg-${leg}/attempt-${attempt}`);await mkdir(out,{recursive:true});
    try{
     await new Promise((res,rej)=>{const child=spawn(process.execPath,['scripts/kiwi-native-arena.js','run','--parallel','--single','--batch-leg'],{env:{...process.env,NATIVE_ARENA_LEG:String(leg),NATIVE_ARENA_OUT:out,KIWI_BATCH_ATTEMPT:String(attempt)},stdio:'inherit',windowsHide:true});child.on('error',rej);child.on('exit',(code,signal)=>code===0?res():rej(Error(`leg ${leg} attempt ${attempt}: ${code}/${signal}`)));});
     const result=JSON.parse(await readFile(`${out}/result.json`)),scored=auditAttempt(result,leg,attempt);
     // Full attempt remains in diagnostic artifact; compact copy in aggregate input.
     delete result.runs.parallel.result.latencies;
     legReport.attempts.push({attempt,seed:setting.seed,scored:scored.scored,report:result});await json(path,legReport);
     for(const file of ['parallel-reports.jsonl','parallel-events.jsonl']){const source=`${out}/${file}`;await pipeline(createReadStream(source),createGzip({level:1}),createWriteStream(source+'.gz'));await unlink(source);}
     if(scored.scored){Object.assign(legReport,{complete:true,attempt,seed:setting.seed,winner:scored.seriesWinner});await json(path,legReport);console.log(JSON.stringify({type:'completed-leg',leg,attempt,winner:scored.seriesWinner}));return {leg,attempt,seed:setting.seed,winner:scored.seriesWinner};}
    }catch(e){legReport.error={message:e.message,stack:e.stack};await json(path,legReport);throw e;}
   }throw Error(`leg ${leg}: simultaneous KO retry limit, incomplete`);
  });report.complete=true;
 }catch(e){report.error={message:e.message,stack:e.stack};throw e;}finally{report.wallMs=performance.now()-start;await save();}
}else if(process.argv[2]==='aggregate'){
 await mkdir(`${root}/aggregate`,{recursive:true});const summary={manifestHash,commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,complete:false,expected:config.legs,config,legs:[],errors:[]};
 const inputs='.cache/visible-t-200-downloads';const seen=new Set();
 try{
  const dirs=await readdir(inputs);assert.equal(dirs.length,config.shards,'Missing shard artifacts');
  for(let shard=0;shard<config.shards;shard++){
   const dir=`${inputs}/kiwi-visible-t-200-summary-${shard}`;
   const report=JSON.parse(await readFile(`${dir}/shard-${shard}.json`));assert.equal(report.shard,shard);assert.equal(report.manifestHash,manifestHash);assert.equal(report.complete,true);
   for(const leg of shardLegs(shard)){
    const l=JSON.parse(await readFile(`${dir}/leg-${leg}.json`));assert.equal(l.leg,leg);assert.equal(l.manifestHash,manifestHash);assert.equal(l.complete,true);assert.ok(!seen.has(leg));seen.add(leg);
    assert.equal(l.attempts.length,l.attempt+1);
    for(const [i,a] of l.attempts.entries()){assert.equal(a.attempt,i);const score=auditAttempt(a.report,leg,i);assert.equal(a.scored,score.scored);assert.equal(score.scored,i===l.attempt);if(score.scored)assert.equal(l.winner,score.seriesWinner);}
    summary.legs.push(l);
   }
  }
  assert.equal(process.env.SHARDS_STATUS,'success');summary.statistics=pairedSummary(summary.legs);summary.complete=true;
 }catch(e){summary.errors.push({message:e.message,stack:e.stack});process.exitCode=1;}
 await json(`${root}/aggregate/result.json`,summary);
 const msg=summary.complete?`Visible-T ${summary.statistics.score[0]} - ${summary.statistics.score[1]} accepted baseline (200 KO games). All correctness gates passed. Seed-pair approximate 95% CI ${(100*summary.statistics.pairedApprox95CI[0]).toFixed(1)}–${(100*summary.statistics.pairedApprox95CI[1]).toFixed(1)}%. No automatic promotion.`:'Visible-T 200-game batch incomplete or correctness failure. Inspect artifacts; no strength verdict, no automatic rerun.';
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,msg+'\n\n'+url+'\n');
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:summary.complete?'Kiwi visible-T 200 games completed':'Kiwi visible-T batch needs review',message:msg+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});assert.ok(response.ok);assert.ok((await response.json()).id);
}else throw Error('shard | aggregate');
