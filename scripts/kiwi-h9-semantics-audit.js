// Offline feature witnesses + authority geometry; no policy change or new search.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as B from '../src/board.js';
import {PlacementArenaEngine} from '../src/analysis/placement-authority.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {enumerateAuthority} from './kiwi-cc2-movegen-audit.js';
const dir='docs/audits/cc2-alignment',read=async p=>JSON.parse(await readFile(p,'utf8'));
const w=(await read(`${dir}/ACTIVE_PARAMETERS_2026-09-28.json`)).config.freestyle_weights;
const source=await readFile('.cache/cc2-parameter-audit/src/bot/freestyle.rs','utf8');
const sourceFunction=source.slice(source.indexOf('fn cavity_excavation_cost('),source.indexOf('fn h3_inventory('));
assert(sourceFunction.includes('min_blockers = min_blockers.min(blockers)'));
assert.equal(w.h9_cavity_excavation,-0.5);
const pop=n=>{let c=0;for(;n;n&=n-1n)c++;return c;};
function measure(columns){
 const cols=columns.map(BigInt),heights=cols.map(c=>c===0n?0:c.toString(2).length),top=Math.min(40,Math.max(...heights));
 let holes=0,covered=0;for(let x=0;x<10;x++)for(let y=0;y<heights[x];y++)if(!(cols[x]&(1n<<BigInt(y)))){holes++;covered+=Math.min(heights[x]-y,w.max_cell_covered_height);}
 const seen=new Set(),components=[],empty=(x,y)=>!(cols[x]&(1n<<BigInt(y)));
 for(let y=0;y<top;y++)for(let x=0;x<10;x++){
  const index=y*10+x;if(seen.has(index)||!empty(x,y))continue;
  const stack=[index],cells=[];seen.add(index);let minBlockers=Infinity;
  while(stack.length){const k=stack.pop(),cx=k%10,cy=Math.floor(k/10);cells.push([cx,cy]);minBlockers=Math.min(minBlockers,pop(cols[cx]>>BigInt(cy+1)));
   for(const [nx,ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]])if(nx>=0&&nx<10&&ny>=0&&ny<top&&empty(nx,ny)&&!seen.has(ny*10+nx)){seen.add(ny*10+nx);stack.push(ny*10+nx);}
  }
  components.push({cells,minBlockers});
 }
 const cost=components.reduce((n,c)=>n+c.minBlockers,0);
 return {height:top,holes,covered,cost,h9:cost*w.h9_cavity_excavation,components};
}
const audits=[];
for(const [run,path] of [[36551709585,'.cache/eval-run-36551709585/observed.json'],[36566413689,'.cache/tslot-run-36566413689/observed.json']]){
 let count=0,maxError=0,nonzero=0;
 for(const report of await read(path))for(const row of report.diagnostic.rows){
  const m=measure(row.realBoardCols),recorded=row.stages.find(s=>s.stage==='cavity').deltaEval,error=Math.abs(m.h9-recorded);
  assert(error<0.001,'diagnostic H9 differs from source arithmetic');maxError=Math.max(error,maxError);count++;nonzero+=Number(m.cost>0);
 }
 audits.push({run,witnesses:count,nonzero,maxError});
}
const fixtures=[
 ['sealed-single',[7,5,7,0,0,0,0,0,0,0]],
 ['side-open-single',[7,7,5,0,0,0,0,0,0,0]],
 ['sealed-double',[7,5,5,7,0,0,0,0,0,0]],
 ['one-cell-high-tunnel',[2,2,2,2,2,2,2,2,2,0]],
].map(([id,columns])=>({id,columns,...measure(columns)}));
assert.equal(fixtures[0].holes,fixtures[1].holes);assert.equal(fixtures[0].covered,fixtures[1].covered);
assert.equal(fixtures[0].height,fixtures[1].height);assert.equal(fixtures[0].cost,1);assert.equal(fixtures[1].cost,0);
assert.equal(fixtures[2].cost,1);assert.equal(fixtures[2].holes,2);assert.equal(fixtures[3].cost,0);
const tunnel=fixtures[3],board=B.createBoard();
for(let x=0;x<10;x++)for(let y=0;y<40;y++)if(BigInt(tunnel.columns[x])&(1n<<BigInt(y)))board.rows[39-y][x]='j';
assert.equal(B.fullLines(board).length,0);
const geometry=[];
for(const piece of ['i','o','t','s','z','j','l']){
 const e=new PlacementArenaEngine();e.state.board=structuredClone(board);e.spawn(piece);
 const enumerated=enumerateAuthority(visibleState(e.state));assert(enumerated.complete);
 const covering=enumerated.moves.filter(m=>m.action.move.cells.some(([x,y])=>x===0&&y===39));
 geometry.push({piece,states:enumerated.states,legalLandings:enumerated.moves.length,targetCoveringLandings:covering.length,
  witness:covering.length?covering[0].action:null});
}
assert(geometry.some(r=>r.targetCoveringLandings>0));
assert.equal(geometry.find(r=>r.piece==='o').targetCoveringLandings,0);
const result={schema:'kiwi-h9-semantics/1',sourceFunctionSha256:createHash('sha256').update(sourceFunction).digest('hex'),
 audits,fixtures,geometry:{board,targetCell:[0,39],atomicModel:'tl-placement-v1',completeForSevenFreshSpawnPieces:true,pieces:geometry},
 limits:'H9 arithmetic reproduction, not a second gameplay model. Geometry counterexample concerns one placement on a fixed synthetic board, not eventual excavation, physical input timing or KO strength. Quota samples are not population frequencies.'};
await writeFile(`${dir}/H9_SEMANTIC_EVIDENCE.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({audits,fixtures:fixtures.map(({components,...r})=>r),geometry},null,2));
