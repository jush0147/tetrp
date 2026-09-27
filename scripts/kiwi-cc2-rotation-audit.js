import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import * as B from '../src/board.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine,placementIdentity,validatePlacement} from '../src/analysis/placement-authority.js';
import {createPlacementTools} from '../vendor/kiwi-v1/tetrp-placement-path.mjs';
import {Engine} from '../src/engine.js';
import * as R from '../src/rotation.js';
import {SNAPSHOT_RULE_FIELDS} from '../vendor/kiwi-v1/kiwi-snapshot-adapter.mjs';
const [mode,dir='.cache/cc2-rotation-results',arg]=process.argv.slice(2);
const key=c=>c.map(([x,y])=>`${x},${Math.ceil(y)}`).sort().join(';');
const tools=createPlacementTools({Engine,boardModule:B,rotationModule:R});
const orientations=['north','east','south','west'];
function convert(p){
  const wanted=key(B.cells(p));
  for(let x=p.x-2;x<=p.x+2;x++)for(let y=39-Math.ceil(p.y)-2;y<=39-Math.ceil(p.y)+2;y++){
    const location={type:p.type.toUpperCase(),orientation:orientations[p.r],x,y};
    if(key(tools.targetFor({location,spin:'none'}).cells)===wanted)return location;
  }
  throw Error('No exact current-pose cell conversion');
}
function probe(e,p,direction){
  e.state.piece={...p};const success=e.rotate(direction);
  return success?{success,after:{...e.state.piece},cells:B.cells(e.state.piece),spin:e.state.piece.spin}:{success};
}
async function prepare(){
  await mkdir(dir,{recursive:true});
  const recorded=JSON.parse(await readFile('test/fixtures/transport/legacy-t-spin.json','utf8'));
  const empty=new PlacementArenaEngine().state.board,overhang=structuredClone(empty);
  ['###..#####','##....####','###...####','####..####'].forEach((row,i)=>overhang.rows[36+i]=[...row].map(x=>x==='#'?'j':null));
  const seen=new Set(),cases=[];
  // Conditional legal public poses: do not claim their complete prehistory was
  // reached from spawn. Local rotation+drop certificates are checked separately.
  for(const [name,board] of [['empty',empty],['recorded',recorded.snapshot.board],['overhang',overhang]]){
    const e=new PlacementArenaEngine();e.emit=()=>{};e.state.board=board;e.state.bag.queue=['i','o','t','s','z'];
    for(const type of 'iotjszl'){
      e.spawn(type);const template={...e.state.piece};
      for(const r of [0,1,2,3])for(let x=0;x<10;x++)for(let row=33;row<40;row++)for(const fraction of [-.04,0,.1]){
        const p={...template,x,y:row+fraction,hy:Math.ceil(row+fraction),r};if(!B.legal(board,p))continue;
        for(const direction of [1,2,3]){
          const results=[0,30,31].map(totalRotations=>probe(e,{...p,totalRotations},direction));
          const historyChanged=JSON.stringify(results[1].success?[key(results[1].cells),results[1].spin]:false)!==JSON.stringify(results[2].success?[key(results[2].cells),results[2].spin]:false);
          const a=results[0];
          const signature=[type,direction,a.success,a.after?.kick,a.spin,historyChanged].join('/');
          if(seen.has(signature))continue;seen.add(signature);
          for(let k=0;k<3;k++){
            const totalRotations=[0,30,31][k],current={...p,totalRotations};e.state.piece=current;
            const snapshot=visibleState(e.state),expected=results[k];
            let proof=null,certificateError=null;
            if(expected.success){
              e.state.piece={...expected.after};e.slam(true);
              const {spin,...move}=placementIdentity(e.state.piece);
              const action={action:{kind:'place'},move:{...move,useHold:false},execution:{moves:[{1:'rotateCW',2:'rotate180',3:'rotateCCW'}[direction],'hardDrop'],spin}};
              try{proof=validatePlacement(snapshot,action);}catch(error){
                // Keep primitive evidence separate: integer-y fallProbes can
                // stop where the certificate's y+1 landing guard disagrees.
                if(error.message!=='Placement witness does not match top-1 intent')throw error;
                assert.deepEqual(error.details.actual,{...move,spin});
                certificateError={message:error.message,details:error.details};
              }
            }
            const id=`${name}/${cases.length}/${type}/d${direction}/history${totalRotations}`;
            const v=snapshot,input={id,from:convert(current),direction,
              start:{board:board.rows.toReversed().map(row=>row.map(x=>x===null?null:x==='gb'?'G':x.toUpperCase())),queue:[type,...v.next].map(x=>x.toUpperCase()),hold:'J',combo:0,back_to_back:false,b2b_count:0},
              rules:Object.fromEntries(SNAPSHOT_RULE_FIELDS.map(k=>[k,v.rules[k]]))};
            cases.push({id,snapshot,input,expected,proof,certificateError,historyChanged,
              scope:'conditional public pose; history counter supplied only to authority because CC2 rotation has no corresponding input'});
          }
        }
      }
    }
  }
  const coverage={cases:cases.length,signatures:seen.size,historyChanged:cases.filter(c=>c.historyChanged).length,
    kick3:cases.filter(c=>c.expected.after?.kick===3).length,rotate180:cases.filter(c=>c.input.direction===2).length,
    spins:[...new Set(cases.filter(c=>c.expected.success).map(c=>c.expected.spin))],
    authorityDropCertificateDisagreements:cases.filter(c=>c.certificateError).length};
  assert.ok(coverage.historyChanged&&coverage.kick3&&coverage.rotate180);assert.ok(coverage.spins.includes('full')&&coverage.spins.includes('mini'));
  await writeFile(`${dir}/cases.json`,JSON.stringify(cases));
  await writeFile(`${dir}/input.jsonl`,cases.map(c=>JSON.stringify(c.input)).join('\n')+'\n');
  await writeFile(`${dir}/coverage.json`,JSON.stringify(coverage,null,2));console.log(JSON.stringify(coverage));
  const files=['scripts/kiwi-cc2-rotation-audit.js','tools/cc2-transition-audit/rotation-probe.rs',
    'tools/cc2-transition-audit/src/bin/rotation.rs','src/engine.js','src/rotation.js','src/physics.js',
    'src/board.js','src/analysis/placement-authority.js','src/data/kicks.json','src/data/spins.json'];
  const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
  await writeFile(`${dir}/manifest.json`,JSON.stringify({pin:'2e243242b674d57491f99b445f75e35fc48a0e26',hashes,
    note:'Legal conditional current poses; CC2 has no history input. No spawn reachability or strength certification.'},null,2));
}
async function compare(){
  const cases=JSON.parse(await readFile(`${dir}/cases.json`));
  const run=spawnSync(resolve(arg),[],{input:await readFile(`${dir}/input.jsonl`),encoding:'utf8',maxBuffer:32*1024*1024,timeout:120000});
  await writeFile(`${dir}/rust-output.jsonl`,run.stdout??'');await writeFile(`${dir}/rust-stderr.log`,run.stderr??'');
  if(run.error)throw run.error;assert.equal(run.status,0,run.stderr);
  const rows=run.stdout.trim().split('\n').map(JSON.parse);assert.equal(rows.length,cases.length);
  const comparisons=cases.map((c,i)=>{
    const r=rows[i];assert.equal(r.id,c.id);assert.ok(!r.error&&!r.result.error,JSON.stringify(r));
    const actual=r.result,expected=c.expected;assert.equal(key(actual.beforeCells.map(([x,y])=>[x,39-y])),key(B.cells(c.snapshot.current)));
    const fields=[];if(actual.success!==expected.success)fields.push('rotationAcceptance');
    if(actual.success&&expected.success){
      if(key(actual.cells.map(([x,y])=>[x,39-y]))!==key(expected.cells))fields.push('cells');
      if(actual.placement.spin!==expected.spin)fields.push('spin');
    }
    return {id:c.id,fields,expected,actual,historyChanged:c.historyChanged};
  });
  await writeFile(`${dir}/comparisons.json`,JSON.stringify(comparisons));
  console.log(JSON.stringify({cases:cases.length,mismatches:comparisons.filter(c=>c.fields.length).length}));
}
if(mode==='prepare')await prepare();
else if(mode==='compare')await compare();
else if(mode==='install'){
  const file=`${dir}/src/movegen.rs`,s=await readFile(file,'utf8');assert.ok(!s.includes('audit_rotation_probe'));
  await writeFile(file,s+'\n'+await readFile('tools/cc2-transition-audit/rotation-probe.rs','utf8'));
}else throw Error('prepare | compare | install <source checkout>');
