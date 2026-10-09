// Real synchronous Tetrp TL ROOK vs ROOK, swapped roles and public NEXT5.
// The opener is OFF by default in the main bot. This is an experiment only.
import {writeFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {chooseMove} from '../src/analysis/rook.js';
import {DEFAULT_KO_LOCK_CAP,parseMatchSeeds,assertMatchingOpening,assertSimultaneousPair,scoreKO} from './rook-ko-protocol.js';

const limit=Number(process.env.MAX_LOCKS??DEFAULT_KO_LOCK_CAP);
// Legacy ROOK_NODES still means both sides use the same evaluation budget.
const budget=Number(process.env.ROOK_NODES??6000);
const candidateBudget=Number(process.env.ROOK_CANDIDATE_NODES??budget);
const baselineBudget=Number(process.env.ROOK_BASELINE_NODES??budget);
const budgetScaling=process.env.BUDGET_SCALING==='1';
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
const auditHoldPlan=process.env.HOLD_AUDIT==='1';
const offenseWeight=Number(process.env.EXPERT_OFFENSE_WEIGHT??7.2);
const beamRootReserve=Number(process.env.EXPERT_BEAM_ROOT_RESERVE??8);
const futureProbes=Number(process.env.EXPERT_FUTURE_PROBES??24);
const futureStates=Number(process.env.EXPERT_FUTURE_STATES??800);
const beliefProbes=Number(process.env.BELIEF_PROBES??3);
const beliefMaxOutcomes=Number(process.env.BELIEF_MAX_OUTCOMES??10);
const recoveryWeight=Number(process.env.RECOVERY_WEIGHT??1);
const expertLabel=[expertOpen?'opener':null,expertRecovery?'recovery':null,
  expertBelief?'belief':null,expertFuture?'future-srs':null,
  expertBeam?'focused-beam':null,expertOffense?'offense-weight':null,
  expertHoldPlan?'hold-plan':null,budgetScaling?'budget-scale':null]
  .filter(Boolean).join('+')||'baseline';
const expertKind=expertLabel==='baseline'?'candidate':expertLabel;
if(!Number.isSafeInteger(limit)||limit<1||limit>10000||
  !Number.isSafeInteger(budget)||budget<1||
  !Number.isSafeInteger(candidateBudget)||candidateBudget<1||candidateBudget>2000000||
  !Number.isSafeInteger(baselineBudget)||baselineBudget<1||baselineBudget>2000000||
  !Number.isSafeInteger(openTiles)||openTiles<1||
  !Number.isFinite(recoveryWeight)||recoveryWeight<0||recoveryWeight>4||
  !Number.isInteger(beliefProbes)||beliefProbes<0||beliefProbes>20||
  !Number.isInteger(beliefMaxOutcomes)||beliefMaxOutcomes<1||beliefMaxOutcomes>100||
  !Number.isInteger(futureProbes)||futureProbes<0||futureProbes>100||
  !Number.isInteger(futureStates)||futureStates<1||futureStates>10000||
  !Number.isInteger(beamRootReserve)||beamRootReserve<1||beamRootReserve>24||
  !Number.isFinite(offenseWeight)||offenseWeight<0||offenseWeight>24)
  throw Error('Invalid ROOK self-play configuration');
if(budgetScaling&&(expertOpen||expertRecovery||expertBelief||expertFuture||
  expertBeam||expertOffense||expertHoldPlan))
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

function select(demo,open){
  const stats={nodes:0,holds:0,ms:0,rejections:0,offers:0,
    selections:0,forwardProbes:0,forwardMoves:0,
    holdPlanAttempts:0,holdPlanAccepted:0,holdPlanRejected:0,
    holdPlanAudited:0,holdPlanMatched:0,holdPlanDiverged:0,
    searches:0,budgetReached:0,searchDepthLimit:0};
  let expectedAfterHold=null;
  for(let turn=0;turn<2;turn++){
    const view=demo.view();
    if(view.visible.next.length!==5)throw Error('Visible NEXT5 contract violated');
    const started=performance.now();
    const searchBudget=open?candidateBudget:baselineBudget;
    const report=chooseMove(view.visible,{...base,maxNodes:searchBudget,
      reversePlanner:open&&expertOpen,
      garbageRecovery:open&&expertRecovery,
      garbageRecoveryWeight:recoveryWeight,
      garbageBelief:open&&expertBelief,
      futureReachableProbes:open&&expertFuture?futureProbes:9,
      futureReachableStates:open&&expertFuture?futureStates:800,
      beamRootReserve:open&&expertBeam?beamRootReserve:null,
      offenseWeight:open&&expertOffense?offenseWeight:4.8,
      includeHoldPlan:(open&&expertHoldPlan)||auditHoldPlan,
      beliefProbes,beliefMaxOutcomes});
    stats.ms+=performance.now()-started;
    stats.nodes+=report.diagnostics.evaluated;
    stats.searches++;
    stats.budgetReached+=Number(report.diagnostics.evaluated>=searchBudget);
    stats.searchDepthLimit=Math.max(stats.searchDepthLimit,report.diagnostics.effectiveDepth);
    stats.offers+=report.diagnostics.reversePlans;
    stats.selections+=Number(report.diagnostics.reverseSelectedGoal!==null);
    stats.forwardProbes+=report.diagnostics.futureProbes;
    stats.forwardMoves+=report.diagnostics.futureMoves;
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
  const kinds=swap?['baseline',expertKind]:[expertKind,'baseline'];
  // Both players receive the IDENTICAL seven-bag seed in this match.
  const demos=[makeDemo(seed),makeDemo(seed)];
  assertMatchingOpening(demos);
  const original=demos.map(d=>d.engine.serialize());
  const totals=Array.from({length:2},()=>({nodes:0,holds:0,ms:0,
    rejections:0,offers:0,selections:0,forwardProbes:0,forwardMoves:0,
    holdPlanAttempts:0,holdPlanAccepted:0,holdPlanRejected:0,
    holdPlanAudited:0,holdPlanMatched:0,holdPlanDiverged:0,
    searches:0,budgetReached:0,searchDepthLimit:0,
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
    sameSeed:true,simultaneousLocks:true,pps:2.5,
    // Preserve old nodeBudget only when both sides share the same cap.
    nodeBudget:candidateBudget===baselineBudget?budget:null,
    budgetScaling,candidateNodeBudget:candidateBudget,
    baselineNodeBudget:baselineBudget,
    budgetsByKind:{[expertKind]:candidateBudget,baseline:baselineBudget},
    extraOpenerCPU:expertOpen,expertLabel,
    expertOpen,expertRecovery,expertBelief,expertFuture,expertBeam,expertOffense,
    expertHoldPlan,auditHoldPlan,offenseWeight,beamRootReserve,futureProbes,futureStates,
    beliefProbes,beliefMaxOutcomes,recoveryWeight,
    turns,cap:limit,scored:result.scored,termination:result.termination,
    error,winnerSlot:result.winnerSlot,
    winner:result.scored?kinds[result.winnerSlot]:null,
    checkpoints,slots:demos.map((d,i)=>({
      ...summary(d,kinds[i],totals[i]),
      configuredNodeBudget:kinds[i]===expertKind?candidateBudget:baselineBudget
    }))};
}
// Independent seeds give distinct games; each seed is repeated with the
// candidate and baseline swapped between the two identical-bag slots.
const results=seeds.flatMap(seed=>[pairedGame(seed,false),pairedGame(seed,true)]);
for(const row of results)console.log(JSON.stringify(row));
if(process.env.RESULTS_PATH)
  writeFileSync(process.env.RESULTS_PATH,JSON.stringify(results,null,2)+'\n');
if(results.some(r=>r.error))process.exitCode=1;
