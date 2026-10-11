// P0 research: can ROOK actually produce immediate attack at a published
// player-visible position, or must it construct an offensive shape first?
// Bounded genuine SRS+ root reachability. No hidden opponent/bag/RNG read.
// This is a tactical-opportunity audit, NOT a KO or causal strength benchmark.
import {readFileSync,writeFileSync} from 'node:fs';
import * as B from '../src/board.js';
import {enumerateReachable,chooseMove} from '../src/analysis/rook.js';
import {visibleCombat,advanceCombatClock,projectCombat} from '../src/analysis/rook-combat.js';

const records=readFileSync(process.env.ROOK_PUBLIC_SNAPSHOTS??
  'rook-public-observations.jsonl','utf8').trim().split('\n').map(JSON.parse);
if(records.length!==22)throw Error('Wrong pinned public cohort');
const spawn=(type,board)=>({
  type,x:Math.ceil(board.width/2)-1,y:board.buffer-2.04,hy:board.buffer-2,
  r:0,kick:0,rotated:false,spin:'none',wall:false,sleeping:false,locking:0,
  resets:0,rotationResets:0,totalRotations:0,safelock:0,keys:0,
  softDropped:false,forceLock:false
});
const cellsKey=cells=>cells.map(([x,y])=>x+','+Math.ceil(y)).sort().join(';');
const rows=[];
for(const record of records){
  const v=record.visible;
  if(v.next?.length!==5||'bag' in v||'holes' in v||'rng' in v)
    throw Error('Private information leaked into public position');
  const original=JSON.stringify(v),options=[{piece:v.current,hold:false}];
  if(v.rules.hold&&!v.hold.locked){
    const type=v.hold.piece??v.next[0];
    if(type)options.push({piece:spawn(type,v.board),hold:true});
  }
  const attackAtLock=advanceCombatClock(visibleCombat(v),v.frame,24,v.rules);
  const moves=[];
  for(const o of options){
    const reached=enumerateReachable(v.board,o.piece,v.rules,
      {maxStates:1200,maxSteps:42});
    for(const m of reached){
      const board={...v.board,rows:v.board.rows.map(row=>row.slice())};
      if(!B.legal(board,m.piece))continue;
      B.commit(board,m.piece);
      const clear=B.fullLines(board);
      const garbageRows=clear.filter(y=>board.rows[y].includes('gb')).length;
      B.removeLines(board,clear);
      const allClear=clear.length>0&&B.emptyWithPerma(board);
      const attack=projectCombat(attackAtLock,{
        lines:clear.length,spin:m.spin,allClear,garbageRows},v.rules);
      moves.push({hold:o.hold,type:m.piece.type,spin:m.spin,
        cells:cellsKey(B.cells(m.piece)),lines:clear.length,
        sent:attack.offensive,generated:attack.generated});
    }
  }
  const choice=chooseMove(v,{depth:4,beamWidth:24,maxNodes:6000,
    maxStates:1200,maxSteps:42});
  const root=choice.kind==='place'?moves.find(m=>!m.hold&&
    m.type===choice.move.piece&&m.spin===choice.execution.spin&&
    m.cells===cellsKey(choice.move.cells)):null;
  if(choice.kind==='place'&&!root)
    throw Error('ROOK first placement missing reachable SRS witness');
  if(JSON.stringify(v)!==original)throw Error('Input public snapshot mutated');
  const maxSent=Math.max(0,...moves.map(x=>x.sent));
  rows.push({seed:record.seed,turn:record.turn,owner:record.owner,
    pending:[...(v.attack?.are??[]),...(v.attack?.pending??[])]
      .reduce((n,p)=>n+(p.amt??0),0),
    rootKind:choice.kind,chosenImmediateSent:root?.sent??null,
    maxImmediateSent:maxSent,
    maxWithoutHold:Math.max(0,...moves.filter(x=>!x.hold).map(x=>x.sent)),
    maxWithHold:Math.max(0,...moves.filter(x=>x.hold).map(x=>x.sent)),
    attackingMoves:moves.filter(x=>x.sent>0).length,
    reachableMoves:moves.length,
    skippedAvailableAttack:!!root&&root.sent<maxSent});
}
const count=fn=>rows.filter(fn).length;
const report={format:'rook-real-public-immediate-attack-gap/1',
  publicPositions:rows.length,independentSeeds:new Set(rows.map(r=>r.seed)).size,
  hasImmediateAttack:count(r=>r.maxImmediateSent>0),
  placeChosen:count(r=>r.rootKind==='place'),
  holdChosen:count(r=>r.rootKind==='hold'),
  directPlaceBelowMax:count(r=>r.skippedAvailableAttack),
  rows,disclaimer:'22 overlapping observations from only two match seeds. A Hold action is re-analysed; its actual subsequent attack choice is not inferred here. Immediate attack availability is not a KO or strength result.'};
if(process.env.ROOK_ATTACK_AUDIT_OUTPUT)writeFileSync(process.env.ROOK_ATTACK_AUDIT_OUTPUT,
  JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined}));
