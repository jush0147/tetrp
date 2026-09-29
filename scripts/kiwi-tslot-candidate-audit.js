import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
const mode=process.argv[2],out='.cache/cc2-eval-results',fixture=`${out}/candidate-inputs.json`;
const read=async name=>JSON.parse(await readFile(`${out}/${name}.json`,'utf8'));
const countT=a=>a.filter(p=>p==='T').length;
function branchStock(request,branch){
 const {queue,hold}=request.start;
 if(branch==='place')return {reserve:hold??queue[0],queue:hold===null?queue.slice(1):queue};
 assert.equal(branch,'post_hold');
 return {reserve:queue[0],queue:hold===null?queue.slice(1):[hold,...queue.slice(1)]};
}
if(mode==='prepare'){
 await mkdir(out,{recursive:true});
 const rows=JSON.parse(await readFile('docs/audits/cc2-alignment/eval-public-inputs.json','utf8'));
 const variants=[
  ['empty-hold-current-t','t',null,['i','j','l','s','z']],
  ['empty-hold-two-next-t','i',null,['t','j','l','t','s']],
  ['hold-t-no-next-t','i','t',['j','l','s','z','o']],
  ['hold-swap-current-t','t','i',['j','l','s','z','o']],
 ];
 for(const [id,current,hold,next] of variants){
  const engine=new Engine({mode:'tl',rules:rows[0].snapshot.rules});
  engine.spawn(current);engine.state.hold={piece:hold,locked:false};engine.state.bag.queue=[...next];
  const snapshot=visibleState(engine.state),{request}=prepareKiwi(snapshot);
  rows.push({id:`synthetic/${id}`,source:'Synthetic public resource boundary fixture, not a replay decision',snapshot,request});
 }
 await writeFile(fixture,JSON.stringify(rows)+'\n');console.log(`Prepared ${rows.length} requests, each with current + exactly NEXT 5 and 200k shared node budget.`);
}else if(mode==='gate'){
 const [rows,baseline,wasm,candidate,observed]=await Promise.all(['candidate-inputs','native-reference','wasm-reference','candidate','observed'].map(read));
 for(const r of [rows,baseline,wasm,candidate,observed])assert.equal(r.length,8);
 let witnessCount=0,changedTop1=0;
 const coverage={emptyHold:false,reserveT:false,twoRemainingT:false,zeroT:false,frontier:false,postHold:false};
 const comparisons=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i],b=baseline[i],w=wasm[i],c=candidate[i],o=observed[i];
  for(const r of [b,w,c,o])assert.equal(r.id,row.id);
  assert.deepEqual(b.report,w.report,'default-off differs from accepted WASM');
  assert.deepEqual(c.report,o.report,'observer changes candidate report');
  const prepared=prepareKiwi(row.snapshot);assert.deepEqual(prepared.request,row.request);
  const normalized=normalizeTopRecommendation(row.snapshot,prepared,c.report);
  assert.equal(normalized.candidateIndex,0);
  for(const r of [b,c]){
   assert.equal(r.report.node_budget,200000);assert(r.report.nodes>0&&r.report.nodes<=200000);
   assert.equal(r.report.branch_nodes.total,r.report.nodes);
   assert.equal(r.report.bag_knowledge,'unknown');assert.equal(r.report.unknown_tail,'finite_visible');
  }
  assert.equal(o.diagnostic.version,2);assert(o.diagnostic.rows.length>0);
  assert(o.diagnostic.evaluations>0);assert.equal(o.diagnostic.resourceChecks,o.diagnostic.evaluations);
  for(const s of o.diagnostic.rows){
   witnessCount++;
   const stock=branchStock(row.request,s.branch);
   assert.deepEqual(s.normalizedBranchQueue,stock.queue,'branch public normalization');
   assert.equal(s.selectedPathBefore.length+1,s.depth);assert(s.depth<=stock.queue.length);
   s.selectedPathBefore.forEach(([p],j)=>assert.equal(p,stock.queue[j]));
   assert.deepEqual(s.normalizedRemainingAfter,stock.queue.slice(s.depth));
   // Independently conserve every piece across the path, including implicit swaps.
   const available=[stock.reserve,...stock.queue];
   for(const p of [...s.selectedPathBefore.map(([,p])=>p),s.placement]){
    const at=available.indexOf(p.location.type);assert(at>=0,'placement consumes an unavailable public piece');available.splice(at,1);
   }
   assert.deepEqual(available.sort(),[s.reserve,...s.normalizedRemainingAfter].sort(),'Hold/queue multiset conservation');
   const expected=countT(s.normalizedRemainingAfter)+Number(s.reserve==='T');
   assert.equal(s.cutoutAllowance,expected,'candidate cutout resource invariant');
   assert(s.cutouts.length<=expected);assert.equal(s.stages.length,12);
   assert(s.stages.every(p=>Number.isFinite(p.eval)&&Number.isFinite(p.reward)));
   if(expected===0){assert.equal(s.cutouts.length,0);assert.deepEqual(s.realBoardCols,s.evaluatedBoardCols);}
   coverage.emptyHold||=s.holdIsEmpty;coverage.reserveT||=s.reserve==='T';
   coverage.twoRemainingT||=countT(s.normalizedRemainingAfter)>=2;coverage.zeroT||=expected===0;
   coverage.frontier||=s.normalizedRemainingAfter.length===0;coverage.postHold||=s.branch==='post_hold';
  }
  const changed=JSON.stringify(b.report.action)!==JSON.stringify(c.report.action);changedTop1+=Number(changed);
  comparisons.push({id:row.id,changedTop1:changed,baseline:b.report.action,candidate:c.report.action,nodes:c.report.nodes,
   candidateElapsedMs:c.elapsedMs??null,baselineElapsedMs:b.elapsedMs??null,witnesses:o.diagnostic.rows.length,resourceChecks:o.diagnostic.resourceChecks});
 }
 // Frontier is exercised by the Rust one-known-layer test. Quota sampling can
 // omit frontier controls once the candidate removes their synthetic cutouts.
 for(const [name,present] of Object.entries(coverage))if(name!=='frontier')assert(present,`Missing resource coverage: ${name}`);
 const summary={status:'passed',requests:8,fullReportParityChecks:16,mismatches:0,witnessCount,coverage,changedTop1,
  inputSha256:createHash('sha256').update(await readFile(fixture)).digest('hex'),comparisons,
  limitations:'Finite witnesses and native diagnostic timings only; no arena, browser performance, exhaustive transition proof or strength conclusion. Unknown-tail zero remains a hypothesis.'};
 await writeFile(`${out}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
}else if(mode==='notify'){
 let summary;try{summary=await read('summary');}catch{}
 const ok=process.env.AUDIT_JOB_STATUS==='success'&&summary?.status==='passed';
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const message=ok?`Isolated visible-T candidate diagnostic passed: 8 requests, 16 exact report checks; ${summary.witnessCount} resource witnesses. Top-1 changed on ${summary.changedTop1} requests. No strength match or promotion.`:'Visible-T candidate diagnostic failed or incomplete. Inspect artifacts before proceeding; baseline unchanged.';
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n'+url+'\n');
 const r=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:ok?'Kiwi visible-T diagnostic ready':'Kiwi visible-T diagnostic needs review',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
 assert(r.ok);assert((await r.json()).id);if(!ok)process.exitCode=1;
}else throw Error('prepare | gate | notify');
