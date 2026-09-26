// Synthetic conditional transition audit, not a bot/strength experiment.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import * as B from '../src/board.js';
import * as R from '../src/rotation.js';
import {Engine} from '../src/engine.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine,validatePlacement,commitPlacement,placementIdentity} from '../src/analysis/placement-authority.js';
import {createPlacementTools} from '../vendor/kiwi-v1/tetrp-placement-path.mjs';
import {SNAPSHOT_RULE_FIELDS,assertSupportedSnapshotRules} from '../vendor/kiwi-v1/kiwi-snapshot-adapter.mjs';

const PIN='2e243242b674d57491f99b445f75e35fc48a0e26';
const tools=createPlacementTools({Engine,boardModule:B,rotationModule:R});
const key=c=>c.map(([x,y])=>`${x},${Math.ceil(y)}`).sort().join(';');
const boardBits=board=>({
  cols:Array.from({length:10},(_,x)=>board.rows.reduce((bits,row,y)=>bits|(row[x]===null?0n:1n<<BigInt(39-y)),0n).toString()),
  garbageRows:board.rows.reduce((bits,row,y)=>bits|(row.includes('gb')?1n<<BigInt(39-y):0n),0n).toString(),
});
function fromPublic(v){
  const e=new PlacementArenaEngine({rules:v.rules}),s=e.state;
  Object.assign(s,{board:structuredClone(v.board),piece:structuredClone(v.current),hold:{...v.hold},
    frame:v.frame,subframe:v.subframe,playing:v.playing,garbageLockedUntil:v.garbageLockedUntil});
  s.bag.queue=[...v.next];s.stats.pieces=v.piecesPlaced;
  Object.assign(s.attack,structuredClone(v.attack));s.attack.pieces=v.piecesPlaced;
  s.lastClear=s.attack.combo>0;
  return e;
}
function dropAction(e,path=['hardDrop']){
  const p=fromPublic(visibleState(e.state));
  for(const op of path){if(op==='hardDrop')p.slam(true);else if(op==='rotateCW')assert.ok(p.rotate(1));else throw Error(op);}
  const {spin,...move}=placementIdentity(p.state.piece);
  return {action:{kind:'place'},move:{...move,useHold:false},execution:{moves:path,spin}};
}
async function templates(){
  const out=[];
  for(const [name,lines] of [['empty',0],['single',1],['double-ac',2],['quad',4],['garbage-quad',4]]){
    const e=new PlacementArenaEngine(),s=e.state;e.spawn(lines===4?'i':'o');s.hold={piece:'z',locked:false};
    for(let y=40-lines;y<40;y++)s.board.rows[y]=Array.from({length:10},(_,x)=>
      (lines===4?x===5:x===4||x===5)?null:name==='garbage-quad'?'gb':'j');
    if(lines===4)s.board.rows[35][0]='j'; // distinguish ordinary quad from AC
    out.push({name,snapshot:visibleState(s),action:dropAction(e,lines===4?['rotateCW','hardDrop']:['hardDrop']),lines});
  }
  const t=JSON.parse(await readFile('test/fixtures/transport/legacy-t-spin.json','utf8'));
  t.snapshot.hold={piece:'z',locked:false};
  out.push({name:'full-spin-single',snapshot:t.snapshot,action:t.action,lines:1});
  for(const t of out){
    const e=fromPublic(t.snapshot),proof=validatePlacement(t.snapshot,t.action);
    assert.equal(proof.clear.lines,t.lines,t.name);
    const placements=tools.enumerateRootPlacements(e).placements;
    t.placement=placements.find(p=>p.spin===t.action.execution.spin&&key(tools.targetFor(p).cells)===key(t.action.move.cells));
    assert.ok(t.placement,`missing converted certified placement ${t.name}`);
  }
  return out;
}
function addPressure(e,packets,scenario){
  const s=e.state;s.attack.pending=[];s.attack.are=[];s.waiting=[];
  packets.forEach(([amt,delay],i)=>{
    const cid=i+1;
    s.attack.pending.push({cid,amt,active:delay===0,activeFrame:s.frame+delay,status:'spawn',
      hardened:false,shielded:false,column:(scenario+3*i)%10});
    if(delay)e.schedule(delay,'incoming-attack-hit',{cid});
  });
}
function inputFor(id,v,placement,scenario){
  assertSupportedSnapshotRules(v.rules);
  return {id,start:{board:v.board.rows.toReversed().map(row=>row.map(c=>c===null?null:c==='gb'?'G':c.toUpperCase())),
    queue:[v.current.type,...v.next].map(p=>p.toUpperCase()),hold:v.hold.piece?.toUpperCase()??null,
    combo:v.attack.combo,back_to_back:v.attack.btb>0,b2b_count:Math.max(0,v.attack.btb-1)},
    rules:Object.fromEntries(SNAPSHOT_RULE_FIELDS.map(k=>[k,v.rules[k]])),placement,
    frame:v.frame,cadence:24,multiplier:v.attack.multiplier,margin:v.rules.garbagemargin_frames,
    rate:v.rules.garbageincrease_per_second,pieces:v.piecesPlaced,sent:v.attack.cumulativeSent,
    incoming:v.attack.pending.map(p=>[p.amt,p.active?0:p.activeFrame-v.frame]),scenario};
}
function authority(e,action){
  const s=e.state,start=s.frame,proof=validatePlacement(visibleState(s),action);
  while(s.frame<start+23)e.step();
  e.beginFrame([]);e.advanceSegment(.5);
  const lockMultiplier=s.attack.multiplier,phases=[],emit=e.emit;
  e.emit=function(type,data){
    if(type==='attack')phases.push({phase:data.phase,before:{...s.attack.totals}});
    emit.call(this,type,data);
  };
  const result=commitPlacement(e,proof,start+23),totals={...s.attack.totals};e.emit=emit;
  const packets=phases.map((p,i)=>(phases[i+1]?.before??totals).generated-p.before.generated).filter(n=>n>0);
  e.finishFrame();
  return {...boardBits(s.board),combo:s.attack.combo,btb:s.attack.btb,pieces:s.attack.pieces,
    cumulativeSent:s.attack.cumulativeSent,pending:s.attack.pending.map(p=>({amt:p.amt,ready:p.activeFrame-start,active:p.active})),
    elapsed:s.frame-start,clear:result.clear,spin:result.locks[0].spin,cells:result.locks[0].cells,
    lockFrame:result.locks[0].frame,lockMultiplier,packets,totals,
    playing:s.playing,reason:s.reason,nextSnapshot:visibleState(s),provenance:proof.provenance};
}
export async function prepare(directory){
  await mkdir(directory,{recursive:true});
  const ts=await templates(),cases=[];
  const variants=[
    {tag:'plain'},
    {tag:'opener-last',pieces:13,packets:[[12,0]]},
    {tag:'opener-after',pieces:14,packets:[[12,0]]},
    {tag:'opener-sent-over-pending',pieces:0,sent:13,packets:[[12,0]]},
    {tag:'charged-combo',btb:11,combo:3,packets:[[20,0]]},
    {tag:'charged-base3',btb:11,combo:3,base:3,packets:[[2,0],[8,25],[9,0]]},
    {tag:'fractional-multiplier',btb:5,combo:2,multiplier:1.75,packets:[[3,0],[7,24]]},
    {tag:'late-clock',frame:10800,btb:5,multiplier:1},
  ];
  function add(t,v){
    const e=fromPublic(t.snapshot),s=e.state;
    s.frame=v.frame??0;s.subframe=0;s.phase='ready';s.stats.pieces=v.pieces??20;
    Object.assign(s.attack,{pieces:s.stats.pieces,combo:v.combo??0,btb:v.btb??0,
      multiplier:v.multiplier??1,cumulativeSent:v.sent??0,outgoing:{},incoming:{},outbox:[]});
    s.attack.totals={generated:0,cancelled:0,sent:0,tanked:0,received:0};
    s.lastClear=s.attack.combo>0;s.garbageLockedUntil=0;
    if(v.base!==undefined)s.rules.b2bcharge_base=v.base;
    if(v.top)s.board.rows[0][0]='j';
    const scenario=v.scenario??0;addPressure(e,v.packets??[],scenario);
    const snapshot=visibleState(s),id=`${t.name}/${v.tag}`;
    const input=inputFor(id,snapshot,t.placement,scenario),expected=authority(e,t.action);
    cases.push({id,snapshot,action:t.action,input,expected,
      note:v.note??'synthetic conditional state; not a strength sample'});
  }
  for(const t of ts)for(const v of variants)add(t,v);
  for(const offset of [0,1,23,24,25])for(const scenario of [0,4,9])
    add(ts[0],{tag:`activation-${offset}-hole-${scenario}`,packets:[[2,offset]],scenario});
  add(ts[0],{tag:'inactive-head',packets:[[2,25],[3,0]],note:'conditional packet ordering, arena occurrence not established'});
  add(ts[0],{tag:'partial-storage-top',top:true,packets:[[1,0]]});
  const files=['src/engine.js','src/attack.js','src/board.js','src/rotation.js','src/physics.js',
    'src/analysis/placement-authority.js','src/analysis/visible-state.js',
    'scripts/kiwi-cc2-transition-audit.js','scripts/kiwi-cc2-audit-prepare.js','tools/cc2-transition-audit/src/main.rs'];
  const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
  await writeFile(`${directory}/cases.json`,JSON.stringify(cases,null,2));
  await writeFile(`${directory}/input.jsonl`,cases.map(c=>JSON.stringify(c.input)).join('\n')+'\n');
  await writeFile(`${directory}/manifest.json`,JSON.stringify({pin:PIN,count:cases.length,hashes,
    tetrpCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    contract:'24 frame placement, conditional hypothetical hole scenarios, finite current+NEXT5; transition only'},null,2));
  return cases;
}
export function differences(c,r){
  assert.equal(r.id,c.id);assert.ok(!r.error,`${c.id}: ${r.error}`);
  const a=c.expected,f=r.after.forecast;
  const wanted={cols:a.cols,garbageRows:a.garbageRows,combo:a.combo,btb:a.btb,pieces:a.pieces,
    cumulativeSent:a.cumulativeSent,pending:a.pending,elapsed:a.elapsed,
    clear:{lines:a.clear.lines,garbageRows:a.clear.garbageRows,allClear:a.clear.allClear},
    spin:a.spin,cells:key(a.cells),packets:a.packets,generated:a.totals.generated,
    cancelled:a.totals.cancelled,sent:a.totals.sent,tanked:a.totals.tanked};
  const attacks=r.events.filter(e=>e.kind==='attack');
  const actual={cols:r.after.cols,garbageRows:r.after.garbageRows,combo:r.after.combo,btb:r.after.btb,pieces:f.pieces,
    cumulativeSent:f.sent,pending:f.pending.map(({amt,ready,active})=>({amt,ready,active})),elapsed:f.elapsed,
    clear:r.clear,spin:r.placement.spin,cells:key(r.cells.map(([x,y])=>[x,39-y])),packets:r.packets,generated:r.generated,
    cancelled:attacks.reduce((n,p)=>n+p.cancelled,0),sent:attacks.reduce((n,p)=>n+p.sent,0),tanked:r.events.filter(e=>e.kind==='tank').length};
  const fields=Object.keys(wanted).filter(k=>!isDeepStrictEqual(wanted[k],actual[k]));
  // JS increments per frame; Rust computes an affine expression. Capture the
  // numeric residual and independently compare the integer attack transaction.
  const multiplierResidual=r.lockMultiplier-a.lockMultiplier;
  if(!Number.isFinite(multiplierResidual)||Math.abs(multiplierResidual)>1e-12)fields.push('lockMultiplier');
  return {id:c.id,fields,wanted,actual,multiplierResidual};
}
async function compare(directory,binary){
  const cases=JSON.parse(await readFile(`${directory}/cases.json`,'utf8'));
  const run=spawnSync(resolve(binary),[],{input:await readFile(`${directory}/input.jsonl`),encoding:'utf8',maxBuffer:32*1024*1024,timeout:120000});
  await writeFile(`${directory}/rust-output.jsonl`,run.stdout??'');await writeFile(`${directory}/rust-stderr.log`,run.stderr??'');
  if(run.error)throw run.error;assert.equal(run.status,0,run.stderr);
  const rows=run.stdout.trim().split('\n').map(s=>JSON.parse(s));assert.equal(rows.length,cases.length);
  const result=cases.map((c,i)=>differences(c,rows[i]));
  const fields={};for(const r of result)for(const k of r.fields)fields[k]=(fields[k]??0)+1;
  const summary={status:'completed-diagnostic',checks:cases.length,mismatches:result.filter(r=>r.fields.length).length,fields,
    coverage:'GameState::advance + real Forecast/attack; authority-certified input placement',
    notCertified:['CC2 movegen/provenance','Hold lifecycle','spawn/KO','search strength'],
    note:'Success means diagnostics completed, NOT model parity or strength promotion'};
  await writeFile(`${directory}/comparisons.json`,JSON.stringify(result,null,2));
  await writeFile(`${directory}/mismatches.json`,JSON.stringify(result.flatMap((r,i)=>r.fields.length?[{...r,fixture:cases[i],rust:rows[i]}]:[]),null,2));
  await writeFile(`${directory}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}
async function notify(directory){
  let s;try{s=JSON.parse(await readFile(`${directory}/summary.json`,'utf8'));}catch{}
  const url=`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const message=s?`${s.checks} transitions; ${s.mismatches} model mismatches. Diagnostic only; not a parity pass or strength result.`:'Diagnostic failed before producing a complete result. Check logs and partial artifacts.';
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`${message}\n\n${url}\n`);
  const response=await fetch('https://ntfy.sh',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({topic:'just_a_kiwi_for_tetrp',title:s?'CC2 transition audit completed':'CC2 transition audit failed',message:message+'\n'+url,click:url}),signal:AbortSignal.timeout(15000)});
  assert.ok(response.ok,`ntfy HTTP ${response.status}`);const receipt=await response.json();assert.ok(receipt.id);console.log(`ntfy accepted: ${receipt.id}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [mode,directory='.cache/cc2-transition-results',binary]=process.argv.slice(2);
  if(mode==='prepare')console.log(`Prepared ${(await prepare(directory)).length} certified authority fixtures`);
  else if(mode==='compare')await compare(directory,binary);
  else if(mode==='notify')await notify(directory);
  else throw Error('Expected prepare | compare <dir> <binary> | notify');
}
