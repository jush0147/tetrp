// Opt-in experimental public-only continuation. Does not assume that
// forecastHardDrops provided an actual executable witness in advance.
import {rookBoardKey,enumerateReachable} from './rook.js';
import * as B from '../board.js';
const cellKey=cells=>cells.map(([x,y])=>x+','+y).sort().join(';');
const pending=visible=>[...(visible.attack?.pending??[]),
  ...(visible.attack?.are??[])].reduce((n,p)=>n+p.amt,0);

export function publicPlanStillApplicable(visible,plan){
  return !!(visible?.playing&&visible.next?.length===5&&plan&&
    rookBoardKey(visible.board)===plan.preBoardKey&&
    visible.current?.type===plan.preCurrent&&
    (visible.hold?.piece??null)===plan.preHold&&
    pending(visible)===plan.prePending&&
    (visible.attack?.btb??0)===plan.preBtb&&
    (visible.attack?.combo??0)===plan.preCombo);
}

export function proveForecastPlacement(visible,plan,{maxStates=1200,maxSteps=42}={}){
  if(!visible?.playing||!plan||rookBoardKey(visible.board)!==plan.preBoardKey||
    visible.current?.type!==plan.piece)return null;
  const matches=enumerateReachable(visible.board,visible.current,visible.rules,
    {maxStates,maxSteps}).filter(move=>move.spin===plan.spin&&
      cellKey(B.cells(move.piece).map(([x,y])=>[x,Math.ceil(y)]))===cellKey(plan.cells));
  if(!matches.length)return null;
  const move=matches.reduce((a,b)=>a.path.length<=b.path.length?a:b);
  return {action:{kind:'place'},move:{piece:move.piece.type,x:move.piece.x,
      y:Math.ceil(move.piece.y),rotation:move.piece.r,useHold:false,
      cells:B.cells(move.piece).map(([x,y])=>[x,Math.ceil(y)])},
    execution:{moves:move.path,spin:move.spin}};
}

export function plannedHold(visible,plan){
  if(!publicPlanStillApplicable(visible,plan)||!plan.useHold||
    !visible.rules?.hold||visible.hold?.locked)return null;
  const empty=visible.hold.piece===null;
  const chosen=empty?visible.next[0]:visible.hold.piece;
  if(chosen!==plan.piece)return null;
  return {action:{kind:'hold',mode:empty?'empty':'occupied'}};
}
