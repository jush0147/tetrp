// Diagnostic-only T stock option valuation. No change to chooseMove defaults.
// A verified Full TSD is a candidate, never automatic attack preference.
import {chooseMove,evaluateVerifiedPublicPlan} from './rook.js';
import {searchPublicForwardTsd} from './rook-forward-attack.js';

export function auditPublicTStock(visible,{
  depth=4,beamWidth=24,maxNodes=6000,
  planBeamWidth=16,maxProofCalls=85,maxPlacementEvaluations=2500,
  maxPlans=4,maxStates=950,maxSteps=70
}={}){
  if(!Number.isInteger(depth)||depth<2||depth>5)
    throw new RangeError('T stock comparison depth must be 2..5');
  const planner={minSetupPieces:depth-1,maxSetupPieces:depth-1,
    beamWidth:planBeamWidth,maxProofCalls,maxPlacementEvaluations,
    maxPlans,maxStates,maxSteps};
  const variants=[];
  const tInHold=visible.hold?.piece==='t';
  const canBank=visible.current?.type==='t'&&
    visible.hold?.piece==null&&visible.hold?.locked===false;
  if(canBank)variants.push({kind:'bank-current-t',
    options:{...planner,heldTFinish:true,storeCurrentT:true,
      heldTSetupPieces:depth-1}});
  if(tInHold)variants.push({kind:'spend-held-t',
    options:{...planner,heldTFinish:true,heldTSetupPieces:depth-1}});
  if([visible.current?.type,...(visible.next??[])].indexOf('t')===
    depth-1)variants.push({kind:'natural-next-t',options:planner});
  const reports=[];
  for(const variant of variants){
    const found=searchPublicForwardTsd(visible,variant.options);
    const candidates=found.plans.map(plan=>({
      ...evaluateVerifiedPublicPlan(visible,plan,{maxStates,maxSteps}),
      firstAction:plan.actions[0]?.action,
      terminalSent:plan.evidence.terminalSent,
      terminalGenerated:plan.evidence.terminalGenerated,
      terminalBtb:plan.evidence.terminalBtb,
      mode:variant.kind
    }));
    reports.push({kind:variant.kind,stats:found.stats,candidates});
  }
  // Use the identical horizon and value function; ordinary ROOK still has
  // approximate future reachability. The difference is a diagnostic only.
  const baseline=chooseMove(visible,{depth,beamWidth,maxNodes,
    maxStates,maxSteps,traceRootScores:true});
  const baselinePly=baseline.rootScores?.find(x=>
    JSON.stringify(x.action)===JSON.stringify({
      kind:baseline.kind,
      ...(baseline.kind==='place'?{move:baseline.move,execution:baseline.execution}:
        {mode:baseline.mode,samePiece:baseline.samePiece,
          requiresReanalysis:baseline.requiresReanalysis})
    }))?.leaf?.ply;
  const baselineComparable=baselinePly===depth&&
    !baseline.diagnostics.selectedUnresolvedGarbage;
  const valued=reports.flatMap(r=>r.candidates.filter(c=>c.comparable));
  valued.sort((a,b)=>b.score-a.score);
  const top=valued[0]??null;
  return {depth,baseline:{kind:baseline.kind,
    action:baseline.kind==='hold'?'hold':'place',
    score:baseline.diagnostics.value,effectiveDepth:baselinePly??null,
    comparable:baselineComparable,
    reason:baselineComparable?null:'baseline-horizon-or-unknown-garbage'},
    variants:reports,bestPlan:top?{
      mode:top.mode,score:top.score,firstAction:top.firstAction,
      // A higher score alone does NOT imply better real KO performance.
      deltaVsBaseline:baselineComparable?
        top.score-baseline.diagnostics.value:null,
      comparable:baselineComparable
    }:null,
    policyChanged:false,
    conclusion:'diagnostic only; require independent true-KO A/B before adoption'};
}
