// TRUE Tetrp authority root-action FORK, offline research only.
// First lock differs, both forks start from the EXACT SAME authority match
// checkpoint including (opaque to bots) the same private bag and garbage RNG.
// Both sides' future choices use ONLY BotDemo.view().visible CURRENT/HOLD/NEXT5.
// A fork pair is ONE experimental original seed, not 2 independent KO trials.
import {readFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import {prepareKiwi,normalizeRankedRecommendation} from '../src/analysis/kiwi.js';
import init,{analyze_snapshot_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';
import {BotDemo} from '../src/analysis/demo.js';
import {chooseMove} from '../src/analysis/rook.js';
import {actionSignature} from '../src/analysis/rook-disagreement.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
import {assertSimultaneousPair,assertMatchingOpening,scoreKO}
  from './rook-ko-protocol.js';

const seed=Number(process.env.SEED??67620);
const beforeFork=Number(process.env.FORK_TURN??12);
const cap=Number(process.env.MAX_LOCKS??2000);
const nodes=Number(process.env.ROOK_NODES??6000);
const opponentPolicy=process.env.FORK_OPPONENT??'rook';
const kiwiBudget=Number(process.env.KIWI_NODES??200000);
if(!Number.isSafeInteger(seed)||!Number.isInteger(beforeFork)||
  beforeFork<0||beforeFork>100||!Number.isInteger(cap)||cap<1||
  cap>2000||cap<=beforeFork||!Number.isInteger(nodes)||nodes<100||
  !['rook','kiwi'].includes(opponentPolicy)||
  !Number.isSafeInteger(kiwiBudget)||kiwiBudget<2000)
  throw Error('Invalid real-KO root fork setup');

if(opponentPolicy==='kiwi')
  await init({module_or_path:readFileSync(new URL(
    '../vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm',import.meta.url))});

const rules={g:0,gincrease:0,b2bcharge_base:3};
const handling={arr:0,das:1,dcd:0,sdf:20,safelock:false,cancel:false,
  may20g:true,irs:'off',ihs:'off'};
const settings={depth:4,beamWidth:24,maxNodes:nodes,maxStates:1200,
  maxSteps:42,includeRanked:true};
const makeDemo=()=>new BotDemo(new Engine({
  mode:'tl',seed,rules,handling}),{placementMode:'atomic'});
// Clone the actual authority branch engine WITHOUT BotDemo's constructor,
// which intentionally reseeds hidden hole RNG for ordinary new demos.
// A counterfactual must preserve the *same* opaque private future in both
// forks and must not re-seed, replay or leak it to either choosing policy.
const clone=d=>{
  const c=Object.create(BotDemo.prototype);
  c.placementMode=d.placementMode;
  c.EngineType=d.EngineType;
  c.engine=d.EngineType.restore(d.engine.serialize());
  c.history=[c.engine.serialize()];
  c.metadata=[null];c.index=0;c.revision=0;c.pending=null;
  return c;
};

function choosePrepared(d,forced=null,policy='rook'){
  let computeMs=0,nodesEvaluated=0,holdCount=0;
  decisionLoop:for(let step=0;step<2;step++){
    const view=d.view();
    if(!view.visible.playing)throw Error('Attempted to place after KO');
    const t=performance.now();
    let ranked;
    if(forced&&step===0)ranked=[forced];
    else if(policy==='rook'){
      const report=chooseMove(view.visible,settings);
      nodesEvaluated+=report.diagnostics.evaluated;
      ranked=report.ranked;
    }else{
      // Same pinned Kiwi WASM search and normalization as rook-vs-kiwi.js.
      // Only the current PLAYER-VISIBLE snapshot is sent to Kiwi, not a
      // branch checkpoint, private queue or opponents' secret future.
      const prepared=prepareKiwi(view.visible);
      prepared.request.node_budget=kiwiBudget;
      const report=JSON.parse(analyze_snapshot_json(
        JSON.stringify(prepared.request)));
      if(report.nodes>kiwiBudget)throw Error('Pinned Kiwi exceeded node cap');
      nodesEvaluated+=report.nodes;
      ranked=[];
      for(let i=0;i<report.candidates.length;i++){
        try{
          ranked.push(normalizeRankedRecommendation(
            view.visible,prepared,report,i));
        }catch(error){
          // Failed Kiwi normalization must NEVER become an executable action.
          // Other officially ranked recommendations may remain legal.
        }
      }
    }
    computeMs+=performance.now()-t;
    let lastError=null;
    for(const action of ranked){
      try{
        const kind=action.action?.kind??action.kind;
        if(kind==='place'){
          const request={action:{kind:'place'},move:action.move,
            execution:action.execution};
          if(!validatePlacement(view.visible,request))
            throw Error('No public SRS+ path for this root candidate');
          d.prepare(request,view.revision);
          return {revision:view.revision,computeMs,nodesEvaluated,holdCount};
        }
        if(kind!=='hold'||step!==0)
          throw Error('Bad or repeated Hold in fork KO');
        const hold=action.action??action;
        d.prepare({action:{kind:'hold',mode:hold.mode,
          samePiece:hold.samePiece}},view.revision);
        d.commit(view.revision);
        holdCount++;
        continue decisionLoop;
      }catch(e){
        lastError=e;
        // An experimentally forced action must NEVER quietly fall back
        // to a different legal move, or the paired treatment is invalid.
        if(forced&&step===0)throw e;
      }
    }
    throw Error('No authority-executable ROOK root (after fallback): '+
      (lastError?.message??'no ranked choices'));
  }
  throw Error('A successful Hold failed to produce a lock');
}

function deliver(pair,packets){
  for(const p of packets){
    const e=pair[p.to].engine;
    const cid=e.receive({from:'P2',iid:p.iid,
      ackiid:p.ackiid,amt:p.amt});
    e.confirm(cid);
  }
  assertSimultaneousPair(pair);
}
function lockRound(pair,forced=null){
  if(!pair.every(d=>d.engine.state.playing))
    throw Error('Tried to lock a KOed pair');
  const startFrame=assertSimultaneousPair(pair);
  // BOTH players pick from their own public snapshot before EITHER locks.
  const plans=pair.map((d,i)=>choosePrepared(d,i===0?forced:null,
    i===0?'rook':opponentPolicy));
  if(assertSimultaneousPair(pair)!==startFrame)
    throw Error('Decisions must not advance synchronized battle frame');
  for(let i=0;i<2;i++)pair[i].commit(plans[i].revision);
  assertSimultaneousPair(pair);
  const transfers=[];
  for(let i=0;i<2;i++){
    for(const p of pair[i].engine.state.attack.outbox.splice(0))
      transfers.push({to:1-i,iid:p.iid,ackiid:p.ackiid,amt:p.amt});
  }
  return {transfers,plans};
}

let original=[makeDemo(),makeDemo()];
assertMatchingOpening(original);
let transfers=[],warmupLocks=0;
while(warmupLocks<beforeFork&&original.every(d=>d.engine.state.playing)){
  deliver(original,transfers);
  transfers=[];
  if(!original.every(d=>d.engine.state.playing))break;
  const next=lockRound(original);
  transfers=next.transfers;
  warmupLocks++;
}
if(warmupLocks!==beforeFork||!original.every(d=>d.engine.state.playing))
  throw Error('FORK_SETUP_KO: chosen real match seed did not survive warmup');
deliver(original,transfers);transfers=[];
if(!original.every(d=>d.engine.state.playing))
  throw Error('FORK_SETUP_GARBAGE_KO: no live root choice possible');

const publicBefore=original[0].view().visible;
const report=chooseMove(publicBefore,settings);
// The first candidate may be Hold, but compare exactly two REAL place
// actions on CURRENT instead of inventing a placement for Held/NEXT6.
const placeCandidates=report.ranked.filter(x=>x.kind==='place');
const [first,second]=placeCandidates;
if(!first||!second||actionSignature(first)===actionSignature(second))
  throw Error('No two genuinely different legal public current roots');
for(const a of [first,second]){
  if(!validatePlacement(publicBefore,{action:{kind:'place'},
    move:a.move,execution:a.execution}))
    throw Error('Unverified SRS+ root cannot enter fork');
}
if(publicBefore.next.length!==5||
  'bag' in publicBefore||'rng' in publicBefore||'holes' in publicBefore)
  throw Error('FORBIDDEN private input at fork');
const originFrame=assertSimultaneousPair(original);
// IMPORTANT: snapshots of BOTH authorities are identical at the split
// between forks; the original hidden future is only restored inside Engine.
const originSerialized=original.map(d=>d.engine.serialize());
const variants=[first,second].map((root,index)=>{
  const pair=original.map(clone);
  if(pair.some((d,i)=>Buffer.compare(Buffer.from(d.engine.serialize()),
    Buffer.from(originSerialized[i]))!==0))
    throw Error('Restored fork authority does not reproduce checkpoint');
  if(assertSimultaneousPair(pair)!==originFrame)
    throw Error('Unmatched private authority fork clock');
  return {index,root,rootSignature:actionSignature(root),
    rootRank:report.ranked.findIndex(x=>actionSignature(x)===
      actionSignature(root)),pair,
    nodes:0,searchMs:0,holds:0,locks:beforeFork,
    transfers:[],firstHorizon:null,error:null};
});

for(const v of variants){
  const baselineCounters=v.pair.map(d=>
    structuredClone(d.engine.state.attack.totals));
  try{
    while(v.locks<cap&&v.pair.every(d=>d.engine.state.playing)){
      deliver(v.pair,v.transfers);
      v.transfers=[];
      if(!v.pair.every(d=>d.engine.state.playing))break;
      const a=lockRound(v.pair,
        v.locks===beforeFork?v.root:null);
      v.transfers=a.transfers;
      v.searchMs+=a.plans.reduce((n,p)=>n+p.computeMs,0);
      v.nodes+=a.plans.reduce((n,p)=>n+p.nodesEvaluated,0);
      v.holds+=a.plans.reduce((n,p)=>n+p.holdCount,0);
      v.locks++;
      if(v.locks===beforeFork+8){
        const now=v.pair.map(d=>d.engine.state.attack.totals);
        v.firstHorizon={locks:8,complete:true,
          eachSide:now.map((t,i)=>({
            sent:t.sent-baselineCounters[i].sent,
            tanked:t.tanked-baselineCounters[i].tanked,
            cancelled:t.cancelled-baselineCounters[i].cancelled,
            generated:t.generated-baselineCounters[i].generated
          }))};
      }
    }
  }catch(e){v.error=String(e?.message??e);}
}
const results=variants.map(v=>{
  const states=v.pair.map(d=>d.engine.state);
  const outcome=scoreKO({alive:states.map(s=>s.playing),
    rounds:v.locks,cap,error:v.error});
  return {fork:v.index,
    rootRankAmongAll:v.rootRank,
    rootSignature:v.rootSignature,
    locked:v.locks,
    authorityStartFrame:originFrame,
    termination:outcome.termination,
    scored:outcome.scored,
    winner:outcome.scored?outcome.winnerSlot===0?'candidate':'opponent':null,
    error:v.error,firstHorizon:v.firstHorizon??{
      locks:Math.min(8,v.locks-beforeFork),
      complete:false,censored:true},
    researchCpuMs:+v.searchMs.toFixed(1),evaluatedNodes:v.nodes,
    realHolds:v.holds,
    finalCombat:states.map(s=>({
      alive:s.playing,pieces:s.stats.pieces,
      generated:s.attack.totals.generated,
      sent:s.attack.totals.sent,
      tanked:s.attack.totals.tanked,
      cancelled:s.attack.totals.cancelled,
      received:s.attack.totals.received
    }))};
});
const output={format:'rook-authority-paired-root-counterfactual/1',
  independentSeed:seed,forkTurn:beforeFork,
  originalPublicNextCount:publicBefore.next.length,
  identicalAuthorityCheckpoint:true,opaqueHiddenFutureToBots:true,
  publicRootCandidates:true,distinctRootActions:true,
  opponentKind:opponentPolicy,kiwiNodes:opponentPolicy==='kiwi'?kiwiBudget:null,
  synchronizedBattleFrames:true,pps:2.5,cap,
  candidatePolicy:'original ROOK after an individually forced legal root',
  opponentPolicy:opponentPolicy==='kiwi'?
    'pinned Kiwi WASM, identical authority state at split':
    'original ROOK, identical authority state at split',
  scoredShortGames:false,
  correlatedForksPerOriginalSeed:2,
  rootChosenByOriginalRook:actionSignature(report)===actionSignature(first)?
    'first-place':'hold-or-different',
  results,
  caution:'A fork pair is ONE original independent seed; forced legal root choices share the same fixed hidden future only INSIDE the authority. A 8-lock window is a diagnostic, NEVER a scored match. Only actual Tetrp KO scored; capped or double-KO is unscored. These samples DO NOT establish a population-strength advantage.'};
console.log(JSON.stringify(output));
if(results.some(x=>x.error))process.exitCode=1;
