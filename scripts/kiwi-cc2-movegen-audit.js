import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as B from '../src/board.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine,placementIdentity,validatePlacement} from '../src/analysis/placement-authority.js';
import {SNAPSHOT_RULE_FIELDS} from '../vendor/kiwi-v1/kiwi-snapshot-adapter.mjs';

const operations=['moveLeft','moveRight','rotateCW','rotateCCW','rotate180','down'];
export const cellsKey=c=>c.map(([x,y])=>`${x},${Math.ceil(y)}`).sort().join(';');
// In the atomic placement model, hy/reset/timing fields do not affect geometry.
// totalRotations does: retain all buckets through kickY's threshold and merge
// only the regime above it. No physical lock timeout is being modeled here.
const poseKey=(p,r)=>[p.x,p.y.toFixed(6),p.r,p.kick,p.rotated,p.spin,
  Math.min(p.totalRotations,r.lockresets+16)].join(',');
export function enumerateAuthority(snapshot,maxStates=250000){
  const e=new PlacementArenaEngine({rules:snapshot.rules}),s=e.state;
  s.board=structuredClone(snapshot.board);s.piece={...snapshot.current};s.playing=snapshot.playing;
  e.emit=()=>{};
  if(!s.playing||!B.legal(s.board,s.piece))return {states:0,moves:[],complete:true};
  const nodes=[{p:{...s.piece},parent:-1,op:null}],seen=new Set([poseKey(s.piece,s.rules)]),landings=new Map(),drops=new Map();
  for(let head=0;head<nodes.length;head++){
    assert.ok(head<maxStates,'Authority enumeration exhausted state budget; not a parity result');
    const p=nodes[head].p,dk=[p.x,p.y.toFixed(6),p.r].join(',');
    if(!drops.has(dk)){s.piece={...p};e.slam(true);drops.set(dk,s.piece.y);}
    const landed={...p,y:drops.get(dk)},identity=placementIdentity(landed),key=cellsKey(identity.cells)+':'+identity.spin;
    if(!landings.has(key))landings.set(key,{identity,node:head});
    for(const op of operations){
      s.piece={...p};
      const ok=op==='down'?e.descend(1):op==='moveLeft'?e.move(-1):op==='moveRight'?e.move(1):
        e.rotate({rotateCW:1,rotateCCW:3,rotate180:2}[op]);
      if(!ok)continue;
      const k=poseKey(s.piece,s.rules);if(seen.has(k))continue;
      seen.add(k);nodes.push({p:{...s.piece},parent:head,op});
    }
  }
  const moves=[...landings.entries()].map(([key,{identity,node}])=>{
    const path=[];for(let i=node;nodes[i].parent>=0;i=nodes[i].parent)path.push(nodes[i].op);
    path.reverse();path.push('hardDrop');
    const {spin,...move}=identity;
    const action={action:{kind:'place'},move:{...move,useHold:false},execution:{moves:path,spin}};
    const proof=validatePlacement(snapshot,action);
    return {key,action,clear:proof.clear,provenance:proof.provenance};
  });
  return {states:nodes.length,moves,complete:true};
}
async function fixtures(){
  const recorded=JSON.parse(await readFile('test/fixtures/transport/legacy-t-spin.json','utf8'));
  const out=[];
  function add(name,piece,board,clutch=false){
    const e=new PlacementArenaEngine(),s=e.state;
    if(board)s.board=structuredClone(board);
    s.bag.queue=['i','o','t','s','z'];s.hold={piece:'j',locked:false};s.lastClear=clutch;
    e.spawn(piece);s.attack.combo=clutch?1:0;
    out.push({id:`${name}/${piece}/${clutch}`,snapshot:visibleState(s),clutch});
  }
  const overhang=new PlacementArenaEngine().state.board;
  const rows=['###..#####','##....####','###...####','####..####'];
  rows.forEach((row,i)=>overhang.rows[36+i]=[...row].map(c=>c==='#'?'j':null));
  for(const piece of ['i','o','t','s','z','j','l']){
    add('empty',piece);add('recorded-board-respawn',piece,recorded.snapshot.board);add('overhang',piece,overhang);
  }
  const high=new PlacementArenaEngine().state.board;
  high.rows[18][4]='j';high.rows[18][5]='j';
  for(const piece of ['i','o','t'])for(const clutch of [false,true])add('spawn-obstruction',piece,high,clutch);
  for(const mirror of [false,true])for(const lift of [0,2,8])for(const piece of ['j','l']){
    const board=new PlacementArenaEngine().state.board;
    overhang.rows.forEach((row,y)=>{if(y>=lift)board.rows[y-lift]=mirror?[...row].reverse():[...row];});
    add(`descent-mirror-${mirror}-lift-${lift}`,piece,board);
  }
  for(const lift of [11,12])for(const piece of ['i','j']){
    const board=new PlacementArenaEngine().state.board;
    overhang.rows.forEach((row,y)=>{if(y>=lift)board.rows[y-lift]=[...row];});
    add(`air-boundary-lift-${lift}`,piece,board);
  }
  return out;
}
export function compareSets(c,row){
  assert.equal(row.id,c.id);assert.ok(!row.error,row.error);assert.ok(Array.isArray(row.moves));
  const native=new Map(c.authority.moves.map(m=>[m.key,m]));
  const rust=new Map(row.moves.map(m=>[cellsKey(m.cells.map(([x,y])=>[x,39-y]))+':'+m.placement.spin,m]));
  const geometry=keys=>new Set([...keys].map(k=>k.slice(0,k.lastIndexOf(':'))));
  const aCells=geometry(native.keys()),rCells=geometry(rust.keys());
  const authorityOnly=[...native.keys()].filter(k=>!rust.has(k)),cc2Only=[...rust.keys()].filter(k=>!native.has(k));
  return {id:c.id,authorityCount:native.size,cc2Count:rust.size,
    authorityOnly,cc2Only,authorityOnlyCells:[...aCells].filter(k=>!rCells.has(k)),cc2OnlyCells:[...rCells].filter(k=>!aCells.has(k)),
    authorityWitnesses:authorityOnly.map(k=>native.get(k)),cc2Placements:cc2Only.map(k=>rust.get(k))};
}
async function prepare(dir,limit){
  await mkdir(dir,{recursive:true});
  const cases=[];
  for(const c of (await fixtures()).slice(0,limit)){
    c.authority=enumerateAuthority(c.snapshot);cases.push(c);
    console.log(`${c.id}: ${c.authority.states} states, ${c.authority.moves.length} certified landings`);
    await writeFile(`${dir}/cases.json`,JSON.stringify(cases));
  }
  const inputs=cases.map(c=>{const v=c.snapshot;return {id:c.id,clutch:c.clutch,
    start:{board:v.board.rows.toReversed().map(row=>row.map(x=>x===null?null:x==='gb'?'G':x.toUpperCase())),
      queue:[v.current.type,...v.next].map(x=>x.toUpperCase()),hold:'J',combo:v.attack.combo,back_to_back:false,b2b_count:0},
    rules:Object.fromEntries(SNAPSHOT_RULE_FIELDS.map(k=>[k,v.rules[k]]))};});
  await writeFile(`${dir}/input.jsonl`,inputs.map(c=>JSON.stringify(c)).join('\n')+'\n');
  const files=['scripts/kiwi-cc2-movegen-audit.js','tools/cc2-transition-audit/src/bin/movegen.rs',
    'src/engine.js','src/board.js','src/rotation.js','src/physics.js','src/analysis/placement-authority.js',
    'src/data/pieces.json','src/data/kicks.json','src/data/spins.json'];
  const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
  await writeFile(`${dir}/manifest.json`,JSON.stringify({pin:'2e243242b674d57491f99b445f75e35fc48a0e26',
    tetrpCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes,count:cases.length,
    scope:'Spawn-based landing cells + spin sets. Atomic placement semantics; no policy, Hold lifecycle, physical timing or strength certification.'},null,2));
}
async function compare(dir,binary){
  const cases=JSON.parse(await readFile(`${dir}/cases.json`,'utf8'));
  const run=spawnSync(resolve(binary),[],{input:await readFile(`${dir}/input.jsonl`),encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
  await writeFile(`${dir}/rust-output.jsonl`,run.stdout??'');await writeFile(`${dir}/rust-stderr.log`,run.stderr??'');
  if(run.error)throw run.error;assert.equal(run.status,0,run.stderr);
  const rows=run.stdout.trim().split('\n').map(JSON.parse);assert.equal(rows.length,cases.length);
  const comparisons=cases.map((c,i)=>compareSets(c,rows[i]));
  await writeFile(`${dir}/comparisons.json`,JSON.stringify(comparisons));
  const mismatch=comparisons.filter(c=>c.authorityOnly.length||c.cc2Only.length);
  const summary={status:'completed-movegen-diagnostic',checks:cases.length,mismatches:mismatch.length,
    authorityOnly:comparisons.reduce((n,c)=>n+c.authorityOnly.length,0),cc2Only:comparisons.reduce((n,c)=>n+c.cc2Only.length,0),
    note:'Spawn landing cells+spin set diagnostic only. Differences require witness review; not strength evidence or full geometry certification.'};
  await writeFile(`${dir}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [mode,dir='.cache/cc2-movegen-results',arg]=process.argv.slice(2);
  if(mode==='prepare')await prepare(dir,arg?Number(arg):undefined);
  else if(mode==='compare')await compare(dir,arg);else throw Error('prepare | compare');
}
