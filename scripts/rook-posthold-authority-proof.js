// Strictly OFFLINE authority-only proof; never import into chooser/bot.
// Verify a planned next-piece Hold+Place as one real next LOCK.
// A restored authority engine may contain private bag RNG but the only
// output is proof of actual SRS+ landing of a known PUBLIC next/held piece.
// No unseen NEXT6, opponent queue, garbage hole or RNG enters ROOK/Kiwi.
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {plannedHold,proveForecastPlacement} from '../src/analysis/rook-plan.js';

export function verifyAuthorityOnlyPostHoldLanding(engine,publicBefore,step,{
  maxStates=1200,maxSteps=42
}={}){
  const request=plannedHold(publicBefore,step);
  if(!request)return {holdAuthorityAccepted:false,
    sameProjectedPiece:null,placementSrsProven:false,
    reason:'public-hold-plan-not-applicable'};
  const clone=new BotDemo(Engine.restore(engine.serialize()),
    {placementMode:'atomic'});
  const before=clone.view();
  if(JSON.stringify(before.visible)!==JSON.stringify(publicBefore))
    throw Error('OFFLINE_HOLD_AUDIT_CLONE_DIFFERS_FROM_REAL_VISIBLE_STATE');
  try{
    clone.prepare(request,before.revision);
    clone.commit(before.revision);
  }catch(e){
    return {holdAuthorityAccepted:false,sameProjectedPiece:null,
      placementSrsProven:false,
      reason:'authority-rejected-hold'};
  }
  const after=clone.view().visible;
  // The piece used in placement proof is either old Hold or the
  // previously-public next[0] for an empty Hold. Do NOT use after.next
  // (the newly revealed NEXT6) for candidate selection or evaluation.
  const expected=publicBefore.hold.piece??publicBefore.next[0];
  if(expected!==step.piece)
    throw Error('FORECAST_POST_HOLD_PIECE_NOT_PREVIOUSLY_PUBLIC');
  if(after.current.type!==expected)
    throw Error('AUTHORITY_POST_HOLD_DID_NOT_SPAWN_KNOWN_PIECE');
  const proof=proveForecastPlacement({
    playing:after.playing,board:after.board,
    current:after.current,rules:after.rules
  },step,{maxStates,maxSteps});
  return {holdAuthorityAccepted:true,sameProjectedPiece:true,
    placementSrsProven:!!proof,
    reason:proof?'authority-hold-plus-srs-proven':
      'hold-authority-accepted-but-placement-not-srs-proven',
    // No private snapshot, newly revealed NEXT5 or bag contents returned.
    authorityFutureExposed:false};
}
