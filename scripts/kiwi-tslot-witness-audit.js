// Offline, conditional T-at-spawn geometry and board-feature audit only.
// Never treats the hypothetical T as revealed input to an online policy.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {enumerateAuthority,cellsKey} from './kiwi-cc2-movegen-audit.js';
import {PlacementArenaEngine,validatePlacement} from '../src/analysis/placement-authority.js';
import {visibleState} from '../src/analysis/visible-state.js';
import * as B from '../src/board.js';
import * as R from '../src/rotation.js';
import {Engine} from '../src/engine.js';
import {createPlacementTools} from '../vendor/kiwi-v1/tetrp-placement-path.mjs';

const base='.cache/eval-run-36551709585',dir='docs/audits/cc2-alignment';
const raw=await readFile(`${base}/observed.json`,'utf8'),observed=JSON.parse(raw);
const inputs=JSON.parse(await readFile(`${dir}/eval-public-inputs.json`,'utf8'));
const weights=JSON.parse(await readFile(`${dir}/ACTIVE_PARAMETERS_2026-09-28.json`,'utf8')).config.freestyle_weights;
const tools=createPlacementTools({Engine,boardModule:B,rotationModule:R});
const pop=n=>{let c=0;for(;n;n&=n-1n)c++;return c;};
const height=n=>n===0n?0:n.toString(2).length;
function features(cols){
 const cs=cols.map(BigInt),hs=cs.map(height);let holes=0,covered=0;
 for(let x=0;x<10;x++)for(let y=0;y<hs[x];y++)if(!(cs[x]&(1n<<BigInt(y)))){holes++;covered+=Math.min(hs[x]-y,weights.max_cell_covered_height);}
 const well=hs.indexOf(Math.min(...hs)),mask=(1n<<64n)-1n;
 let full=cs.reduce((n,c,x)=>x===well?n:n&c,mask)>>BigInt(hs[well]),wellDepth=0;
 while(full&1n){wellDepth++;full>>=1n;}
 let transitions=pop(mask^cs[0])+pop(mask^cs[9]);for(let x=1;x<10;x++)transitions+=pop(cs[x-1]^cs[x]);
 const maxHeight=Math.max(...hs);
 const scores={holes:holes*weights.holes*weights.h6_base_holes_scale,coveredness:covered*weights.cell_coveredness*weights.h6_base_coveredness_scale,
  well:wellDepth*weights.tetris_well_depth,height:maxHeight*weights.height+Math.max(0,maxHeight-10)*weights.height_upper_half+Math.max(0,maxHeight-15)*weights.height_upper_quarter,
  transitions:transitions*weights.row_transitions};
 return {holes,covered,maxHeight,wellDepth,transitions,scores,total:Object.values(scores).reduce((a,b)=>a+b,0)};
}
function board(cols){const b=B.createBoard();for(let x=0;x<10;x++)for(let y=0;y<40;y++)if(BigInt(cols[x])&(1n<<BigInt(y)))b.rows[39-y][x]='j';return b;}
function columns(b){return Array.from({length:10},(_,x)=>Number(b.rows.reduce((n,r,y)=>r[x]===null?n:n|(1n<<BigInt(39-y)),0n)));}
const rows=[],effects=[];
for(const [index,entry] of observed.entries()){
 const changed=entry.diagnostic.rows.filter(r=>r.category==='board_rewrite');
 for(const [sampleIndex,r] of changed.entries()){
  const before=features(r.realBoardCols),after=features(r.evaluatedBoardCols);
  for(const [key,score] of Object.entries(after.scores))assert(Math.abs(score-r.stages.find(s=>s.stage===key).deltaEval)<1e-3,`board score reproduction ${key}`);
  const tslot=r.stages.find(s=>s.stage==='tslot').deltaEval;
  effects.push({id:entry.id,sampleIndex,knownT:r.normalizedRemainingAfter.filter(x=>x==='T').length+Number(r.reserve==='T'),baseDelta:after.total-before.total,tslot,totalLocalDelta:after.total-before.total+tslot,before,after});
 }
 // Fixed first/middle/last retained board-rewrite witness per request.
 for(const sampleIndex of [...new Set([0,Math.floor((changed.length-1)/2),changed.length-1])]){
  const r=changed[sampleIndex],cutout=r.cutouts[0];assert(cutout.lines>1);
  const e=new PlacementArenaEngine({rules:inputs[index].snapshot.rules});e.state.board=board(cutout.before);
  e.state.lastClear=r.lines>0;e.state.attack.combo=r.lines?r.comboBefore+1:0;e.spawn('t');
  const snapshot=visibleState(e.state),start=performance.now();
  const set=enumerateAuthority(snapshot),target=tools.targetFor({location:cutout.location,spin:'none'});
  const matches=set.moves.filter(m=>cellsKey(m.action.move.cells)===cellsKey(target.cells));
  const proofs=matches.map(m=>{
   const proof=validatePlacement(snapshot,m.action),afterBoard=structuredClone(snapshot.board);
   B.commit(afterBoard,proof.finalPiece);B.removeLines(afterBoard,proof.clear.rows);
   assert.equal(proof.clear.lines,cutout.lines);
   const expected=r.cutouts.length>1?r.cutouts[1].before:r.evaluatedBoardCols;
   assert.deepEqual(columns(afterBoard),expected,'authority hypothetical clear board parity');
   return {spin:m.action.execution.spin,action:m.action,clear:proof.clear,provenance:proof.provenance};
  });
  rows.push({id:entry.id,sampleIndex,branch:r.branch,scenario:r.scenario,depth:r.depth,knownT:r.normalizedRemainingAfter.filter(x=>x==='T').length+Number(r.reserve==='T'),
   conditionalSnapshot:snapshot,template:cutout,authorityStates:set.states,complete:set.complete,reachableSpins:proofs.map(p=>p.spin),proofs,ms:performance.now()-start});
  console.log(JSON.stringify({id:entry.id,sampleIndex,states:set.states,spins:proofs.map(p=>p.spin)}));
 }
}
const result={schema:'kiwi-tslot-conditional-witness/1',sourceRun:36551709585,sourceSha256:createHash('sha256').update(raw).digest('hex'),date:'2026-09-29',
  selection:'First/middle/last retained rewrite per request, first cutout only. Not random.',
  scope:'Assume T available now at fresh authority spawn, unchanged board, no intervening garbage or piece placements. Occupancy reconstructed as j cells: garbage provenance intentionally unavailable; only geometry/clear cells are certified, not attack.',
  limits:'Geometry success does not prove time-to-T, intervening-board stability, physical 24-frame execution, root-choice impact or strength. Effects are JS diagnostic feature arithmetic checked against Rust after-board stage deltas, not a second search or exact f32 counterfactual evaluator.',
  summary:{geometryCases:rows.length,unreachable:rows.filter(r=>!r.reachableSpins.length).length,fullSpinReachable:rows.filter(r=>r.reachableSpins.includes('full')).length,effectCases:effects.length,
   effectMin:Math.min(...effects.map(r=>r.totalLocalDelta)),effectMax:Math.max(...effects.map(r=>r.totalLocalDelta))},rows,effects};
await writeFile(`${dir}/TSLOT_WITNESS_GEOMETRY.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary));
