// Risk-aware expectation over ONLY player-visible, conditional garbage holes.
// This is a belief evaluation, not a prediction of the actual hidden column.
import {enumeratePublicTankOutcomes} from './rook-garbage.js';

export function evaluatePublicTankBelief(board,combat,rules,{
  maxOutcomes=10,riskWeight=0.2,score
}={}){
  if(typeof score!=='function'||!Number.isFinite(riskWeight)||
    riskWeight<0||riskWeight>1)throw new TypeError('invalid public belief evaluator');
  const outcomes=enumeratePublicTankOutcomes(board,combat,rules,{maxOutcomes});
  let expected=0,worst=Infinity,probability=0,topoutProbability=0;
  for(const outcome of outcomes){
    const value=outcome.topout?-100000:score(outcome);
    if(!Number.isFinite(value))throw new TypeError('non-finite belief value');
    expected+=outcome.weight*value;
    worst=Math.min(worst,value);
    probability+=outcome.weight;
    if(outcome.topout)topoutProbability+=outcome.weight;
  }
  return {value:(1-riskWeight)*expected+riskWeight*worst,
    expected,worst,riskWeight,topoutProbability,
    outcomes:outcomes.length,weightSum:probability};
}
