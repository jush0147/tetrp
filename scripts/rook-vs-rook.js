// Real synchronous Tetrp TL ROOK vs ROOK using player-visible NEXT5.
// The opener is OFF by default in the main bot. This is an experiment only.
import {writeFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {chooseMove} from '../src/analysis/rook.js';
import {chooseMoveWithPublicTStock} from '../src/analysis/rook-t-stock.js';
import {publicPlanStillApplicable,proveForecastPlacement,plannedHold} from '../src/analysis/rook-plan.js';
import {DEFAULT_KO_LOCK_CAP,parseMatchSeeds,assertMatchingOpening,assertSimultaneousPair,scoreKO} from './rook-ko-protocol.js';

const limit=Number(process.env.MAX_LOCKS??DEFAULT_KO_LOCK_CAP);
// Explicit single-seed benchmark mode avoids mirrored computational duplicates.
// Legacy multi-role test workflows continue to default to mirrored mode until
// migrated. A mirror should only be used as a symmetry regression.
const swapRoles=process.env.SWAP_ROLES??'1';
if(!['0','1'].includes(swapRoles))throw Error('Invalid SWAP_ROLES (expected 0 or 1)');
// Legacy ROOK_NODES still means both sides use the same evaluation budget.
const budget=Number(process.env.ROOK_NODES??6000);
const candidateBudget=Number(process.env.ROOK_CANDIDATE_NODES??budget);
const baselineBudget=Number(process.env.ROOK_BASELINE_NODES??budget);
const budgetScaling=process.env.BUDGET_SCALING==='1';
const candidateDepth=Number(process.env.ROOK_CANDIDATE_DEPTH??4);
const baselineDepth=Number(process.env.ROOK_BASELINE_DEPTH??4);
const candidateBeamWidth=Number(process.env.ROOK_CANDIDATE_BEAM??24);
const baselineBeamWidth=Number(process.env.ROOK_BASELINE_BEAM??24);
// SEED_A / SEED_B now designate two independent, matched-seed trials.
const seeds=parseMatchSeeds();
const openTiles=Number(process.env.OPEN_TILE_NODES??1200);
const expertOpen=process.env.EXPERT_OPEN!=='0';
const expertRecovery=process.env.EXPERT_RECOVERY==='1';
const expertBelief=process.env.EXPERT_BELIEF==='1';
const expertFuture=process.env.EXPERT_FUTURE==='1';
const expertBeam=process.env.EXPERT_BEAM==='1';
const expertOffense=process.env.EXPERT_OFFENSE==='1';
const expertHoldPlan=process.env.EXPERT_HOLD_PLAN==='1';
const expertPruning=process.env.EXPERT_PRUNING==='1';
const expertSticky=process.env.EXPERT_STICKY==='1';
const expertExactLeaf=process.env.EXPERT_EXACT_LEAF==='1';
const expertTStock=process.env.EXPERT_T_STOCK==='1';
const expertFrontier=process.env.EXPERT_FRONTIER==='1';
const frontierShadow=process.env.FRONTIER_SHADOW==='1';
const frontierRiskGuard=process.env.FRONTIER_RISK_GUARD==='1';
const frontierGuardShadow=process.env.FRONTIER_GUARD_SHADOW==='1';
// Causal comparator: guarded vs UNGUARDED frontier, rather than vs ROOK.
const compareUnguardedFrontier=process.env.COMPARE_UNGUARDED_FRONTIER==='1';
const frontierSlots=Number(process.env.FRONTIER_SLOTS??3);
const frontierGap=Number(process.env.FRONTIER_SCORE_GAP??70);
const tStockMargin=Number(process.env.T_STOCK_MARGIN??1);
const leafExtensionBudget=Number(process.env.LEAF_EXTENSION_BUDGET??5000);
const leafExtensionStates=Number(process.env.LEAF_EXTENSION_STATES??800);
const intermediateHoleRelief=Number(process.env.EXPERT_PRUNING_HOLE_RELIEF??0.65);
const auditHoldPlan=process.env.HOLD_AUDIT==='1';
const offenseWeight=Number(process.env.EXPERT_OFFENSE_WEIGHT??7.2);
const beamRootReserve=Number(process.env.EXPERT_BEAM_ROOT_RESERVE??8);
const futureProbes=Number(process.env.EXPERT_FUTURE_PROBES??24);
// Comparator-only search settings. The production/default policy is unchanged.
const baselineFutureProbes=Number(process.env.ROOK_BASELINE_FUTURE_PROBES??9);
const baselineFutureStates=Number(process.env.ROOK_BASELINE_FUTURE_STATES??800);
const candidateFutureProbes=Number(process.env.ROOK_CANDIDATE_FUTURE_PROBES??9);
const candidateFutureStates=Number(process.env.ROOK_CANDIDATE_FUTURE_STATES??800);
const futureStates=Number(process.env.EXPERT_FUTURE_STATES??800);
const beliefProbes=Number(process.env.BELIEF_PROBES??3);
const beliefMaxOutcomes=Number(process.env.BELIEF_MAX_OUTCOMES??10);
const recoveryWeight=Number(process.env.RECOVERY_WEIGHT??1);
const expertLabel=[expertOpen?'opener':null,expertRecovery?'recovery':null,
  expertBelief?'belief':null,expertFuture?'future-srs':null,
  expertBeam?'focused-beam':null,expertOffense?'offense-weight':null,
  expertHoldPlan?'hold-plan':null,expertPruning?'setup-survival':null,
  expertSticky?'sticky-continuation':null,
  expertExactLeaf?'verified-fifth-ply':null,
  expertTStock?'public-t-stock':null,
  expertFrontier?(frontierRiskGuard?'risk-guarded-frontier':
    'option-frontier'):null,
  budgetScaling?'budget-scale':null]
  .filter(Boolean).join('+')||'baseline';
const expertKind=expertLabel==='baseline'?'candidate':expertLabel;
if(!Number.isSafeInteger(limit)||limit<1||limit>10000||
  !Number.isSafeInteger(budget)||budget<1||
  !Number.isSafeInteger(candidateBudget)||candidateBudget<1||candidateBudget>2000000||
  !Number.isSafeInteger(baselineBudget)||baselineBudget<1||baselineBudget>2000000||
  !Number.isInteger(candidateDepth)||candidateDepth<1||candidateDepth>5||
  !Number.isInteger(baselineDepth)||baselineDepth<1||baselineDepth>5||
  !Number.isInteger(candidateBeamWidth)||candidateBeamWidth<1||candidateBeamWidth>128||
  !Number.isInteger(baselineBeamWidth)||baselineBeamWidth<1||baselineBeamWidth>128||
  !Number.isSafeInteger(openTiles)||openTiles<1||
  !Number.isFinite(recoveryWeight)||recoveryWeight<0||recoveryWeight>4||
  !Number.isInteger(beliefProbes)||beliefProbes<0||beliefProbes>20||
  !Number.isInteger(beliefMaxOutcomes)||beliefMaxOutcomes<1||beliefMaxOutcomes>100||
  !Number.isInteger(futureProbes)||futureProbes<0||futureProbes>100||
  !Number.isInteger(baselineFutureProbes)||baselineFutureProbes<0||baselineFutureProbes>100||
  !Number.isInteger(candidateFutureProbes)||candidateFutureProbes<0||candidateFutureProbes>100||
  !Number.isInteger(baselineFutureStates)||baselineFutureStates<1||baselineFutureStates>10000||
  !Number.isInteger(candidateFutureStates)||candidateFutureStates<1||candidateFutureStates>10000||
  !Number.isInteger(futureStates)||futureStates<1||futureStates>10000||
  !Number.isInteger(beamRootReserve)||beamRootReserve<1||beamRootReserve>24||
  !Number.isFinite(offenseWeight)||offenseWeight<0||offenseWeight>24||
  !Number.isInteger(leafExtensionBudget)||leafExtensionBudget<1||leafExtensionBudget>100000||
  !Number.isInteger(leafExtensionStates)||leafExtensionStates<1||leafExtensionStates>10000||
  !Number.isFinite(intermediateHoleRelief)||
  intermediateHoleRelief<0||intermediateHoleRelief>1||
  !Number.isFinite(tStockMargin)||tStockMargin<0||tStockMargin>100000||
  !Number.isInteger(frontierSlots)||frontierSlots<1||frontierSlots>32||
  !Number.isFinite(frontierGap)||frontierGap<0||frontierGap>1000)
  throw Error('Invalid ROOK self-play configuration');
if(compareUnguardedFrontier&&(!expertFrontier||!frontierRiskGuard||
  expertOpen||expertTStock||budgetScaling))
  throw Error('Unguarded comparator requires only the guarded frontier expert');
if(budgetScaling&&(expertOpen||expertRecovery||expertBelief||expertFuture||
  expertBeam||expertOffense||expertHoldPlan||expertPruning||expertSticky||
  expertExactLeaf||expertTStock||expertFrontier))
  throw Error('Budget scaling must isolate maxNodes; disable EXPERT_*');
const base={depth:4,beamWidth:24,maxNodes:budget,maxStates:1200,
  maxSteps:42,includeRanked:true,reverseOnlyOpen:true,
  reverseOpenMaxTileNodes:openTiles,reverseOpenMaxGoals:8,
  reverseOpenMaxProofs:12};
// Post-Hold audit compares the actually authority-accepted next placement
// with the same root search's suggested placement. Different paths with
// identical landed cells/spin count as the same decision.
const samePlacement=(a,b)=>a?.kind==='place'&&b?.kind==='place'&&
  a.move.piece===b.move.piece&&a.execution.spin===b.execution.spin&&
  a.move.cells.map(([x,y])=>x+','+y).sort().join(';')===
    b.move.cells.map(([x,y])=>x+','+y).sort().join(';');
const makeDemo=seed=>new BotDemo(new Engine({mode:'tl',seed,
  rules:{g:0,gincrease:0,b2bcharge_base:3},
  handling:{arr:0,das:1,dcd:0,sdf:20,safelock:false,cancel:false,
    may20g:true,irs:'off',ihs:'off'}}),{placementMode:'atomic'});

const rememberedPlans=new WeakMap();
function select(demo,open){
  const stats={nodes:0,holds:0,ms:0,rejections:0,offers:0,
    selections:0,forwardProbes:0,forwardMoves:0,
    holdPlanAttempts:0,holdPlanAccepted:0,holdPlanRejected:0,
    holdPlanAudited:0,holdPlanMatched:0,holdPlanDiverged:0,
    searches:0,budgetReached:0,searchDepthLimit:0,
    tStockEligible:0,tStockOffers:0,tStockVerified:0,
    tStockCapped:0,tStockProofCalls:0,tStockPlacementEvaluations:0,
    tStockChoices:0,
    frontierConsidered:0,frontierInserted:0,
    frontierCombatInserted:0,frontierQuadInserted:0,
    frontierSpinInserted:0,frontierChanged:0,
    frontierShadowChecks:0,frontierShadowMs:0,
    frontierRiskSuppressed:0,frontierGuardShadowChecks:0,
    frontierGuardShadowChanges:0,frontierGuardShadowMs:0,
    stickyAttempts:0,stickyAccepted:0,stickyRejected:0,
    stickyHoldSkipped:0,leafExtensionAttempts:0,leafExtensionApplied:0,
    leafExtensionAborts:0,leafExtensionChanges:0,leafExtensionWork:0};
  let expectedAfterHold=null,usedStickyHold=false;
  if(open&&expertSticky){
    const next=rememberedPlans.get(demo)?.[0];
    if(next){
      stats.stickyAttempts++;
      const visible=demo.view().visible;
      if(!next.useHold&&publicPlanStillApplicable(visible,next)){
        const request=proveForecastPlacement(visible,next,{maxStates:1200,maxSteps:42});
        if(request){
          const view=demo.view();
          try{
            demo.prepare(request,view.revision);
            rememberedPlans.set(demo,rememberedPlans.get(demo).slice(1));
            stats.stickyAccepted++;
            return {revision:view.revision,...stats};
          }catch(error){stats.stickyRejected++;}
        }else stats.stickyRejected++;
      }else if(next.useHold&&publicPlanStillApplicable(visible,next)){
        const holdRequest=plannedHold(visible,next);
        if(holdRequest){
          try{
            const before=demo.view();
            demo.prepare(holdRequest,before.revision);
            demo.commit(before.revision);stats.holds++;usedStickyHold=true;
            const after=demo.view();
            const request=proveForecastPlacement(after.visible,next,
              {maxStates:1200,maxSteps:42});
            if(request){
              try{
                demo.prepare(request,after.revision);
                rememberedPlans.set(demo,rememberedPlans.get(demo).slice(1));
                stats.stickyAccepted++;
                return {revision:after.revision,...stats};
              }catch(error){stats.stickyRejected++;}
            }else stats.stickyRejected++;
          }catch(error){stats.stickyRejected++;}
        }else stats.stickyHoldSkipped++;
      }else if(next.useHold)stats.stickyHoldSkipped++;
      else stats.stickyRejected++;
      rememberedPlans.delete(demo);
    }
  }
  for(let turn=usedStickyHold?1:0;turn<2;turn++){
    const view=demo.view();
    if(view.visible.next.length!==5)throw Error('Visible NEXT5 contract violated');
    const started=performance.now();
    const searchBudget=open?candidateBudget:baselineBudget;
    const searchDepth=open?candidateDepth:baselineDepth;
    const searchBeam=open?candidateBeamWidth:baselineBeamWidth;
    const useFrontier=expertFrontier&&
      (open||compareUnguardedFrontier);
    const searchOptions={...base,maxNodes:searchBudget,
      depth:searchDepth,beamWidth:searchBeam,
      reversePlanner:open&&expertOpen,
      garbageRecovery:open&&expertRecovery,
      garbageRecoveryWeight:recoveryWeight,
      garbageBelief:open&&expertBelief,
      futureReachableProbes:open?(expertFuture?futureProbes:candidateFutureProbes):
        baselineFutureProbes,
      futureReachableStates:open?(expertFuture?futureStates:candidateFutureStates):
        baselineFutureStates,
      beamRootReserve:open&&expertBeam?beamRootReserve:null,
      offenseWeight:open&&expertOffense?offenseWeight:4.8,
      intermediateHoleRelief:open&&expertPruning?intermediateHoleRelief:0,
      includeHoldPlan:(open&&expertHoldPlan)||auditHoldPlan,
      includeForecastPlan:open&&expertSticky,
      exactLeafExtension:open&&expertExactLeaf,leafExtensionBudget,leafExtensionStates,
      beliefProbes,beliefMaxOutcomes,
      optionFrontierSlots:useFrontier?Math.min(frontierSlots,searchBeam-1):0,
      optionFrontierMaxScoreGap:frontierGap,
      optionFrontierRiskGuard:open&&expertFrontier&&frontierRiskGuard};
    const report=open&&expertTStock
      ?chooseMoveWithPublicTStock(view.visible,{...searchOptions,
        minValueMargin:tStockMargin,planMaxStates:950,planMaxSteps:70,
        maxProofCalls:85,maxPlacementEvaluations:2500,planBeamWidth:16,
        maxPlans:4})
      :chooseMove(view.visible,searchOptions);
    stats.ms+=performance.now()-started;
    stats.nodes+=report.diagnostics.evaluated;
    stats.frontierConsidered+=report.diagnostics.optionFrontierStats?.considered??0;
    stats.frontierInserted+=report.diagnostics.optionFrontierStats?.inserted??0;
    stats.frontierRiskSuppressed+=Number(
      report.diagnostics.frontierSuppressed===true);
    stats.frontierCombatInserted+=report.diagnostics.optionFrontierStats?.modes.combat??0;
    stats.frontierQuadInserted+=report.diagnostics.optionFrontierStats?.modes.quad??0;
    stats.frontierSpinInserted+=report.diagnostics.optionFrontierStats?.modes.spin??0;
    if(open&&expertFrontier&&frontierGuardShadow){
      const guardStart=performance.now();
      const unguarded=chooseMove(view.visible,{...searchOptions,
        optionFrontierRiskGuard:false});
      stats.frontierGuardShadowMs+=performance.now()-guardStart;
      stats.frontierGuardShadowChecks++;
      const signature=a=>a.kind==='hold'?'hold:'+a.mode:
        'place:'+a.move.piece+':'+a.execution.spin+':'+
          a.move.cells.map(([x,y])=>x+','+y).sort().join(';');
      stats.frontierGuardShadowChanges+=Number(
        signature(report)!==signature(unguarded));
    }
    if(open&&expertFrontier&&frontierShadow){
      const shadowStart=performance.now();
      const shadow=chooseMove(view.visible,{...searchOptions,
        optionFrontierSlots:0});
      stats.frontierShadowMs+=performance.now()-shadowStart;
      stats.frontierShadowChecks++;
      // Compare actual action semantics, not execution path string
      // or diagnostics, both of which may differ for equivalent actions.
      const signature=a=>a.kind==='hold'
        ?'hold:'+a.mode
        :'place:'+a.move.piece+':'+a.execution.spin+':'+
          a.move.cells.map(([x,y])=>x+','+y).sort().join(';');
      stats.frontierChanged+=Number(signature(report)!==signature(shadow));
    }
    stats.tStockEligible+=Number((report.diagnostics.tStock?.eligibleModes??0)>0);
    stats.tStockOffers+=report.diagnostics.tStock?.inspected??0;
    stats.tStockVerified+=report.diagnostics.tStock?.verified??0;
    stats.tStockCapped+=report.diagnostics.tStock?.truncatedModes??0;
    stats.tStockProofCalls+=report.diagnostics.tStock?.proofCalls??0;
    stats.tStockPlacementEvaluations+=report.diagnostics.tStock?.placements??0;
    stats.tStockChoices+=Number(report.diagnostics.tStock?.selected===true);
    stats.searches++;
    stats.budgetReached+=Number(report.diagnostics.evaluated>=searchBudget);
    stats.searchDepthLimit=Math.max(stats.searchDepthLimit,report.diagnostics.effectiveDepth);
    stats.offers+=report.diagnostics.reversePlans;
    stats.selections+=Number(report.diagnostics.reverseSelectedGoal!==null);
    stats.forwardProbes+=report.diagnostics.futureProbes;
    stats.forwardMoves+=report.diagnostics.futureMoves;
    if(open&&expertExactLeaf){
      stats.leafExtensionAttempts++;
      stats.leafExtensionApplied+=Number(report.diagnostics.leafExtensionApplied);
      stats.leafExtensionAborts+=Number(!!report.diagnostics.leafExtensionAbort);
      stats.leafExtensionChanges+=Number(report.diagnostics.leafExtensionChangesRoot);
      stats.leafExtensionWork+=report.diagnostics.leafExtensionEvaluated;
    }
    let lastError=null,didHold=false;
    for(const a of report.ranked){
      const request=a.kind==='hold'
        ?{action:{kind:'hold',mode:a.mode,samePiece:a.samePiece,requiresReanalysis:true}}
        :{action:{kind:'place'},move:a.move,execution:a.execution};
      try{
        demo.prepare(request,view.revision);
        if(a.kind==='hold'){
          if(turn!==0)throw Error('second Hold is forbidden');
          demo.commit(view.revision);stats.holds++;didHold=true;
          if(turn===0&&a===report.ranked[0])
            expectedAfterHold=report.holdPlan??null;
          // This is only a hypothesis: the planned post-Hold placement
          // must pass the SAME Tetrp authority as every other real move.
          // If rejected, fall back to a fresh visible-state search.
          if(open&&expertHoldPlan&&turn===0&&a===report.ranked[0]&&
            report.holdPlan?.kind==='place'){
            stats.holdPlanAttempts++;
            const after=demo.view();
            try{
              demo.prepare({action:{kind:'place'},move:report.holdPlan.move,
                execution:report.holdPlan.execution},after.revision);
              stats.holdPlanAccepted++;
              return {revision:after.revision,...stats};
            }catch(error){
              stats.holdPlanRejected++;
            }
          }
          break;
        }
        if(turn===1&&expectedAfterHold){
          stats.holdPlanAudited++;
          if(samePlacement(expectedAfterHold,a))stats.holdPlanMatched++;
          else stats.holdPlanDiverged++;
        }
        if(open&&expertSticky)rememberedPlans.set(demo,
          a===report.ranked[0]?(report.forecastPlan??[]).slice(1):[]);
        return {revision:view.revision,...stats};
      }catch(e){lastError=e;stats.rejections++}
    }
    if(turn===0&&didHold)continue;
    throw Error('No authority-executable recommendation: '+(lastError?.message??'none'));
  }
  throw Error('No placement after Hold');
}
function summary(demo,kind,counters){
  const s=demo.engine.state,a=s.attack,pieces=s.stats.pieces;
  return {kind,pieces,frame:s.frame,playing:s.playing,reason:s.reason,
    generated:a.totals.generated,sent:a.totals.sent,
    cancelled:a.totals.cancelled,received:a.totals.received,
    tanked:a.totals.tanked,btb:a.btb,
    rawAPP:pieces?Number((a.totals.generated/pieces).toFixed(4)):0,
    sentAPP:pieces?Number((a.totals.sent/pieces).toFixed(4)):0,
    ...counters,ms:Math.round(counters.ms)};
}
// Benchmark-only checkpoints; never forwarded to the bot's visible input.
function health(demo){
  const s=demo.engine.state,b=s.board,H=b.rows.length;
  let height=0,holes=0,garbage=0;
  for(let x=0;x<b.width;x++){
    let covered=false;
    for(let y=0;y<H;y++){
      const v=b.rows[y][x];
      if(v!==null){
        if(!covered)height=Math.max(height,H-y);
        covered=true;
        if(v==='gb'||v==='gbd')garbage++;
      }else if(covered)holes++;
    }
  }
  return {height,holes,garbage,btb:s.attack.btb,
    pending:s.attack.pending.reduce((n,p)=>n+p.amt,0)+
      s.attack.are.reduce((n,p)=>n+p.amt,0),
    sent:s.attack.totals.sent,cancelled:s.attack.totals.cancelled,
    received:s.attack.totals.received,tanked:s.attack.totals.tanked};
}
function pairedGame(seed,swap){
  const comparatorKind=compareUnguardedFrontier?'option-frontier':'baseline';
  const kinds=swap?[comparatorKind,expertKind]:[expertKind,comparatorKind];
  // Both players receive the IDENTICAL seven-bag seed in this match.
  const demos=[makeDemo(seed),makeDemo(seed)];
  assertMatchingOpening(demos);
  const original=demos.map(d=>d.engine.serialize());
  const totals=Array.from({length:2},()=>({nodes:0,holds:0,ms:0,
    rejections:0,offers:0,selections:0,forwardProbes:0,forwardMoves:0,
    holdPlanAttempts:0,holdPlanAccepted:0,holdPlanRejected:0,
    holdPlanAudited:0,holdPlanMatched:0,holdPlanDiverged:0,
    searches:0,budgetReached:0,searchDepthLimit:0,
    tStockEligible:0,tStockOffers:0,tStockVerified:0,
    tStockCapped:0,tStockProofCalls:0,tStockPlacementEvaluations:0,
    tStockChoices:0,
    frontierConsidered:0,frontierInserted:0,
    frontierCombatInserted:0,frontierQuadInserted:0,
    frontierSpinInserted:0,frontierChanged:0,
    frontierShadowChecks:0,frontierShadowMs:0,
    frontierRiskSuppressed:0,frontierGuardShadowChecks:0,
    frontierGuardShadowChanges:0,frontierGuardShadowMs:0,
    stickyAttempts:0,stickyAccepted:0,stickyRejected:0,stickyHoldSkipped:0,
    leafExtensionAttempts:0,leafExtensionApplied:0,leafExtensionAborts:0,
    leafExtensionChanges:0,leafExtensionWork:0,
    tsd:0,tss:0,mini:0,quad:0,maxBtb:0}));
  let inbound=[],turns=0,error=null,checkpoints=[];
  try{
    while(turns<limit&&demos.every(d=>d.engine.state.playing)){
      for(const packet of inbound){
        const e=demos[packet.to].engine;
        const cid=e.receive({from:'P2',iid:packet.iid,
          ackiid:packet.ackiid,amt:packet.amt});e.confirm(cid);
      }
      inbound=[];
      if(demos.some(d=>!d.engine.state.playing))break;
      const turnFrame=assertSimultaneousPair(demos);
      const moves=[];
      for(let i=0;i<2;i++){
        const decision=select(demos[i],kinds[i]===expertKind);
        moves.push(decision);
        for(const key of Object.keys(totals[i]))
          if(key==='searchDepthLimit')
            totals[i][key]=Math.max(totals[i][key],decision[key]??0);
          else totals[i][key]+=decision[key]??0;
      }
      // Both decisions are prepared from the SAME tick, before either lock.
      if(assertSimultaneousPair(demos)!==turnFrame)
        throw Error('Decision mutated the shared battle clock');
      for(let i=0;i<2;i++){
        const view=demos[i].commit(moves[i].revision),last=view.lastPlacement;
        totals[i].tsd+=Number(last.piece==='t'&&last.spin==='full'&&last.lines===2);
        totals[i].tss+=Number(last.piece==='t'&&last.spin==='full'&&last.lines===1);
        totals[i].mini+=Number(last.spin==='mini'&&last.lines>0);
        totals[i].quad+=Number(last.lines===4);
        totals[i].maxBtb=Math.max(totals[i].maxBtb,demos[i].engine.state.attack.btb);
      }
      // Lock times remain synchronous; transfer attacks only next turn.
      assertSimultaneousPair(demos);
      for(let from=0;from<2;from++)
        for(const packet of demos[from].engine.state.attack.outbox.splice(0))
          inbound.push({to:1-from,iid:packet.iid,ackiid:packet.ackiid,amt:packet.amt});
      turns++;
      if([6,12,24,48,72,96,120,150,200,250,300,400,500,600,750,1000,1250,1500,1750,2000].includes(turns))
        checkpoints.push({turns,slots:demos.map(health)});
    }
  }catch(e){error=e instanceof Error?e.message:String(e)}
  if(turns&&!error&&demos.some((d,i)=>d.engine.serialize()===original[i]))
    error='A Tetrp authority did not advance';
  const alive=demos.map(d=>d.engine.state.playing);
  const result=scoreKO({alive,rounds:turns,cap:limit,error});
  return {format:'rook-paired-tetrp-ko/2',seed,seeds:[seed,seed],swap,kinds,
    sameSeed:true,simultaneousLocks:true,pps:2.5,swapRoles,
    // Preserve old nodeBudget only when both sides share the same cap.
    nodeBudget:candidateBudget===baselineBudget?budget:null,
    budgetScaling,candidateNodeBudget:candidateBudget,
    baselineNodeBudget:baselineBudget,candidateDepth,baselineDepth,
    candidateBeamWidth,baselineBeamWidth,
    budgetsByKind:{[expertKind]:candidateBudget,baseline:baselineBudget},
    extraOpenerCPU:expertOpen,expertLabel,
    expertOpen,expertRecovery,expertBelief,expertFuture,expertBeam,expertOffense,
    expertHoldPlan,expertPruning,expertSticky,expertExactLeaf,
    expertFrontier,frontierSlots,frontierGap,frontierShadow,
    compareUnguardedFrontier,
    frontierRiskGuard,frontierGuardShadow,
    leafExtensionBudget,leafExtensionStates,intermediateHoleRelief,
    auditHoldPlan,offenseWeight,beamRootReserve,futureProbes,futureStates,
    baselineFutureProbes,baselineFutureStates,candidateFutureProbes,
    candidateFutureStates,
    beliefProbes,beliefMaxOutcomes,recoveryWeight,
    turns,cap:limit,scored:result.scored,termination:result.termination,
    error,winnerSlot:result.winnerSlot,
    winner:result.scored?kinds[result.winnerSlot]:null,
    checkpoints,slots:demos.map((d,i)=>({
      ...summary(d,kinds[i],totals[i]),
      configuredNodeBudget:kinds[i]===expertKind?candidateBudget:baselineBudget,
      configuredDepth:kinds[i]===expertKind?candidateDepth:baselineDepth,
      configuredBeamWidth:kinds[i]===expertKind?candidateBeamWidth:baselineBeamWidth,
      configuredFutureProbes:kinds[i]===expertKind
        ?(expertFuture?futureProbes:candidateFutureProbes):baselineFutureProbes
    }))};
}
// Independent seeds give distinct games; each seed is repeated with the
// candidate and baseline swapped between the two identical-bag slots.
const results=seeds.flatMap(seed=>swapRoles==='1'
  ?[pairedGame(seed,false),pairedGame(seed,true)]
  :[pairedGame(seed,false)]);
for(const row of results)console.log(JSON.stringify(row));
if(process.env.RESULTS_PATH)
  writeFileSync(process.env.RESULTS_PATH,JSON.stringify(results,null,2)+'\n');
if(results.some(r=>r.error))process.exitCode=1;
