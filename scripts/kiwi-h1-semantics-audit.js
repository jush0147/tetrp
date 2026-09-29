// Fixed evaluator arithmetic + actual Tetrp transactions, not a new search model.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as A from '../src/attack.js';
import * as B from '../src/board.js';
import {ruleset} from '../src/rules.js';
import {createHoles} from '../src/random.js';
const dir='docs/audits/cc2-alignment',read=async p=>JSON.parse(await readFile(p,'utf8'));
const inventory=await read(`${dir}/ACTIVE_PARAMETERS_2026-09-28.json`),w=inventory.config.freestyle_weights;
const source=await readFile('.cache/cc2-parameter-audit/src/bot/freestyle.rs','utf8');
const support=execFileSync('git',['-C','.cache/cc2-spawn-source','show',`${inventory.sourcePin}:src/ko_support.rs`],{encoding:'utf8'});
assert(source.includes('state.forecast.remaining().min(16) as f32 / 8.0'));
assert(source.includes('weights.pending_safety * pressure * ('));
assert(support.includes('covered += (height - holes.trailing_zeros()).min(max_cover)'));
assert.equal(w.pending_safety,1);assert.equal(w.cancellation_reward,0);
function features(cols){
 let height=0,holes=0,covered=0;
 for(const n of cols){const col=BigInt(n),h=col===0n?0:col.toString(2).length;height=Math.max(height,h);
  for(let y=0;y<h;y++)if(!(col&(1n<<BigInt(y)))){holes++;covered+=Math.min(h-y,w.max_cell_covered_height);}}
 const danger=-(w.holes*holes+w.cell_coveredness*covered+w.height_upper_half*Math.max(0,height-10)+w.height_upper_quarter*Math.max(0,height-15));
 return {height,holes,covered,danger};
}
const h1=(f,p)=>-w.pending_safety*Math.min(p,16)/8*f.danger;
const baseSubset=f=>w.h6_base_holes_scale*w.holes*f.holes+w.h6_base_coveredness_scale*w.cell_coveredness*f.covered+
 w.height*f.height+w.height_upper_half*Math.max(0,f.height-10)+w.height_upper_quarter*Math.max(0,f.height-15);
const audits=[];let selected;
for(const [run,path] of [[36551709585,'.cache/eval-run-36551709585/observed.json'],[36566413689,'.cache/tslot-run-36566413689/observed.json']]){
 const reports=await read(path);let count=0,maxError=0;
 for(const report of reports)for(const [index,r] of report.diagnostic.rows.entries()){
  const f=features(r.realBoardCols),actual=r.stages[0].eval,expected=h1(f,r.pendingAfter),error=Math.abs(expected-actual);
  assert.equal(r.stages[0].stage,'pending_safety');assert(error<0.001,'H1 reconstruction does not match Rust diagnostic');maxError=Math.max(maxError,error);count++;
  if(!selected&&r.pendingAfter>0&&f.danger>0)selected={run,id:report.id,index,columns:r.realBoardCols,features:f,pending:r.pendingAfter,recordedH1:actual};
 }
 audits.push({run,witnesses:count,maxFloatArithmeticError:maxError});
}
assert(selected);
const pressureTable=[0,1,4,8,12,16,20].map(p=>({pending:p,pressure:Math.min(p,16)/8,h1:h1(selected.features,p),
 // Valid only when real/evaluated boards coincide; otherwise these are two boards.
 effectiveHoles:w.holes*(w.h6_base_holes_scale+w.pending_safety*Math.min(p,16)/8),
 effectiveCovered:w.cell_coveredness*(w.h6_base_coveredness_scale+w.pending_safety*Math.min(p,16)/8),
 heightAbove10Extra:w.height_upper_half*(1+w.pending_safety*Math.min(p,16)/8),
 heightAbove15Extra:w.height_upper_quarter*(1+w.pending_safety*Math.min(p,16)/8),ordinaryHeight:w.height}));
function transaction(id,{pending,pieces=20,active=true,lines=2,spin='full'}={}){
 const rules=ruleset('tl'),s=A.createAttack();s.pieces=pieces;
 if(pending)s.pending.push({amt:pending,active,hardened:false,shielded:false,status:'spawn'});
 const result=A.resolveAttack(s,{lines,spin,allClear:false,garbageRows:0},rules,createHoles(1));
 const after=A.pendingCount(s);
 return {id,input:{pending,pieces,active,lines,spin},generated:s.totals.generated,cancelled:s.totals.cancelled,sent:s.totals.sent,pendingAfter:after,blocked:result.blocked,
  fixedBoardH1Relief:h1(selected.features,after)-h1(selected.features,pending),directH2:w.useful_attack_reward*s.totals.sent+w.cancellation_reward*s.totals.cancelled,
  caveat:'Hold board features fixed to isolate pressure effect; clear geometry, other leaf terms and edge shaping are excluded.'};
}
const transactions=[transaction('send-four',{pending:0}),transaction('cancel-four',{pending:4}),
 transaction('partial-cancel',{pending:8}),transaction('saturated-pressure',{pending:20}),
 transaction('opener-defense',{pending:8,pieces:0}),transaction('cancel-not-yet-active',{pending:4,active:false}),
 transaction('single-blocks-without-cancel',{pending:4,lines:1,spin:'none'})];
assert.equal(transactions[1].cancelled,4);assert.equal(transactions[3].fixedBoardH1Relief,0);
assert.equal(transactions[4].cancelled,8);assert.equal(transactions[5].cancelled,4);
assert.equal(transactions[6].blocked,true);assert.equal(transactions[6].cancelled,0);
assert(h1(features(Array.from({length:10},(_,x)=>x===4?0:255)),16)===0,'low clean stack has no H1 pressure cost');
function boardFromCols(cols){const b=B.createBoard();for(let x=0;x<10;x++)for(let y=0;y<40;y++)if(BigInt(cols[x])&(1n<<BigInt(y)))b.rows[39-y][x]='j';return b;}
function colsFromBoard(b){return Array.from({length:10},(_,x)=>Number(b.rows.reduce((n,r,y)=>r[x]===null?n:n|(1n<<BigInt(39-y)),0n)));}
const board=boardFromCols(selected.columns),s=A.createAttack(),rules=ruleset('tl');
s.pending.push({amt:4,active:true,hardened:false,shielded:false,status:'spawn',column:2});
const tanked=A.tank(s,rules,createHoles(1),hole=>B.pushLine(board,hole));
const afterFeatures=features(colsFromBoard(board));assert.equal(tanked,4);assert.equal(s.totals.cancelled,0);
const tank={holeScenario:2,tanked,cancelled:s.totals.cancelled,pendingAfter:A.pendingCount(s),before:selected.features,after:afterFeatures,
 h1Before:h1(selected.features,4),h1After:h1(afterFeatures,A.pendingCount(s)),baseSubsetBefore:baseSubset(selected.features),baseSubsetAfter:baseSubset(afterFeatures),
 caveat:'Actual authority tank and board insertion, fixed synthetic hole scenario; no placement, active-piece repair, future opponent, complete evaluator or KO comparison.'};
const result={schema:'kiwi-h1-semantics/1',profile:inventory.profile,sourcePin:inventory.sourcePin,
 hashes:{freestyle:createHash('sha256').update(source).digest('hex'),boardDanger:createHash('sha256').update(support).digest('hex')},
 formula:'H1 = -pending_safety * min(post_transition_pending,16)/8 * D(real_post_transition_board)',
 danger:'D = 1.5*holes + 0.2*coveredness + 1.5*max(height-10,0) + 5*max(height-15,0)',
 audits,selected,pressureTable,transactions,tank,
 conclusions:['Cancellation has zero explicit H2 weight but can improve H1 and avoid future tank geometry; not absent from modeled defense.',
 'H1 sees pending quantity after transaction, including inactive packets; urgency is only indirect through forecast transitions.',
 'Pressure saturates at 16; cancellation from 20 to 16 has zero fixed-board H1 relief.',
 'Tanking also reduces pending, but changes board; it is not authority cancellation and H2 excludes no-clear pending reduction.',
 'Overlap is conditional danger weighting, not evidence of uselessness. No weights or policy changed.'],
 limits:'Arithmetic reproduces stored Rust H1 witnesses within 0.001 due to f32 versus JS arithmetic. It is not a Rust evaluator replacement, root-ranking attribution, new search run or strength test.'};
await writeFile(`${dir}/H1_SEMANTIC_EVIDENCE.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({audits,selected,transactions,tank},null,2));
