import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {openSync,writeSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {nativeClient} from './kiwi-native-client.js';
import {prepareKiwi,normalizeTopRecommendation,NODE_BUDGET} from '../src/analysis/kiwi.js';
import {match} from './kiwi-arena-core.js';
import {scoreKO} from './kiwi-cc2-series-score.js';
import {observationHtml} from './kiwi-observation-html.js';

export const IDENTITIES={aligned:'386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb',
 vendored:'af7849aa18649ebeca5e0af411499f6dc16afcdbc35ea4e094b2abffce59fa95'};
const hash=b=>createHash('sha256').update(b).digest('hex');
const mode=process.argv[2],directory='.cache/observation-ft7';
// Separate process keeps vendored WASM off the arena orchestration thread.
if(mode==='legacy-worker'){
 const kernel=await import('../vendor/kiwi-v1/pkg/cold_clear_2.js');
 const bytes=await readFile('vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm');assert.equal(hash(bytes),IDENTITIES.vendored);
 await kernel.default({module_or_path:bytes});
 for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  try{const report=JSON.parse(kernel.analyze_snapshot_json(line));console.log(JSON.stringify({ok:true,report}));}
  catch(e){console.log(JSON.stringify({ok:false,error:String(e)}));}
 }
}else if(mode==='run'||mode==='smoke'){
 await mkdir(directory,{recursive:true});
 const seed=Number(process.env.SERIES_SEED??2026100701);assert.ok(Number.isSafeInteger(seed)&&seed>0);
 const binary=resolve('.cache/observation-build/snapshot-accepted');
 assert.equal(hash(await readFile(binary)),IDENTITIES.aligned);
 assert.equal(hash(await readFile('vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm')),IDENTITIES.vendored);
 const smoke=mode==='smoke',names=['Aligned CC2 Kiwi','Tetrp Kiwi v3.2'];
 const report={schema:'kiwi-observation-ft7/1',complete:false,smokeOnly:smoke,identities:IDENTITIES,
  source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),seed,names,
  target:7,nodeBudget:NODE_BUDGET,framesPerPiece:24,executionModel:'tl-placement-v1',score:[0,0],games:[]};
 const replay={names,games:[]};
 const save=async()=>{
  await writeFile(`${directory}/result.json`,JSON.stringify(report,null,2));
  await writeFile(`${directory}/watch.html`,observationHtml(replay,report));
 };
 await save();
 try{
  for(let n=0;smoke?n<2:Math.max(...report.score)<7;n++){
   assert.ok(n<50,'Series technical watchdog: too many unscored rounds');
   const swapped=n%2===1,gameSeed=seed+n*4;
   const clients=[nativeClient(binary),nativeClient(process.execPath,[resolve('scripts/kiwi-observation-ft7.js'),'legacy-worker'])];
   const files=['events','reports'].map(k=>openSync(`${directory}/round-${n+1}-${k}.jsonl`,'w'));
   const counts={placements:[0,0],holds:[0,0],reanalyses:[0,0],terminalHolds:[0,0]},pending=[null,null];
   const game={round:n+1,swapped,seed:gameSeed,frames:[],skims:[]};replay.games.push(game);
   let pair=[null,null];const last=[null,null];
   const compact=(s,seat)=>({board:s.board.rows,last:last[seat],current:s.piece,hold:s.hold,next:s.bag.queue.slice(0,5),
    combo:s.attack.combo,btb:s.attack.btb,pieces:s.stats.pieces,playing:s.playing});
   const bots=[0,1].map(seat=>async snapshot=>{
    const policy=swapped?1-seat:seat,p=prepareKiwi(snapshot);
    const r=await clients[policy].request(JSON.stringify(p.request));
    assert.equal(r.bag_knowledge,'unknown');assert.equal(r.unknown_tail,'finite_visible');
    assert.equal(r.node_budget,NODE_BUDGET);assert.ok(r.nodes>0&&r.nodes<=NODE_BUDGET);
    const action=normalizeTopRecommendation(snapshot,p,r);
    writeSync(files[1],JSON.stringify({seat,policy,snapshot,request:p.request,report:r,action})+'\n');
    return action;
   });
   const before=[null,null];
   const record=e=>{
    writeSync(files[0],JSON.stringify(e)+'\n');
    if(e.type==='decision'){
     assert.equal(e.selected.candidateIndex,0);assert.equal(e.snapshot.next.length,5);before[e.seat]=e.snapshot;
     if(pending[e.seat]){
      for(const k of ['current','hold','next','frame'])assert.deepEqual(e.snapshot[k],pending[e.seat][k]);
      assert.equal(e.snapshot.hold.locked,true);assert.equal(e.selected.action.kind,'place');
      counts.reanalyses[e.seat]++;pending[e.seat]=null;
     }
    }
    if(e.type==='parity'&&e.kind==='hold'){
     counts.holds[e.seat]++;pending[e.seat]=e.actual;if(!e.actual.playing)counts.terminalHolds[e.seat]++;
    }
    if(e.type==='parity'&&e.kind==='placement'){
     counts.placements[e.seat]++;
     last[e.seat]={board:before[e.seat].board.rows,cells:e.intent.move.cells,piece:e.intent.move.piece,spin:e.actual.locks[0].spin,lines:e.actual.clear.lines};
     // Mark candidates for inspection, never claim that a B2B break is a mistake.
     if(before[e.seat]?.attack.btb>0&&e.actual.clear.lines>0&&e.actual.clear.lines<4&&e.actual.locks[0].spin==='none')
      game.skims.push({frame:e.frame,seat:e.seat,lines:e.actual.clear.lines,btbBefore:before[e.seat].attack.btb});
    }
    if(['initial','anchor','end'].includes(e.type)){
     pair[e.seat]=compact(e.state,e.seat);
     if(e.seat===1){game.frames.push({frame:e.frame??e.state.frame,seats:pair});pair=[null,null];}
    }
   };
   let result;
   try{
    result=await match(bots,{seeds:[gameSeed,gameSeed],holeSeeds:[gameSeed+1,gameSeed+2],
     framesPerPiece:24,maxFrames:smoke?48:null,watchdogFrames:360000,parallelDecisions:true,record,
     onProgress:p=>console.log(JSON.stringify({type:'progress',round:n+1,...p}))});
   }finally{for(const f of files)closeSync(f);await Promise.all(clients.map(c=>c.close()));}
   delete result.latencies;
   const row={round:n+1,swapped,counts,...result};report.games.push(row);await save();
   assert.ok(result.failures.every(f=>f===null));assert.ok(result.parity.every(p=>p.mismatches===0));
   assert.ok(result.transportStats.every(t=>t.fallbackRequests===0&&t.rejectedCandidates===0&&t.maxSelectedRank===0));
   for(let s=0;s<2;s++){
    assert.equal(result.parity[s].placements,counts.placements[s]);assert.equal(result.parity[s].holds,counts.holds[s]);
    assert.equal(counts.holds[s],counts.reanalyses[s]+counts.terminalHolds[s]);
   }
   if(smoke)assert.ok(['frame-cap','topout'].includes(result.reason));
   else{const scored=scoreKO(report.score,result,swapped);Object.assign(row,scored);report.score=scored.score;}
   game.result={winner:result.winner,reason:result.reason,score:[...report.score]};
   await save();console.log(JSON.stringify({round:n+1,score:report.score,reason:result.reason}));
  }
  report.complete=true;await save();
 }catch(e){report.error={message:e.message,stack:e.stack,details:e.details};await save();throw e;}
}else if(mode==='notify'){
 let r;try{r=JSON.parse(await readFile(`${directory}/result.json`));}catch{}
 const ok=process.env.AUDIT_JOB_STATUS==='success'&&r?.complete&&!r.smokeOnly;
 const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
  topic:'just_a_kiwi_for_tetrp',title:ok?'Aligned vs Tetrp Kiwi FT7 completed':'Kiwi observation FT7 needs review',
  message:`Aligned ${r?.score?.[0]??'?'} : ${r?.score?.[1]??'?'} vendored. Download watch.html and decision traces. ${r?.error?.message??''}\n${url}`,click:url}),signal:AbortSignal.timeout(15000)});
 assert.ok(response.ok);console.log(`ntfy accepted: ${(await response.json()).id}`);
}
