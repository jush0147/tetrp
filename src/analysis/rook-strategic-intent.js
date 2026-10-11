// Opt-in EXPERIMENT ONLY. A public-only, bounded multi-lock strategic intent.
// This is NOT a learned score, a hardwired plan or a Kiwi imitation policy.
// A controlled A/B experiment must determine whether the persistence helps.
// State is caller-owned and updated once per ACTUAL locked piece, not on Hold.
const MODES=new Set(['balanced','attack','protect']);
export function publicStrategicSignals(visible){
  if(!visible?.board?.rows||!Number.isInteger(visible.piecesPlaced)||
    visible.piecesPlaced<0||visible.next?.length!==5||!visible.current||
    !visible.attack)throw Error('Strategic intent needs public CURRENT/NEXT5');
  const board=visible.board,rows=board.rows,H=rows.length;
  if(!H||!Number.isInteger(board.width)||board.width<=0||
    rows.some(row=>row.length!==board.width))
    throw Error('Invalid public board geometry');
  let maxHeight=0,holes=0,garbage=0;
  for(let x=0;x<board.width;x++){
    let covered=false;
    for(let y=0;y<H;y++){
      const c=rows[y][x];
      if(c!==null){
        if(!covered)maxHeight=Math.max(maxHeight,H-y);
        covered=true;
        if(c==='gb'||c==='gbd')garbage++;
      }else if(covered)holes++;
    }
  }
  const packets=[...(visible.attack.pending??[]),
    ...(visible.attack.are??[])];
  let pending=0;
  for(const p of packets){
    if(!Number.isFinite(p.amt)||p.amt<0)
      throw Error('Invalid public pending-garbage amount');
    pending+=p.amt;
  }
  return {pending,maxHeight,holes,garbage,
    btb:visible.attack.btb??0,placed:visible.piecesPlaced};
}
function desiredMode(s){
  if(s.pending>=3||s.maxHeight>=11||s.garbage>=3)
    return 'protect';
  if(s.pending<=1&&s.maxHeight<=8&&s.holes<=2)
    return 'attack';
  return 'balanced';
}
export function advanceStrategicIntent(visible,previous=null,{
  minCommitLocks=3,reactive=false
}={}){
  if(!Number.isInteger(minCommitLocks)||minCommitLocks<1||
    minCommitLocks>8)throw RangeError('Invalid strategy-commitment duration');
  const signals=publicStrategicSignals(visible);
  if(previous!==null&&(!MODES.has(previous.mode)||
    !Number.isInteger(previous.since)||previous.since>signals.placed||
    !Number.isInteger(previous.lastPiece)||previous.lastPiece>signals.placed))
    throw Error('Invalid or future-peeking intent state');
  if(previous?.lastPiece===signals.placed)
    return {state:previous,mode:previous.mode,signals,
      desired:desiredMode(signals),newLock:false,changed:false,retained:false,emergency:false,
      // Calling from a post-Hold reanalysis cannot consume another lock.
      searchOptions:optionsFor(previous.mode)};
  const desired=desiredMode(signals);
  const elapsed=previous?signals.placed-previous.since:Infinity;
  // Emergency is public, immediate and MUST overrule a previous intent,
  // even when its three-lock minimum commitment has not elapsed.
  const emergency=desired==='protect'&&
    (signals.pending>=5||signals.maxHeight>=14);
  const retained=Boolean(previous&&!reactive&&
    desired!==previous.mode&&elapsed<minCommitLocks&&!emergency);
  const mode=retained?previous.mode:desired;
  const changed=Boolean(previous&&mode!==previous.mode);
  const state={mode,since:changed||!previous?signals.placed:
    previous.since,lastPiece:signals.placed};
  return {state,mode,signals,desired,newLock:true,changed,retained,
    emergency:Boolean(emergency&&previous&&previous.mode!=='protect'),
    searchOptions:optionsFor(mode)};
}
function optionsFor(mode){
  // All three modes share identical rules, depth/beam and node budget.
  // Attack changes ONLY the already-supported reward on GENERATED REAL
  // projected sent combat; protect uses the existing optional factual
  // garbage-recovery evaluation, never speculative holes.
  return mode==='attack'?{offenseWeight:7.2,garbageRecovery:false}:
    mode==='protect'?{offenseWeight:4.8,garbageRecovery:true,
      garbageRecoveryWeight:1}:
      {offenseWeight:4.8,garbageRecovery:false};
}
