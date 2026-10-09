// Optional downstack/survival value, built exclusively from the visible board.
// NOT an attack bonus, KO forecast, or claim that garbage will be cleared.
// The canonical Tetrp engine owns line clearing, B2B, Surge and actual KO.
export function recoveryBoardPenalty(features,{pending=0,weight=1}={}){
  if(weight<=0)return 0;
  const riskHeight=Math.max(0,features.max-10);
  const pressure=1+Math.min(1.25,Math.max(0,pending)/12);
  // Penalize dangerously tall buried garbage instead of rewarding attack
  // while already near the ceiling. Low, clean attacking stacks keep their
  // normal ROOK evaluation; this is used only under observed pressure.
  return weight*pressure*(
    .72*riskHeight*riskHeight +
    .34*features.garbage +
    .58*features.holes +
    .018*features.covered);
}

export function clearedGarbageReward(rows,{maxHeight=0,pending=0,weight=1}={}){
  if(weight<=0||rows<=0)return 0;
  const urgency=1+Math.min(1.5,Math.max(0,maxHeight-9)/12)+
    Math.min(.75,Math.max(0,pending)/18);
  // Award only ACTUALLY cleared garbage rows returned by board.fullLines
  // after a legal piece commit. This can compete with B2B continuation
  // when safely downstacking is necessary.
  return rows*4.5*weight*urgency;
}
