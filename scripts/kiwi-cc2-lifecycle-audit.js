import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {PlacementArenaEngine} from '../src/analysis/placement-authority.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {convert} from './kiwi-cc2-rotation-audit.js';
import {SNAPSHOT_RULE_FIELDS} from '../vendor/kiwi-v1/kiwi-snapshot-adapter.mjs';
const [mode,dir='.cache/cc2-lifecycle-results',binary]=process.argv.slice(2);
if(mode==='prepare'){
  const cases=[];
  const upper=x=>x===null?null:x.toUpperCase();
  function add(name,board,current,hold,next,clear,locked,useHold,clutch=true){
    assert.ok(board.rows.every(row=>row.some(cell=>cell===null)),'CC2 decision fixtures must not contain uncleared full rows');
    const e=new PlacementArenaEngine({rules:{clutch}}),s=e.state;
    s.board=structuredClone(board);s.lastClear=clear;s.attack.combo=clear?1:0;
    s.bag.queue=[...next];e.spawn(current);s.hold={piece:hold,locked};
    const snapshot=visibleState(s),spawnAlive=s.playing,spawnPose={...s.piece};
    const before={current:upper(current),hold:upper(hold),next:next.map(upper)};
    const holdAccepted=useHold?e.hold():null;
    const postHold={current:upper(s.piece.type),hold:upper(s.hold.piece),next:s.bag.queue.slice(0,5).map(upper),playing:s.playing};
    let placement=null,after=null;
    if(s.playing&&(!useHold||holdAccepted)){
      e.slam(true);placement={location:convert(s.piece),spin:s.piece.spin};e.lock();
      // Expected public known prefix only. Engine-private refill is never sent to Rust.
      const consumed=useHold&&hold===null?2:1;
      after={current:upper(s.piece.type),hold:upper(s.hold.piece),next:s.bag.queue.slice(0,5-consumed).map(upper),refill:consumed,playing:s.playing};
    }
    if(spawnAlive&&useHold&&!holdAccepted){
      const probe=new PlacementArenaEngine();probe.state=structuredClone(s);probe.state.hold.locked=false;
      assert.equal(probe.hold(),true);probe.slam(true);
      placement={location:convert(probe.state.piece),spin:probe.state.piece.spin};
    }
    const id=`${cases.length}/${name}/${current}/${hold??'empty'}/clear${clear}/locked${locked}/hold${useHold}`;
    const input={id,start:{board:board.rows.toReversed().map(row=>row.map(x=>x===null?null:x==='gb'?'G':upper(x))),
      queue:[current,...next].map(upper),hold:upper(hold),combo:clear?1:0,back_to_back:false,b2b_count:0},
      rules:Object.fromEntries(SNAPSHOT_RULE_FIELDS.map(k=>[k,s.rules[k]])),hold_locked:locked,placement,use_hold:useHold};
    cases.push({id,input,snapshot,expected:{before,spawnAlive,spawnPose,holdAccepted,postHold,after},
      scope:'Conditional board/previous-clear lifecycle; not a full replay trajectory. Rust receives only current + NEXT5.'});
  }
  const empty=new PlacementArenaEngine().state.board;
  for(const current of ['t','i'])for(const hold of [null,'t','i'])for(const sameNext of [false,true])for(const useHold of [false,true]){
    add('empty',empty,current,hold,[sameNext?current:'o','s','z','j','l'],false,false,useHold);
    if(hold!==null)add('empty-locked',empty,current,hold,[sameNext?current:'o','s','z','j','l'],false,true,useHold);
  }
  for(const [x,y] of [[3,18],[4,17],[4,18],[5,18],[6,18]]){
    const board=structuredClone(empty);board.rows[y][x]='j';
    for(const current of ['i','o','t'])for(const hold of ['i','o','t'])for(const clear of [false,true])
      add(`block-${x}-${y}`,board,current,hold,['s','z','j','l','o'],clear,false,false);
  }
  // Leave a remote hole: sealed spawn geometry without unsupported uncleared rows.
  const roof=structuredClone(empty);for(let y=0;y<20;y++)roof.rows[y]=Array.from({length:10},(_,x)=>x===0?null:'j');
  for(const clear of [false,true])add('sealed-spawn',roof,'t','i',['o','s','z','j','l'],clear,false,false);
  const disabled=structuredClone(empty);disabled.rows[18][4]='j';
  add('clutch-disabled',disabled,'t','i',['o','s','z','j','l'],true,false,false,false);
  for(const [x,y,current,next0] of [[3,18,'i','o'],[3,18,'o','i'],[4,17,'o','i'],[4,17,'i','o']]){
    const board=structuredClone(empty);board.rows[y][x]='j';
    for(const clear of [false,true])add(`empty-hold-spawn-${x}-${y}`,board,current,null,[next0,'s','z','j','l'],clear,false,false);
  }
  await mkdir(dir,{recursive:true});await writeFile(`${dir}/cases.json`,JSON.stringify(cases));
  await writeFile(`${dir}/input.jsonl`,cases.map(c=>JSON.stringify(c.input)).join('\n')+'\n');
  assert.equal(cases.length,141);assert.ok(cases.some(c=>!c.expected.spawnAlive));
  assert.ok(cases.some(c=>c.expected.spawnPose.y<17.96&&c.expected.spawnAlive));
  const files=['scripts/kiwi-cc2-lifecycle-audit.js','tools/cc2-transition-audit/src/bin/lifecycle.rs',
    'src/engine.js','src/board.js','src/analysis/placement-authority.js','tools/cc2-transition-audit/mid-descent.patch'];
  const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
  await writeFile(`${dir}/manifest.json`,JSON.stringify({pin:'2e243242b674d57491f99b445f75e35fc48a0e26',hashes,
    note:'Full-reference mid-descent movegen. No transition corrections required for empty-board piece-consumption checks. Conditional spawn board/lastClear inputs.'},null,2));
  console.log(JSON.stringify({cases:cases.length,spawnKO:cases.filter(c=>!c.expected.spawnAlive).length,
    holds:cases.filter(c=>c.input.use_hold).length,clutchRescues:cases.filter(c=>c.expected.spawnAlive&&c.expected.spawnPose.y<17.96).length}));
}else if(mode==='compare'){
  const cases=JSON.parse(await readFile(`${dir}/cases.json`));
  const run=spawnSync(resolve(binary),[],{input:await readFile(`${dir}/input.jsonl`),encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
  await writeFile(`${dir}/rust-output.jsonl`,run.stdout??'');await writeFile(`${dir}/rust-stderr.log`,run.stderr??'');
  if(run.error)throw run.error;assert.equal(run.status,0,run.stderr);
  const rows=run.stdout.trim().split('\n').map(JSON.parse);assert.equal(rows.length,cases.length);
  const comparisons=cases.map((c,i)=>{const r=rows[i],e=c.expected;
    if(r.error)return {id:c.id,fields:['technicalError'],expected:e,actual:r};
    assert.equal(r.id,c.id);
    assert.deepEqual(r.before,e.before);const fields=[];
    if(!e.spawnAlive&&(r.hasLegal||r.ranked.length))fields.push('holdRescuesTerminalSpawn');
    if(!e.spawnAlive&&r.play?.accepted)fields.push('terminalTryPlayAccepted');
    if(!e.spawnAlive&&r.play?.accepted===false)assert.deepEqual(r.play.pieces,e.before);
    if(e.spawnAlive&&r.currentMoves===0)fields.push('missingCurrentSpawnMoves');
    if(c.input.use_hold&&e.holdAccepted===false&&c.input.placement){
      if(r.play?.accepted)fields.push('lockedHoldAccepted');
      else assert.deepEqual(r.play.pieces,e.before,'rejected Hold must not mutate pieces');
    }
    if(e.after){if(!r.play?.accepted)fields.push('rejectedAuthorityPlacement');
      else if(JSON.stringify(r.play.pieces)!==JSON.stringify({current:e.after.current,hold:e.after.hold,next:e.after.next})||r.play.refill!==e.after.refill)fields.push('holdQueueAfterPlacement');}
    return {id:c.id,fields,expected:e,actual:r};});
  const fields={};for(const c of comparisons)for(const f of c.fields)fields[f]=(fields[f]??0)+1;
  const summary={status:'lifecycle-diagnostic-completed',checks:cases.length,mismatches:comparisons.filter(c=>c.fields.length).length,fields,
    note:'Conditional spawn and public Bot macro-placement diagnostic; not standalone snapshot Hold or full DAG/lifecycle certification. No strength promotion.'};
  await writeFile(`${dir}/comparisons.json`,JSON.stringify(comparisons));await writeFile(`${dir}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
  assert.equal(fields.technicalError??0,0,'diagnostic input/driver errors are not rule mismatches');
}else throw Error('prepare | compare');
