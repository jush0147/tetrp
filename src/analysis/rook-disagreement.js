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
  normalReachable=false,expandedReachable=false}){
  if(!Array.isArray(rookRanked)||!rookRanked.length)
    throw Error('missing ROOK root candidates');
  const rookKey=actionSignature(rookChosen),kiwiKey=actionSignature(kiwiChosen);
  const candidateRank=rookRanked.findIndex(a=>actionSignature(a)===kiwiKey);
  const same=rookKey===kiwiKey;
  let category;
  if(same)category='agreement';
  else if(kiwiKey.startsWith('hold:'))
    category=candidateRank<0?'hold-not-ranked':'hold-ranked-not-selected';
  else if(rookKey.startsWith('hold:'))
    category=normalReachable?'rook-prefers-hold':'rook-hold-with-unseen-kiwi-place';
  else if(!normalReachable)
    category=expandedReachable?'root-bfs-budget-miss':'root-reachability-gap';
  else if(candidateRank<0)category='generated-but-not-ranked';
  else category='ranked-but-not-selected';
  return {category,same,candidateRank: candidateRank<0?null:candidateRank+1,
    normalReachable:Boolean(normalReachable),
    expandedReachable:Boolean(expandedReachable),
    rookKey,kiwiKey,rootCandidates:rookRanked.length};
}
