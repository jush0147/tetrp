// Diagnostic-only T stock option valuation. No change to chooseMove defaults.
// A verified Full TSD is a candidate, never automatic attack preference.
import {chooseMove,evaluateVerifiedPublicPlan} from './rook.js';
import {searchPublicForwardTsd} from './rook-forward-attack.js';

export function auditPublicTStock(visible,{
  depth=4,beamWidth=24,maxNodes=6000,
  planBeamWidth=16,maxProofCalls=85,maxPlacementEvaluations=2500,
  maxPlans=4,maxStates=1200,maxSteps=42,
  planMaxStates=950,planMaxSteps=70
}={}){
  if(!Number.isInteger(depth)||depth<2||depth>5)
    throw new RangeError('T stock comparison depth must be 2..5');
  const planner={minSetupPieces:depth-1,maxSetupPieces:depth-1,
    beamWidth:planBeamWidth,maxProofCalls,maxPlacementEvaluations,
    maxPlans,maxStates:planMaxStates,maxSteps:planMaxSteps};
  const variants=[];
  const tInHold=visible.hold?.piece==='t';
  const tIndex=[visible.current?.type,...(visible.next??[])].indexOf('t');
  const emptyHold=visible.hold?.piece==null&&
    visible.hold?.locked===false&&visible.rules?.hold===true;
  const canBank=emptyHold&&tIndex===0;
  if(canBank)variants.push({kind:'bank-current-t',
    options:{...planner,heldTFinish:true,storeCurrentT:true,
      heldTSetupPieces:depth-1}});
  if(emptyHold&&tIndex>0&&tIndex<depth-1)
    variants.push({kind:'bank-upcoming-t',
      options:{...planner,heldTFinish:true,storeUpcomingT:true,
        heldTSetupPieces:depth-1}});
  if(tInHold)variants.push({kind:'spend-held-t',
    options:{...planner,heldTFinish:true,heldTSetupPieces:depth-1}});
  if([visible.current?.type,...(visible.next??[])].indexOf('t')===
    depth-1)variants.push({kind:'natural-next-t',options:planner});
  const reports=[];
  for(const variant of variants){
    const found=searchPublicForwardTsd(visible,variant.options);
    const candidates=found.plans.map(plan=>({
      ...evaluateVerifiedPublicPlan(visible,plan,{
        maxStates:planMaxStates,maxSteps:planMaxSteps}),
      firstAction:plan.actions[0]?.action,
      firstRequest:plan.actions[0],
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
    maxStates,maxSteps,traceRootScores:true,includeRanked:true});
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
    variants:reports,baselineDecision:baseline,bestPlan:top?{
      mode:top.mode,score:top.score,firstAction:top.firstAction,
      firstRequest:top.firstRequest,
      // A higher score alone does NOT imply better real KO performance.
      deltaVsBaseline:baselineComparable?
        top.score-baseline.diagnostics.value:null,
      comparable:baselineComparable
    }:null,
    policyChanged:false,
    conclusion:'diagnostic only; require independent true-KO A/B before adoption'};
}

/**
 * Experimental policy ONLY. Retains the standard ROOK decision unless a
 * genuinely SRS-proven public attack plan beats the ordinary ROOK score on
 * the same completed horizon by the configured margin. Fresh decisions are
 * made after each actual lock: no forced future TSD or invisible commitment.
 * Scores do not imply a KO gain. Benchmark total CPU separately.
 */
export function chooseMoveWithPublicTStock(visible,{
  minValueMargin=1,...options
}={}){
  if(!Number.isFinite(minValueMargin)||minValueMargin<0||
    minValueMargin>100000)throw new RangeError('Invalid T stock margin');
  const audit=auditPublicTStock(visible,options);
  const baseline=audit.baselineDecision;
  const candidate=audit.bestPlan;
  const eligible=!!candidate&&candidate.comparable&&
    candidate.deltaVsBaseline>minValueMargin;
  const first=candidate?.firstRequest;
  const choice=eligible&&first?.action?.kind==='place'
    ?{kind:'place',move:first.move,execution:first.execution}
    :eligible&&first?.action?.kind==='hold'
      ?{...first.action,requiresReanalysis:true}
      :null;
  const defaultChoice={kind:baseline.kind,
    ...(baseline.kind==='place'?
      {move:baseline.move,execution:baseline.execution}:
      {mode:baseline.mode,samePiece:baseline.samePiece,
        requiresReanalysis:baseline.requiresReanalysis})};
  const different=choice&&JSON.stringify(choice)!==
    JSON.stringify(defaultChoice);
  const chosen=different?choice:defaultChoice;
  const totalOffers=audit.variants.reduce((n,r)=>n+r.candidates.length,0);
  const validOffers=audit.variants.reduce((n,r)=>n+
    r.candidates.filter(c=>c.comparable).length,0);
  const diagnostics={...baseline.diagnostics,tStock:{
    eligibleModes:audit.variants.length,
    inspected:totalOffers,verified:validOffers,
    proofCalls:audit.variants.reduce((n,r)=>n+(r.stats.proofCalls??0),0),
    placements:audit.variants.reduce((n,r)=>n+(r.stats.placements??0),0),
    truncatedModes:audit.variants.filter(r=>r.stats.truncated).length,
    garbageAborts:audit.variants.reduce((n,r)=>n+(r.stats.garbageAborts??0),0),
    modes:audit.variants.map(r=>r.kind),selected:!!different,
    valueDelta:candidate?.deltaVsBaseline??null,
    baselineComparable:audit.baseline.comparable,
    selectedMode:different?candidate.mode:null
  }};
  const ranked=different?[chosen,...(baseline.ranked??[]).filter(x=>
    JSON.stringify(x)!==JSON.stringify(chosen))]:
    (baseline.ranked??[defaultChoice]);
  return {...chosen,diagnostics,ranked};
}
