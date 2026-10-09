// Root-action disagreement is about a SINGLE shared player-visible state.
// The Kiwi move is independently certified by Tetrp before reaching here.
// "Seen" is not a claim that the speculative ROOK valuation is correct.
export function actionSignature(action){
  const a=action?.action??action;
  if(a?.kind==='hold')return 'hold:'+a.mode+':'+Boolean(a.samePiece);
  if(a?.kind!=='place'||!action.move||!action.execution||
     !Array.isArray(action.move.cells))throw Error('invalid comparable public action');
  const cells=action.move.cells.map(([x,y])=>x+','+Math.ceil(y)).sort().join(';');
  return 'place:'+action.move.piece+':'+cells+':'+action.execution.spin;
}

export function classifyRootDisagreement({rookChosen,rookRanked,kiwiChosen,
  normalReachable=false,expandedReachable=false,rootSurvival=null}){
  if(!Array.isArray(rookRanked)||!rookRanked.length)
    throw Error('missing ROOK root candidates');
  const rookKey=actionSignature(rookChosen),kiwiKey=actionSignature(kiwiChosen);
  const candidateRank=rookRanked.findIndex(a=>actionSignature(a)===kiwiKey);
  const same=rookKey===kiwiKey;
  // Unlike ranked[] (which also contains candidates evaluated only at root),
  // beam survival tells whether that root received actual deeper analysis.
  const survived=Array.isArray(rootSurvival)?rootSurvival.map(({roots})=>
    roots.some(key=>actionSignature(JSON.parse(key))===kiwiKey)):null;
  const firstSurvived=survived?.[0]??null;
  const lastSurvived=survived?.at(-1)??null;
  const maxSurvivedPly=survived?.reduce((max,yes,i)=>
    yes?i+1:max,0)??null;
  let category;
  if(same)category='agreement';
  else if(kiwiKey.startsWith('hold:')){
    if(candidateRank<0)category='hold-not-ranked';
    else if(firstSurvived===false)category='hold-root-beam-pruned';
    else if(lastSurvived===false)category='hold-future-beam-pruned';
    else category='hold-ranked-not-selected';
  }else if(!normalReachable)
    category=expandedReachable?'root-bfs-budget-miss':'root-reachability-gap';
  else if(candidateRank<0)category='generated-but-not-ranked';
  else if(firstSurvived===false)category='root-beam-pruned';
  else if(lastSurvived===false)category='future-beam-pruned';
  else if(rookKey.startsWith('hold:'))category='rook-prefers-hold';
  else category='ranked-but-not-selected';
  return {category,same,candidateRank:candidateRank<0?null:candidateRank+1,
    normalReachable:Boolean(normalReachable),
    expandedReachable:Boolean(expandedReachable),
    firstSurvived,lastSurvived,maxSurvivedPly,
    rookKey,kiwiKey,rootCandidates:rookRanked.length};
}
