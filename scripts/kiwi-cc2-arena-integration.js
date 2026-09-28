import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {openSync,writeSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {prepareKiwi,normalizeTopRecommendation,NODE_BUDGET} from '../src/analysis/kiwi.js';
import {profile} from './kiwi-profiles.js';
import {match} from './kiwi-arena-core.js';
import {scoreKO} from './kiwi-cc2-series-score.js';
const artifact=resolve(process.argv[2]??'.cache/cc2-candidate'),out=process.argv[3]??'.cache/cc2-integration-results';
const smoke=process.argv.includes('--smoke');
const ft7=process.argv.includes('--ft7');
const batch=process.argv.includes('--batch');
const landing=process.argv.includes('--landing'),dense=landing||process.argv.includes('--dense');
const leg=batch?Number(process.env.CC2_BATCH_LEG):null;
if(batch){assert.ok(Number.isInteger(leg)&&leg>=0&&leg<24);assert.ok(!smoke&&!ft7);}
if(dense){assert.ok(!ft7&&(smoke||batch));if(batch)assert.ok(leg<8);}
assert.ok(!(smoke&&ft7),'A bounded smoke cannot be a strength series');
await mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const expected={
 'cold_clear_2.js':'728881d30d20e6751b321fa4279fb63bd2aaace6161b485f3479f18967eca691',
 'cold_clear_2_bg.wasm':landing?'ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767':dense?'bd21800742a8d5abd54118cb51f458fb987d8f6c4f5e6cd940b12ae4deafa6ba':'892a6cbea43ae280bb09fc9d993a7e9d51307e39881aff9b92fb5c37177063fa',
};
const report={schema:ft7?'cc2-authority-ft7/1':'cc2-authority-integration/1',git:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 artifactRun:landing?36387270053:dense?36380902069:36323060219,artifactHashes:expected,nodeBudget:NODE_BUDGET,executionModel:'tl-placement-v1',
 framesPerPiece:24,maxFrames:smoke?48:null,watchdogFrames:360000,smokeOnly:smoke,complete:false,games:[],
 baseline:'Tetrp vendored Kiwi snapshot-v3.2; not original CC2',promotionEligible:false,
 ...(ft7?{target:7,score:[0,0],seed:2026092801,scoring:'KO only; simultaneous KO unscored and replayed; technical failure aborts'}:{}),
 ...(batch?{batchLeg:leg,pair:Math.floor(leg/2),batchScored:false}: {})};
const save=()=>writeFile(`${out}/result.json`,JSON.stringify(report,null,2));await save();
try{
 for(const [name,sha]of Object.entries(expected))assert.equal(hash(await readFile(`${artifact}/pkg/${name}`)),sha,`Artifact hash ${name}`);
 assert.equal(hash(await readFile('vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm')),'af7849aa18649ebeca5e0af411499f6dc16afcdbc35ea4e094b2abffce59fa95');
 const kernel=await import(pathToFileURL(`${artifact}/pkg/cold_clear_2.js`).href);
 await kernel.default({module_or_path:await readFile(`${artifact}/pkg/cold_clear_2_bg.wasm`)});
 const legacy=await profile('legacy');
 const corrected=s=>{
  const p=prepareKiwi(s),r=JSON.parse(kernel.analyze_snapshot_json(JSON.stringify(p.request)));
  assert.equal(r.bag_knowledge,'unknown');assert.equal(r.unknown_tail,'finite_visible');assert.ok(r.nodes<=NODE_BUDGET);
  return normalizeTopRecommendation(s,p,r);
 };
 report.profiles=[{name:'corrected-cc2-kiwi',artifactRun:report.artifactRun},{name:'tetrp-vendored-kiwi',version:legacy.version}];
 for(let game=0;batch?!report.batchScored:ft7?Math.max(...report.score)<7:game<2;game++){
  // Separate retry seed range per pair; identical seat streams on paired legs.
  if(batch)assert.ok(game<25,'Repeated simultaneous KO: incomplete batch leg');
  const seed=batch?2026100001+Math.floor(leg/2)*100+game*4:(ft7?report.seed:2026092701)+game*4;
  const swapped=batch?leg%2===1:game%2===1,fd=openSync(`${out}/game-${game+1}.jsonl`,'w');
  const pending=[null,null],counts={placements:[0,0],holds:[0,0],reanalyses:[0,0],receives:[0,0],spins:{},clears:{}};
  const record=event=>{
   // Retain snapshots, original intent, provenance and actual lock before checking.
   writeSync(fd,JSON.stringify(event)+'\n');
   if(event.type==='decision'){
    assert.equal(event.snapshot.next.length,5);assert.equal(event.selected.candidateIndex,0);
    if(pending[event.seat]){
     const actual=pending[event.seat];assert.equal(actual.playing,true);
     for(const field of ['current','hold','next','frame'])assert.deepEqual(event.snapshot[field],actual[field],`post-Hold ${field}`);
     assert.equal(event.snapshot.hold.locked,true);assert.equal(event.selected.action.kind,'place');
     counts.reanalyses[event.seat]++;pending[event.seat]=null;
    }
   }
   if(event.type==='receive')counts.receives[event.seat]++;
   if(event.type==='parity'&&event.kind==='hold'){counts.holds[event.seat]++;pending[event.seat]=event.actual;}
   if(event.type==='parity'&&event.kind==='placement'){
    counts.placements[event.seat]++;const spin=event.actual.locks[0].spin,lines=event.actual.clear.lines;
    counts.spins[spin]=(counts.spins[spin]??0)+1;counts.clears[lines]=(counts.clears[lines]??0)+1;
   }
  };
  let result;
  try{result=await match(swapped?[legacy.decide,corrected]:[corrected,legacy.decide],{
   // Shared piece seed on both sides; new seed each game and swap policy seats.
   seeds:[seed,seed],holeSeeds:[seed+1,seed+2],framesPerPiece:24,maxFrames:report.maxFrames,watchdogFrames:report.watchdogFrames,
   record,onProgress:p=>console.log(JSON.stringify({type:'progress',game:game+1,...p})),
  });}finally{closeSync(fd);}
  report.games.push({game:game+1,swapped,counts,...result});await save();
  assert.ok(result.failures.every(f=>f===null),JSON.stringify(result.failures));
  assert.ok(result.parity.every(p=>p.mismatches===0));
  assert.ok(result.transportStats.every(s=>s.fallbackRequests===0&&s.rejectedCandidates===0&&s.maxSelectedRank===0));
  for(let seat=0;seat<2;seat++){
   assert.equal(result.parity[seat].placements,counts.placements[seat]);assert.equal(result.parity[seat].holds,counts.holds[seat]);
   assert.equal(counts.holds[seat],counts.reanalyses[seat]+(pending[seat]?.playing===false?1:0));
  }
  assert.ok(smoke?['frame-cap','topout'].includes(result.reason):result.reason==='topout','Must end by authority KO; watchdog is a technical failure');
  if(ft7){
   const scored=scoreKO(report.score,result,swapped);report.score=scored.score;
   Object.assign(report.games.at(-1),scored);await save();
  }
  if(batch){
   const scored=scoreKO([0,0],result,swapped);report.batchScored=scored.scored;
   Object.assign(report.games.at(-1),scored);await save();
  }
  console.log(JSON.stringify({type:'game-end',game:game+1,reason:result.reason,parity:result.parity,counts,...(ft7?{score:report.score}:{})}));
 }
 if(!smoke&&!batch)for(let policy=0;policy<2;policy++){
  const total=k=>report.games.reduce((n,g)=>n+g.counts[k][g.swapped?1-policy:policy],0);
  assert.ok(total('placements')>=24,'Insufficient placement coverage');
  assert.ok(total('reanalyses')>0,'No Hold/reveal coverage');assert.ok(total('receives')>0,'No incoming garbage coverage');
 }
 report.complete=true;report.status=batch?'batch-leg-completed':ft7?'ft7-completed':smoke?'local-smoke-completed':'arena-integration-passed';await save();
}catch(e){report.status=ft7?'ft7-failed':'integration-failed';report.error={message:e.message,stack:e.stack,details:e.details};await save();throw e;}
