// Controlled one-lock constructive opportunity audit: compare the SAME
// SRS+ legal placements and TSD scaffold geometry on Kiwi/ROOK-made boards.
// This DOES NOT claim a scaffold is a guaranteed executable future attack.
import {readFileSync,writeFileSync} from 'node:fs';
import * as B from '../src/board.js';
import {chooseMove,enumerateReachable} from '../src/analysis/rook.js';
import {tsdScaffolds,tsdScaffoldPotential} from '../src/analysis/rook-tsd.js';

const all=readFileSync(process.env.ROOK_ALL_PUBLIC_TRACE??
  'rook-all-public-locks.jsonl','utf8').trim().split('\n')
  .filter(Boolean).map(JSON.parse);
const key=cells=>cells.map(([x,y])=>x+','+Math.ceil(y)).sort().join(';');
const rows=[];
for(const x of all){
  const v=x.visible;
  if(v?.next?.length!==5||!v.current||!v.board||
    'bag' in v||'rng' in v||'holes' in v||'opponent' in v)
    throw Error('Current board is not a legal public snapshot');
  const frozen=JSON.stringify(v);
  const before=tsdScaffoldPotential(v.board,v.rules);
  const selection=chooseMove(v,{depth:4,beamWidth:24,maxNodes:6000,
    maxStates:1200,maxSteps:42});
  const moves=enumerateReachable(v.board,v.current,v.rules,
    {maxStates:1200,maxSteps:42});
  let max=0,maxFull=0,maxImprovement=0,chosen=null;
  for(const move of moves){
    const board={...v.board,rows:v.board.rows.map(row=>row.slice())};
    if(!B.legal(board,move.piece))continue;
    B.commit(board,move.piece);
    B.removeLines(board,B.fullLines(board));
    const potential=tsdScaffoldPotential(board,v.rules);
    const full=tsdScaffolds(board,v.rules,{maxMissing:0})
      .some(slot=>slot.fullSpinGeometry);
    max=Math.max(max,potential);
    maxImprovement=Math.max(maxImprovement,potential-before);
    maxFull=Math.max(maxFull,Number(full));
    if(selection.kind==='place'&&
      move.spin===selection.execution?.spin&&
      key(B.cells(move.piece))===key(selection.move.cells))
      chosen={potential,full};
  }
  if(selection.kind==='place'&&!chosen)
    throw Error('Chosen root absent from the same bounded SRS+ set');
  if(JSON.stringify(v)!==frozen)throw Error('Observed view mutated');
  rows.push({seed:x.seed,turn:x.turn,owner:x.kind,before,
    kind:selection.kind,reachable:moves.length,
    potentialMaxFromOneLegalPlace:max,
    canImprovePotential:maxImprovement>0,
    canMakeFullGeometry:maxFull>0,
    selectedPotential:chosen?.potential??null,
    selectedFullGeometry:chosen?.full??null,
    missedHigherPotential:!!chosen&&chosen.potential<max,
    hadLowPotential:before<=1,
    couldImproveLow:before<=1&&max>before});
}
const groups=['rook','kiwi'].map(owner=>{
  const d=rows.filter(x=>x.owner===owner);
  const eligible=d.filter(x=>x.kind==='place');
  return {owner,states:d.length,
    lowOpportunityStart:d.filter(x=>x.hadLowPotential).length,
    hasPositiveConstructiveMove:d.filter(x=>x.canImprovePotential).length,
    canBuildFullGeometryInOneMove:d.filter(x=>x.canMakeFullGeometry).length,
    lowToBetterInOneMove:d.filter(x=>x.couldImproveLow).length,
    placeChosen:eligible.length,
    choseBelowMaxGeometricScaffold:eligible.filter(x=>
      x.missedHigherPotential).length,
    selectedMakesFullGeometry:eligible.filter(x=>
      x.selectedFullGeometry).length,
    averageRootLegalMoves:Number((d.reduce((s,x)=>s+x.reachable,0)/d.length).toFixed(1))};
});
const report={format:'rook-tsd-one-lock-construction-audit/1',
  observations:rows.length,
  independentSeeds:new Set(rows.map(x=>x.seed)).size,
  groups,rows,
  warning:'Geometric TSD scaffold potential frequently produces false positives and is NOT guaranteed sent attack. This measures one current-piece legal lock only, not future Hold, garbage or multi-ply construction. ROOK chosen action is examined on both policy-made public boards, not a counterfactual Kiwi policy.'};
if(process.env.ROOK_ONE_LOCK_TSD_OUTPUT)writeFileSync(process.env.ROOK_ONE_LOCK_TSD_OUTPUT,
  JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined}));
