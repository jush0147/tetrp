// Targeted PRESSURE DIAGNOSTIC, NOT a scored game or win-rate evidence.
// Start from actual Engine/BotDemo-authorized SRS+ placements, introduce
// explicitly controlled opponent packets using the Engine receive/confirm API.
// Bots only see visibleState from that authority, never secret hole columns.
// The injection tests response under pressure; it does NOT claim these exact
// packets appeared naturally in a Kiwi-vs-ROOK match.
import {performance} from 'node:perf_hooks';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove,enumerateReachable} from '../src/analysis/rook.js';
import {actionSignature} from '../src/analysis/rook-disagreement.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
import * as B from '../src/board.js';

const seeds=[67420,67421,67422,67423];
const scenarios=[{locks:0,amount:3},{locks:3,amount:7}];
const common={depth:3,beamWidth:10,maxNodes:1500,maxStates:550,
  maxSteps:42,spinForecast:false,futureReachable:false,
  tsdTacticalProbes:0,garbageBelief:true,beliefProbes:3,
  beliefMaxOutcomes:10,beliefReachableStates:180,
  beliefRiskWeight:0.2};
const sample=[];
for(const seed of seeds)for(const scenario of scenarios){
  const engine=new Engine({seed,mode:'tl',rules:{g:0}});
  const demo=new BotDemo(engine,{placementMode:'atomic'});
  for(let lock=0;lock<scenario.locks;lock++){
    const seen=demo.view(),v=seen.visible;
    const legal=enumerateReachable(v.board,v.current,v.rules,{
      maxStates:600,maxSteps:42});
    if(!legal.length)throw Error('Unable to generate legitimate pressure board');
    const p=legal[(seed+lock*11)%legal.length];
    const request={action:{kind:'place'},move:{
      piece:p.piece.type,x:p.piece.x,y:Math.ceil(p.piece.y),
      rotation:p.piece.r,useHold:false,
      cells:B.cells(p.piece).map(([x,y])=>[x,Math.ceil(y)])
    },execution:{moves:p.path,spin:p.spin}};
    demo.prepare(request,seen.revision);
    demo.commit(seen.revision);
  }
  const packetId=demo.engine.receive({
    from:'public-controlled-P2',iid:seed*100+scenario.locks,
    amt:scenario.amount
  });
  demo.engine.confirm(packetId);
  const visible=visibleState(demo.engine.state),before=structuredClone(visible);
  const pending=[...(visible.attack?.pending??[]),
    ...(visible.attack?.are??[])].reduce((n,p)=>n+(p.amt??0),0);
  if(pending<scenario.amount||visible.next.length!==5)
    throw Error('Controlled genuine Engine incoming attack not publicly visible');
  const results=[];
  for(const [policy,extra] of [
    ['legacy',{beliefCommonHorizon:false}],
    ['common',{beliefCommonHorizon:true,
      beliefHorizonNodes:180,beliefHorizonBeam:3}]
  ]){
    const t0=performance.now();
    const result=chooseMove(visible,{...common,...extra});
    const ms=performance.now()-t0;
    if(result.diagnostics.evaluated>common.maxNodes)
      throw Error('Primary beam violated configured node limit');
    if(result.kind==='place'&&!validatePlacement(visible,{
      action:{kind:'place'},move:result.move,execution:result.execution}))
      throw Error('ROOK issued a placement without true authority path');
    results.push({policy,action:actionSignature(result),
      ms:+ms.toFixed(1),value:result.diagnostics.value,
      evaluated:result.diagnostics.evaluated,
      selectedUnresolved:result.diagnostics.selectedUnresolvedGarbage,
      unresolvedNodes:result.diagnostics.unresolvedTankNodes,
      attempts:result.diagnostics.beliefAttempts,
      success:result.diagnostics.beliefEvaluations,
      aborted:result.diagnostics.beliefHorizonAborted,
      conditionalNodes:result.diagnostics.beliefHorizonEvaluated,
      abortReasons:result.diagnostics.beliefHorizonAbortReasons,
      overBudget:result.diagnostics.beliefOverBudget});
  }
  if(JSON.stringify(visible)!==JSON.stringify(before))
    throw Error('ROOK mutated a real player-visible authority snapshot');
  sample.push({seed,locks:scenario.locks,attack:scenario.amount,
    pending,changed:results[0].action!==results[1].action,
    policies:results});
}
const sum=(name,index)=>sample.reduce((n,r)=>n+r.policies[index][name],0);
const output={format:'rook-controlled-authority-pressure-belief/1',
  source:'true Engine placements plus clearly controlled Engine receive/confirm packets',
  scored:false,ko:null,independentInitialSeeds:seeds.length,
  correlatedSnapshots:sample.length,changed:sample.filter(x=>x.changed).length,
  legacyAttempts:sum('attempts',0),commonAttempts:sum('attempts',1),
  commonCompleted:sum('success',1),
  commonAborted:sum('aborted',1),
  commonConditionalNodes:sum('conditionalNodes',1),
  commonOverBudget:sum('overBudget',1),
  warning:'Controlled input pressure is not an organic match or a KO outcome. Equal configured beam nodes is not equal total CPU.',
  samples:sample};
console.log(JSON.stringify(output));
