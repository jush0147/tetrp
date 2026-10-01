// Bounded CPU-capacity probe. Fixed public requests, not KO or strength evidence.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fork,execFileSync} from 'node:child_process';
import {availableParallelism,cpus} from 'node:os';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {nativeClient} from './kiwi-native-client.js';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
const root='.cache/runner-throughput-results',artifact='.cache/native-artifact';
const sha=b=>createHash('sha256').update(b).digest('hex');
const names=['accepted','visible-t'],hashes=['386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb','38d541f37b40f296c306053bee7521e755b33ed256a942f449ffcdbeb27db820'];
const referenceHashes=['faa0cfee87b974f625dae1d36de103bea72425bac464955dd7ce14df3ff2036a','1e4c8050a5563ceb2deeb2348d17055f1ab1effe618618620c2ad74ba4fa2b25'];
const readOptional=async p=>{try{return await readFile(p,'utf8');}catch{return null;}};
if(process.argv[2]==='worker'){
 const ticks=Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'}));
 const raw=await readFile('docs/audits/cc2-alignment/perf-snapshots.json');assert.equal(sha(raw),'348c09730248410adb8b2e4dd96749afe809c21187bfd82399c6c9379be17261');
 const samples=JSON.parse(raw),refs=[],clients=[];
 async function cpu(pid){const s=await readFile(`/proc/${pid}/stat`,'utf8'),f=s.slice(s.lastIndexOf(')')+2).split(/\s+/);return (Number(f[11])+Number(f[12]))/ticks;}
 try{
  for(const [i,name] of names.entries()){const path=resolve(artifact,`snapshot-${name}`);assert.equal(sha(await readFile(path)),hashes[i]);const reference=await readFile(`${artifact}/${name}-reports.json`);assert.equal(sha(reference),referenceHashes[i]);clients.push(nativeClient(path));refs.push(JSON.parse(reference));}
  async function pair(index){return Promise.all(clients.map(async(c,i)=>{
   const snapshot=samples[index].snapshot,p=prepareKiwi(snapshot);p.request.node_budget=200000;
   const report=await c.request(JSON.stringify(p.request)),action=normalizeTopRecommendation(snapshot,p,report),proof=action.action.kind==='place'?validatePlacement(snapshot,action):null;
   const actual={request:p.request,warnings:p.warnings,report,action,proof};
   try{assert.deepEqual(actual,refs[i][index]);}catch(e){await writeFile(`${root}/mismatch-${process.pid}.json`,JSON.stringify({name:names[i],index,snapshot,actual,expected:refs[i][index]},null,2));throw e;}
  }));}
  await pair(0);process.send({type:'ready'});
  const copies=await new Promise(resolve=>process.once('message',m=>resolve(m.copies)));
  assert.ok(copies===1||copies===2);
  const before=await Promise.all(clients.map(c=>cpu(c.pid))),usage=process.cpuUsage(),start=performance.now();
  for(let copy=0;copy<copies;copy++)for(let i=0;i<samples.length;i++)await pair(i);
  const wallMs=performance.now()-start,node=process.cpuUsage(usage),after=await Promise.all(clients.map(c=>cpu(c.pid)));
  const nativeCpuSeconds=after.reduce((n,v,i)=>n+v-before[i],0),nodeCpuSeconds=(node.user+node.system)/1e6;
  process.send({type:'result',copies,requests:copies*samples.length*2,wallMs,nativeCpuSeconds,nodeCpuSeconds,averageBusyCores:(nativeCpuSeconds+nodeCpuSeconds)/(wallMs/1000)});
 }finally{for(const c of clients)await c.close();process.disconnect();}
}else if(process.argv[2]==='bench'){
 await mkdir(root,{recursive:true});
 const cpuMax=await readOptional('/sys/fs/cgroup/cpu.max'),quota=cpuMax?.trim().split(/\s+/),quotaCores=quota&&quota[0]!=='max'?Number(quota[0])/Number(quota[1]):null;
 const capacity={availableParallelism:availableParallelism(),logicalCpus:cpus().length,cpu:cpus()[0]?.model,cpuMax,quotaCores,procSelfStatus:await readOptional('/proc/self/status'),cgroup:await readOptional('/proc/self/cgroup'),node:process.version};
 capacity.effectiveCores=Math.min(capacity.availableParallelism,quotaCores??Infinity);
 const trials=[];let currentChildren=[];
 async function trial(workers,round){
  const children=[],results=[],ready=[];currentChildren=children;
  for(let i=0;i<workers;i++){
   const c=fork(fileURLToPath(import.meta.url),['worker'],{stdio:['ignore','inherit','inherit','ipc']});children.push(c);
   let readyResolve,resultResolve,rejectReady,rejectResult;
   ready.push(new Promise((res,rej)=>{readyResolve=res;rejectReady=rej;}));
   results.push(new Promise((res,rej)=>{resultResolve=res;rejectResult=rej;}));
   const fail=e=>{rejectReady(e);rejectResult(e);};c.on('error',fail);c.on('exit',code=>{if(code!==0)fail(Error(`worker exit ${code}`));});
   c.on('message',m=>{if(m.type==='ready')readyResolve();if(m.type==='result')resultResolve(m);});
  }
  // Attach handlers immediately, even before the warmup readiness barrier.
  const allResults=Promise.all(results);allResults.catch(()=>{});
  await Promise.all(ready);const before=await readOptional('/sys/fs/cgroup/cpu.stat'),start=performance.now();
  for(const c of children)c.send({copies:workers===1?2:1});
  const output=await allResults,wallMs=performance.now()-start,after=await readOptional('/sys/fs/cgroup/cpu.stat');
  await Promise.all(children.map(c=>c.exitCode!==null?Promise.resolve():new Promise(r=>c.once('exit',r))));
  currentChildren=[];assert.equal(output.reduce((n,r)=>n+r.requests,0),48);
  const cpuSeconds=output.reduce((n,r)=>n+r.nativeCpuSeconds+r.nodeCpuSeconds,0);
  const row={workers,round,requests:48,wallMs,cpuSeconds,averageBusyCores:cpuSeconds/(wallMs/1000),workerResults:output,cgroupBefore:before,cgroupAfter:after};trials.push(row);
  await writeFile(`${root}/progress.json`,JSON.stringify({capacity,trials},null,2));return row;
 }
 try{
  const first=await trial(1,0);
  const headroom=capacity.effectiveCores>2&&first.averageBusyCores/capacity.effectiveCores<.85;
  if(headroom){await trial(2,0);for(let round=1;round<3;round++)for(const workers of round%2?[2,1]:[1,2])await trial(workers,round);}
  const sum=w=>trials.filter(t=>t.workers===w).reduce((n,t)=>n+t.wallMs,0);
  const reduction=headroom?1-sum(2)/sum(1):null;
  await writeFile(`${root}/summary.json`,JSON.stringify({capacity,headroom,trials,reduction,meetsGate:headroom&&reduction>=.1,scope:'Fixed equal workload (48 exact-parity requests/trial), 1 worker with 2 sequential batches vs 2 workers with 1 batch each. Each worker has two native seat processes. Startup/warmup excluded. Synthetic snapshot workload, not full arena or strength evidence.'},null,2));
 }finally{for(const c of currentChildren)c.kill();}
}else if(process.argv[2]==='notify'){
 let r;try{r=JSON.parse(await readFile(`${root}/summary.json`));}catch{}
 const ok=process.env.AUDIT_JOB_STATUS==='success'&&r;
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=ok?`Available capacity ${r.capacity.effectiveCores} cores. Baseline busy ${r.trials[0].averageBusyCores.toFixed(2)} cores. ${r.headroom?`Two-worker equal-work time reduction ${(r.reduction*100).toFixed(1)}%; exact report parity passed.`:'Insufficient measured headroom; two-worker test skipped.'}`:'Capacity probe incomplete or failed; inspect artifact. No strength batch dispatched.';
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:'Kiwi runner throughput probe',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});assert.ok(response.ok);assert.ok((await response.json()).id);
}else throw Error('worker | bench | notify');
