// Compare both policies on ONE actual Tetrp player's public observation.
// No board checkpoint, hidden bag, future opponent action or hidden garbage
// column is forwarded to either bot. Diagnostic generation is separate from
// real match advancement and cannot change the authority.
import * as B from '../src/board.js';
import {chooseMove,enumerateReachable} from '../src/analysis/rook.js';
import {prepareKiwi,normalizeRankedRecommendation} from '../src/analysis/kiwi.js';
import {actionSignature,classifyRootDisagreement} from '../src/analysis/rook-disagreement.js';

const toComparable=move=>({kind:'place',move:{
  piece:move.piece.type,cells:B.cells(move.piece)},
  execution:{spin:move.spin}});

function height(board){
  let max=0;
  for(let y=0;y<board.rows.length;y++)
    if(board.rows[y].some(v=>v!==null))max=Math.max(max,board.rows.length-y);
  return max;
}

export function diagnosePublicChoice(visible,{
  rookOptions,kiwiBudget,analyzeSnapshot,seed,turn,owner
}){
  if(typeof analyzeSnapshot!=='function'||!rookOptions)
    throw Error('Missing independent bot analyzers');
  const source=JSON.stringify(visible);
  const startRook=performance.now();
  const rook=chooseMove(visible,{...rookOptions,includeRanked:true,
    traceRootSurvival:true,traceRootScores:true});
  const rookMs=performance.now()-startRook;
  const prepared=prepareKiwi(visible);
  prepared.request.node_budget=kiwiBudget;
  const startKiwi=performance.now();
  const kiwiReport=JSON.parse(analyzeSnapshot(JSON.stringify(prepared.request)));
  const kiwiMs=performance.now()-startKiwi;
  const kiwi=normalizeRankedRecommendation(visible,prepared,kiwiReport);
  if(JSON.stringify(visible)!==source)
    throw Error('Diagnostic bot mutated player-visible snapshot');

  const expectedKey=actionSignature(kiwi);
  let normalReachable=false,expandedReachable=false;
  let normalCount=null,expandedCount=null;
  if(kiwi.action.kind==='place'){
    const check=(maxStates,maxSteps)=>{
      const choices=enumerateReachable(visible.board,visible.current,visible.rules,
        {maxStates,maxSteps});
      return {count:choices.length,present:choices.some(m=>
        actionSignature(toComparable(m))===expectedKey)};
    };
    const ordinary=check(rookOptions.maxStates,rookOptions.maxSteps);
    normalReachable=ordinary.present;normalCount=ordinary.count;
    if(!normalReachable){
      const expanded=check(Math.max(rookOptions.maxStates*4,4800),
        Math.max(rookOptions.maxSteps,64));
      expandedReachable=expanded.present;expandedCount=expanded.count;
    }
  }
  const comparison=classifyRootDisagreement({
    rookChosen:rook.ranked[0],rookRanked:rook.ranked,kiwiChosen:kiwi,
    normalReachable,expandedReachable,rootSurvival:rook.rootSurvival});
  const chosenRoot=rook.rootScores.find(r=>
    actionSignature(r.action)===comparison.rookKey)??null;
  const kiwiRoot=rook.rootScores.find(r=>
    actionSignature(r.action)===comparison.kiwiKey)??null;
  const compact=root=>root?{
    score:root.leaf.total,rootScore:root.rootScore,
    first:root.first,depth:root.leaf.ply,
    rewards:root.leaf.cumulativeReward,
    boardValue:root.leaf.board.boardValue,
    discountedBoard:root.leaf.discountedBoardValue,
    features:root.leaf.board.features,
    terms:root.leaf.board.terms,
    boardError:root.leaf.board.reconstructionError,
    valueError:root.leaf.valueReconstructionError}:null;
  const rootComparison={chosen:compact(chosenRoot),
    kiwi:compact(kiwiRoot),
    scoreGap:chosenRoot&&kiwiRoot?
      chosenRoot.leaf.total-kiwiRoot.leaf.total:null,
    kiwiRootInFinalBeam:Boolean(kiwiRoot)};
  const pending=[...(visible.attack?.are??[]),...(visible.attack?.pending??[])]
    .reduce((n,p)=>n+p.amt,0);
  return {format:'rook-kiwi-public-choice-diff/1',seed,turn,owner,frame:visible.frame,
    height:height(visible.board),pending,hold:visible.hold?.piece??null,
    piecesPlaced:visible.piecesPlaced,
    rook:{key:comparison.rookKey,nodes:rook.diagnostics.evaluated,
      score:rook.diagnostics.value,ms:Math.round(rookMs),
      depth:rook.diagnostics.effectiveDepth,ranked:comparison.rootCandidates,
      normalReachableCount:normalCount,expandedReachableCount:expandedCount},
    kiwi:{key:comparison.kiwiKey,nodes:kiwiReport.nodes,
      ms:Math.round(kiwiMs),candidateIndex:kiwi.candidateIndex,
      reportedCandidates:kiwiReport.candidates?.length??0},
    classification:comparison.category,candidateRank:comparison.candidateRank,
    firstSurvived:comparison.firstSurvived,
    lastSurvived:comparison.lastSurvived,
    maxSurvivedPly:comparison.maxSurvivedPly,
    normalReachable:comparison.normalReachable,
    expandedReachable:comparison.expandedReachable,
    rootComparison};
}
