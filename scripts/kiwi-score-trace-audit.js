import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root='.cache/cc2-eval-results',read=async p=>JSON.parse(await readFile(p,'utf8'));
const key=p=>{const l=p.location;return [l.type,l.orientation,l.x,l.y,p.spin].join('/');};
const f=Math.fround;
export function checkPath(p){
 assert.ok(p.steps.length>0&&p.steps.length<=6);
 assert.equal(key(p.root),key(p.steps[0].placement));
 let v=f(p.leaf);
 for(let i=p.steps.length-1;i>=0;i--){const s=p.steps[i],d=s.description;
  assert.equal(v,f(s.childValue));v=f(v+f(d.reward));assert.equal(v,f(s.cachedScore));
  if(d.breakdown!==null){const stages=d.breakdown.stages;assert.equal(stages.length,12);assert.equal(f(stages.at(-1).eval),f(d.localEval));assert.equal(f(stages.at(-1).reward),f(d.reward));}
  else assert.equal(d.toppedOut,true);
 }
 assert.equal(v,f(p.score));assert.equal(v,f(p.rebuilt));
 if(p.leafReason==='unexpanded_leaf')assert.equal(f(p.steps.at(-1).description.localEval),f(p.leaf));
 else {assert.equal(p.leafReason,'terminal_no_children');assert.equal(f(p.leaf),-1000000);}
}
export function checkDiagnostic(report,diagnostic){
 assert.equal(diagnostic.version,1);assert.ok(diagnostic.scenarios.length>0);
 let paths=0;
 for(const s of diagnostic.scenarios){const seen=new Set();for(const p of s.paths){checkPath(p);assert.ok(!seen.has(key(p.root)));seen.add(key(p.root));paths++;}}
 for(const b of diagnostic.branches){const scenarios=diagnostic.scenarios.filter(s=>s.branch===b.branch);assert.ok(scenarios.length>0);
  const sums=new Map();for(const s of scenarios)for(const p of s.paths){const k=key(p.root),a=sums.get(k)??[];a.push(f(p.score));sums.set(k,a);}
  const expected=[...sums].filter(([,a])=>a.length===scenarios.length);assert.equal(b.candidates.length,expected.length);
  for(const c of b.candidates){const a=sums.get(key(c.placement));assert.equal(a.length,c.scenarios);assert.equal(c.scenarios,scenarios.length);assert.equal(c.mean_score,a.reduce((s,n)=>s+n,0)/a.length);assert.equal(f(c.worst_score),Math.min(...a));}
 }
 const top2=report.candidates.slice(0,2).map(c=>{
  const branch=c.action.kind==='hold'?'post_hold':'place',b=diagnostic.branches.find(b=>b.branch===branch);assert.ok(b);
  const selected=c.action.kind==='hold'?b.candidates[0]:b.candidates.find(x=>key(x.placement)===key(c.action.placement));assert.ok(selected);
  assert.equal(selected.mean_score,c.mean_score);assert.equal(f(selected.worst_score),f(c.worst_score));
  return {candidate:c,selectedHypotheticalPlacement:selected.placement,scenarios:diagnostic.scenarios.filter(s=>s.branch===branch).map(s=>({scenario:s.scenario,path:s.paths.find(p=>key(p.root)===key(selected.placement))}))};
 });
 return {paths,top2};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv[2]==='gate'){
  const [off,on,wasm]=await Promise.all(['native-reference','observed','wasm-reference'].map(n=>read(`${root}/${n}.json`)));
  const inputs=await read('docs/audits/cc2-alignment/eval-public-inputs.json');assert.equal(on.length,4);
  const rows=on.map((r,i)=>{assert.equal(r.id,inputs[i].id);assert.deepEqual(r.report,off[i].report);assert.deepEqual(r.report,wasm[i].report);
   return {id:r.id,snapshot:inputs[i].snapshot,...checkDiagnostic(r.report,r.diagnostic)};});
  const out={complete:true,requests:4,fullReportComparisons:8,paths:rows.reduce((n,r)=>n+r.paths,0),rows,scope:'exact final DAG score attribution; no KO or production latency claim'};
  await writeFile(`${root}/score-trace-summary.json`,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({complete:true,requests:4,paths:out.paths}));
 }else if(process.argv[2]==='notify'){
  let r;try{r=await read(`${root}/score-trace-summary.json`);}catch{}
  const ok=process.env.AUDIT_JOB_STATUS==='success'&&r?.complete;
  const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const msg=ok?`Kiwi offline score trace ready: 4 snapshots, ${r.paths} final root paths, exact report/backprop checks passed. No arena or production change.`:'Kiwi offline score trace failed/incomplete. No arena or production change; inspect artifact.';
  if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,msg+'\n'+url+'\n');
  const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:'Kiwi score trace',message:msg+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});assert.ok(response.ok);assert.ok((await response.json()).id);
 }else throw Error('gate | notify');
}
