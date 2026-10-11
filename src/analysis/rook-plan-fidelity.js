// Research-only, public-state-only check of a forecast ROOK next piece.
// ROOK's beam forecast is a PROPOSAL, never a proven 2/3/4-lock authority
// route. Recheck at the actual next CURRENT after opponent packet delivery.
// This diagnoses missing plan fidelity without modifying the chosen move.
import {rookBoardKey} from './rook.js';
import {publicPlanStillApplicable,proveForecastPlacement,
  plannedHold} from './rook-plan.js';

const pending=visible=>[...(visible.attack?.pending??[]),
  ...(visible.attack?.are??[])].reduce((n,p)=>n+(p.amt??0),0);
export function comparePublicForecastPrerequisites(visible,step){
  if(!visible?.playing||visible.next?.length!==5||
    !visible.current||!step)throw Error('Expected actual public NEXT5 and forecast');
  const matched={
    board:rookBoardKey(visible.board)===step.preBoardKey,
    current:visible.current.type===step.preCurrent,
    hold:(visible.hold?.piece??null)===step.preHold,
    pending:pending(visible)===step.prePending,
    btb:(visible.attack?.btb??0)===step.preBtb,
    combo:(visible.attack?.combo??0)===step.preCombo};
  return {matched,all:Object.values(matched).every(Boolean),
    // A public state can match for six geometric/combat fields and still
    // differ by packet timing. In that case no speculative guarantee.
    publicPending:pending(visible)};
}
export function auditPublicNextForecast(visible,step,{
  maxStates=1200,maxSteps=42,verifyReachability=true
}={}){
  const check=comparePublicForecastPrerequisites(visible,step);
  if(!check.all||!publicPlanStillApplicable(visible,step))
    return {status:'public-precondition-changed',
      ...check,reachable:null,verifiedPlacement:false};
  if(step.useHold){
    const request=plannedHold(visible,step);
    return {status:request?'hold-publicly-permitted':'hold-not-permitted',
      ...check,reachable:!!request,verifiedPlacement:false,
      holdRequiresFreshPostHoldReachability:true};
  }
  if(!verifyReachability)
    return {status:'public-precondition-matched-unproven',
      ...check,reachable:null,verifiedPlacement:false};
  const proof=proveForecastPlacement(visible,step,{maxStates,maxSteps});
  return {status:proof?'placement-srs-proven':'placement-no-srs-proof',
    ...check,reachable:!!proof,verifiedPlacement:!!proof,
    // Different SRS+ paths to same cells/spin can be equivalent.
    provenKind:proof?.action?.kind??null};
}


// This is a comparison of two actual public/legal action choices, NOT a
// projected reward score. Canonical cells ignore equivalent SRS+ path strings.
export function sameForecastAsFreshRookChoice(forecast,{
  placement,executionSpin,holdCount
}={}){
  if(!forecast||!placement)return false;
  const cells=c=>Array.isArray(c)?c.map(([x,y])=>x+','+y)
    .sort().join(';'):null;
  return Boolean(forecast.useHold)===(holdCount>0)&&
    forecast.piece===placement.piece&&
    forecast.spin===executionSpin&&
    cells(forecast.cells)!==null&&
    cells(forecast.cells)===cells(placement.cells);
}
