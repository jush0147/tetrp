// Read-only analysis of already captured accepted reports. No bot/search execution.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='docs/audits/cc2-alignment';
const files={observed:'.cache/eval-run-36551709585/observed.json',reference:'.cache/eval-run-36551709585/native-reference.json',wasm:'.cache/eval-run-36551709585/wasm-reference.json',current:'.cache/tail-preflight-37309709343/audit.json',inputs:`${dir}/eval-public-inputs.json`};
const data={},hashes={};
for(const [key,path] of Object.entries(files)){const b=await readFile(path);data[key]=JSON.parse(b);hashes[key]=createHash('sha256').update(b).digest('hex');}
const source=await readFile('.cache/cc2-parameter-audit/src/bot/freestyle.rs');
assert.equal(createHash('sha256').update(source).digest('hex'),'9fe27a686c21515eb729af2ec73c4b99cd0ad6201b783fd35319a93c265f03d1');
const key=p=>{const l=p.location;return [l.type,l.orientation,l.x,l.y,p.spin].join('/');};
const stage=(r,name)=>r.stages.find(s=>s.stage===name);
const round=n=>Math.round(n*1e6)/1e6;
const result={scope:'Four frozen real PublicSnapshots, existing accepted reports and bounded local witnesses only; no new search or arena',hashes,requests:[],selectedModification:null};
for(const x of data.observed){
 const f=data.inputs.find(r=>r.id===x.id),current=data.current.rows.find(r=>r.id===x.id);
 assert.deepEqual(f.snapshot,current.snapshot);
 for(const ref of [data.reference,data.wasm])assert.deepEqual(x.report,ref.find(r=>r.id===x.id).report);
 assert.deepEqual(x.report,current.accepted.report);
 const rows=x.diagnostic.rows;
 const ranked=x.report.candidates.map((c,i)=>({...c,rank:i+1}));
 const rootOf=r=>r.branch==='post_hold'?'hold':key(r.selectedPathBefore[0]?.[1]??r.placement);
 const candidateKey=c=>c.action.kind==='hold'?'hold':key(c.action.placement);
 const summarize=r=>({sampleIndex:rows.indexOf(r),branch:r.branch,scenario:r.scenario,depth:r.depth,rootKey:rootOf(r),rootRank:ranked.find(c=>candidateKey(c)===rootOf(r))?.rank??null,
  path:[...r.selectedPathBefore.map(([next,placement])=>({next,placement})),{next:r.normalizedBranchQueue[r.depth-1],placement:r.placement}],
  remaining:r.normalizedRemainingAfter,reserve:r.reserve,holdIsEmpty:r.holdIsEmpty,lines:r.lines,comboBefore:r.comboBefore,b2bBefore:r.b2bBefore,b2bAfter:r.b2bAfter,pendingAfter:r.pendingAfter,
  prefixNewlySent:r.sentAfter-f.snapshot.attack.cumulativeSent,immediateNewlySent:stage(r,'transaction').deltaReward,
  leafEval:r.stages.at(-1).eval,immediateReward:r.stages.at(-1).reward,
  stages:r.stages,transitionDiscriminatingPart:round(stage(r,'transitions').deltaEval+64),
  boardRewritten:JSON.stringify(r.realBoardCols)!==JSON.stringify(r.evaluatedBoardCols),realBoardCols:r.realBoardCols,evaluatedBoardCols:r.evaluatedBoardCols});
 for(const r of rows){
  assert.equal(r.selectedPathBefore.length+1,r.depth);assert.deepEqual(r.normalizedRemainingAfter,r.normalizedBranchQueue.slice(r.depth));
  assert.equal(r.stages.length,12);assert.ok(r.sentAfter>=f.snapshot.attack.cumulativeSent);
  assert.ok(Math.abs(r.stages.reduce((n,s)=>n+s.deltaEval,0)-r.stages.at(-1).eval)<.0001);
  assert.ok(Math.abs(r.stages.reduce((n,s)=>n+s.deltaReward,0)-r.stages.at(-1).reward)<.0001);
  const cols=r.evaluatedBoardCols.map(BigInt),mask=(1n<<64n)-1n;
  const pop=n=>{let c=0;while(n){n&=n-1n;c++;}return c;};
  assert.equal(cols.reduce((a,b)=>a&b,mask),0n,'ordinary cleared boards have no full rows');
  const transitions=pop(mask^cols[0])+pop(mask^cols[9])+cols.slice(1).reduce((n,c,i)=>n+pop(c^cols[i]),0);
  assert.ok(transitions>=128);assert.ok(Math.abs(stage(r,'transitions').deltaEval+transitions*.5)<.0001);
 }
 const top=ranked[0],associated=rows.filter(r=>rootOf(r)===candidateKey(top));
 const indices=new Set();
 // Deterministic witnesses: first observed descendant of top-1, largest prefix
 // sent (first tie), strongest H1 penalty, largest direct T-slot stage.
 if(associated.length)indices.add(rows.indexOf(associated[0]));
 for(const get of [r=>r.sentAfter,r=>stage(r,'transaction').deltaReward,r=>-stage(r,'pending_safety').deltaEval,r=>stage(r,'tslot').deltaEval]){
  const best=rows.reduce((a,b)=>get(b)>get(a)?b:a);indices.add(rows.indexOf(best));
 }
 const candidates=ranked.slice(0,4).map(c=>({...c,sampledDescendants:rows.filter(r=>rootOf(r)===candidateKey(c)).length}));
 result.requests.push({id:x.id,snapshot:f.snapshot,nodes:x.report.nodes,branchNodes:x.report.branch_nodes,scenarios:x.report.scenarios,
  topCandidates:candidates,holdCandidate:ranked.find(c=>c.action.kind==='hold'),fullRanking:ranked,
  sampling:x.diagnostic.sampling,sampledNodes:rows.length,top1AssociatedSamples:associated.length,
  maxSampledDepth:Math.max(...rows.map(r=>r.depth)),maxSampledPrefixSent:Math.max(...rows.map(r=>r.sentAfter-f.snapshot.attack.cumulativeSent)),
  stageRanges:Object.fromEntries(rows[0].stages.map(({stage:name})=>[name,{evalMin:Math.min(...rows.map(r=>stage(r,name).deltaEval)),evalMax:Math.max(...rows.map(r=>stage(r,name).deltaEval)),rewardMin:Math.min(...rows.map(r=>stage(r,name).deltaReward)),rewardMax:Math.max(...rows.map(r=>stage(r,name).deltaReward))}])),
  witnesses:[...indices].map(i=>summarize(rows[i])),
  limitation:'selectedPathBefore is a witnessed route into a DAG state, not the final backed-up best continuation. Prefix sent is actual forecast sent along that route, not root score decomposition or future KO evidence.'});
}
await writeFile(`${dir}/EXISTING_SCORE_AUDIT_2026-10-05.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.requests.map(r=>({id:r.id,top:r.topCandidates.map(c=>({rank:c.rank,action:c.action,score:c.mean_score,sampled:c.sampledDescendants})),samples:r.sampledNodes,maxSampledPrefixSent:r.maxSampledPrefixSent,witnesses:r.witnesses.map(w=>({index:w.sampleIndex,rank:w.rootRank,depth:w.depth,lines:w.lines,prefixSent:w.prefixNewlySent,immediateSent:w.immediateNewlySent,eval:w.leafEval,reward:w.immediateReward,parts:w.stages.filter(s=>s.deltaEval||s.deltaReward).map(s=>[s.stage,round(s.deltaEval),round(s.deltaReward)])}))})),null,2));
