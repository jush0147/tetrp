import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as B from '../src/board.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine,placementIdentity,validatePlacement} from '../src/analysis/placement-authority.js';
import {SNAPSHOT_RULE_FIELDS} from '../vendor/kiwi-v1/kiwi-snapshot-adapter.mjs';
import {convert} from './kiwi-cc2-rotation-audit.js';

const dir=process.argv[2]??'.cache/cc2-rotation-results/reference';
const source=process.argv[3]??'.cache/cc2-movegen-results/cases.json';
const fixtures=JSON.parse(await readFile(source,'utf8'));
const directions={rotateCW:1,rotate180:2,rotateCCW:3};
const key=p=>B.cells(p).map(([x,y])=>`${x},${Math.ceil(y)}`).sort().join(';');
const run=(e,op)=>op==='down'?e.descend(1):op==='moveLeft'?e.move(-1):op==='moveRight'?e.move(1):e.rotate(directions[op]);
function engine(f){
  const e=new PlacementArenaEngine({rules:f.snapshot.rules});e.emit=()=>{};
  e.state.board=structuredClone(f.snapshot.board);e.state.lastClear=f.clutch;
  e.state.bag.queue=[...f.snapshot.next];e.spawn(f.snapshot.current.type);
  assert.deepEqual(e.state.piece,f.snapshot.current,'source must actually be a spawn pose');
  return e;
}
const cases=[],seen=new Set(),rejectedExtensions=[];
let visitedPrefixes=0;
for(const f of fixtures){
  if(!f.snapshot.playing)continue;
  for(const m of f.authority.moves)for(const cycles of [0,32]){
    const e=engine(f),path=[];
    const ops=[...Array(cycles).fill('rotateCW'),...m.action.execution.moves.slice(0,-1)];
    // Include every prefix, including the actual spawn and grounded tuck poses.
    for(let cursor=0;cursor<=ops.length;cursor++){
      visitedPrefixes++;
      const current={...e.state.piece};assert.equal(Number.isInteger(current.y),false);
      for(const direction of [1,2,3]){
        e.state.piece={...current};const snapshot=visibleState(e.state),success=e.rotate(direction);
        const expected=success?{success,after:{...e.state.piece},cells:B.cells(e.state.piece),spin:e.state.piece.spin}:{success};
        const history=current.totalRotations>30?'above':current.totalRotations===30?'threshold':'below';
        // Select one concrete witness per board/type/rotation/kick/outcome/history signature.
        const signature=[f.id,current.r,direction,success,expected.after?.kick,expected.spin,history,
          success?Math.ceil(expected.after.y)-Math.ceil(current.y):null].join('/');
        if(seen.has(signature))continue;seen.add(signature);
        let proof=null;
        if(success){
          e.slam(true);const {spin,...move}=placementIdentity(e.state.piece);
          const rotation=Object.keys(directions).find(k=>directions[k]===direction);
          proof=validatePlacement(snapshot,{action:{kind:'place'},move:{...move,useHold:false},execution:{moves:[rotation,'hardDrop'],spin}});
        }
        // Independently replay the entire source path and require exact provenance,
        // not just equal cells or an assigned rotation-history counter.
        const replay=engine(f);
        const provenance=[];
        for(const op of path){const before={...replay.state.piece};assert.equal(run(replay,op),true);
          provenance.push({op,before,after:{...replay.state.piece}});}
        assert.deepEqual(replay.state.piece,current);
        const id=`reachable/${cases.length}/${f.id}/d${direction}/history${current.totalRotations}`;
        const input={id,from:convert(current),direction,start:{
          board:snapshot.board.rows.toReversed().map(row=>row.map(x=>x===null?null:x==='gb'?'G':x.toUpperCase())),
          queue:[current.type,...snapshot.next].map(x=>x.toUpperCase()),hold:'J',combo:0,back_to_back:false,b2b_count:0},
          rules:Object.fromEntries(SNAPSHOT_RULE_FIELDS.map(k=>[k,snapshot.rules[k]]))};
        cases.push({id,snapshot,input,expected,proof,certificateError:null,historyChanged:false,
          sourceFixture:f.id,spawnSnapshot:f.snapshot,path:[...path],provenance,
          scope:'Spawn-reachable on supplied board under atomic placement model; board history and physical timing not certified'});
      }
      e.state.piece={...current};
      if(cursor===ops.length)break;
      if(!run(e,ops[cursor])){
        assert.ok(cycles>0,'original certified path must replay');
        rejectedExtensions.push({fixture:f.id,path:[...path],op:ops[cursor]});break;
      }
      path.push(ops[cursor]);
    }
  }
}
const coverage={cases:cases.length,visitedPrefixes,sourceFixtures:fixtures.length,
  signatures:seen.size,historyAbove30:cases.filter(c=>c.snapshot.current.totalRotations>30).length,
  historyAt30:cases.filter(c=>c.snapshot.current.totalRotations===30).length,
  kick3:cases.filter(c=>c.expected.after?.kick===3).length,rotate180:cases.filter(c=>c.input.direction===2).length,
  spins:[...new Set(cases.filter(c=>c.expected.success).map(c=>c.expected.spin))],
  rejectedExtendedPaths:rejectedExtensions.length,authorityDropCertificateDisagreements:0,
  exactIntegerPoses:cases.filter(c=>Number.isInteger(c.snapshot.current.y)).length};
assert.ok(coverage.historyAbove30&&coverage.historyAt30&&coverage.rotate180&&coverage.kick3);
assert.ok(coverage.spins.includes('full')&&coverage.spins.includes('mini'));
await mkdir(dir,{recursive:true});
await writeFile(`${dir}/cases.json`,JSON.stringify(cases));
await writeFile(`${dir}/input.jsonl`,cases.map(c=>JSON.stringify(c.input)).join('\n')+'\n');
await writeFile(`${dir}/coverage.json`,JSON.stringify(coverage,null,2));
await writeFile(`${dir}/rejected-extensions.json`,JSON.stringify(rejectedExtensions));
const files=['scripts/kiwi-cc2-reachable-rotation.js','scripts/kiwi-cc2-rotation-audit.js',source,
  'src/engine.js','src/physics.js','src/rotation.js','src/board.js','src/analysis/placement-authority.js',
  'tools/cc2-transition-audit/rotation-probe.rs','tools/cc2-transition-audit/src/bin/rotation.rs'];
const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
await writeFile(`${dir}/manifest.json`,JSON.stringify({pin:'2e243242b674d57491f99b445f75e35fc48a0e26',hashes,
  note:'Finite spawn-reachable path corpus on fixture boards. Does not certify board reachability from empty, physical 24-frame execution, complete movegen or strength.'},null,2));
console.log(JSON.stringify(coverage));
