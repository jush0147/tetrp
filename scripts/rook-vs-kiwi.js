// Synchronous authority-side ROOK vs pinned Kiwi experiment.
// Both bots see only per-turn Tetrp.visibleState and exactly NEXT5.
// Tetrp runs the moves and owns queue RNG, incoming packets and KO.
import {readFileSync,writeFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {chooseMove} from '../src/analysis/rook.js';
import {parseMatchSeeds,assertMatchingOpening,assertSimultaneousPair,scoreKO} from './rook-ko-protocol.js';
import {prepareKiwi,normalizeRankedRecommendation} from '../src/analysis/kiwi.js';
import init,{analyze_snapshot_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';

const kiwiBudget=Number(process.env.KIWI_NODES??200000);
const rookBudget=Number(process.env.ROOK_NODES??6000);
const limit=Number(process.env.MAX_LOCKS??400);
const seeds=parseMatchSeeds({...process.env,
  SEED_A:process.env.SEED_A??'67000',SEED_B:process.env.SEED_B??'67001'});
if(!Number.isSafeInteger(kiwiBudget)||kiwiBudget<2000||
  !Number.isSafeInteger(rookBudget)||rookBudget<1||
  !Number.isSafeInteger(limit)||limit<1)throw Error('invalid KO configuration');

await init({module_or_path:readFileSync(new URL('../vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm',import.meta.url))});

const botOptions={depth:4,beamWidth:24,maxNodes:rookBudget,maxStates:1200,maxSteps:42};
const makeDemo=seed=>new BotDemo(new Engine({mode:'tl',seed,rules:{g:0,gincrease:0,b2bcharge_base:3},
  handling:{arr:0,das:1,dcd:0,sdf:20,safelock:false,cancel:false,may20g:true,irs:'off',ihs:'off'}}),{placementMode:'atomic'});

function candidates(kind,visible){
  // Only one deeply ranked ROOK search or Kiwi snapshot search per decision.
  if(kind==='rook'){
    const report=chooseMove(visible,{...botOptions,includeRanked:true});
    return {nodes:report.diagnostics.evaluated,limit:rookBudget,
      count:report.ranked.length,
      at(index){
        const x=report.ranked[index];
        if(!x)return null;
        return x.kind==='hold'
          ?{action:{kind:'hold',mode:x.mode,samePiece:x.samePiece,requiresReanalysis:true}}
          :{action:{kind:'place'},move:x.move,execution:x.execution};
      }};
  }
  const prepared=prepareKiwi(visible);
  prepared.request.node_budget=kiwiBudget;
  const report=JSON.parse(analyze_snapshot_json(JSON.stringify(prepared.request)));
  if(report.nodes>kiwiBudget)throw Error('Kiwi search exceeded node limit');
  return {nodes:report.nodes,limit:kiwiBudget,count:report.candidates.length,
    at(index){
      if(index>=report.candidates.length)return null;
      return normalizeRankedRecommendation(visible,prepared,report,index);
    }};
}

function prepareUntilPlace(demo,kind){
  let nodes=0,holdCount=0,searchMs=0;
  for(let decision=0;decision<2;decision++){
    const view=demo.view();
    const start=performance.now();
    const search=candidates(kind,view.visible);
    searchMs+=performance.now()-start;
    nodes+=search.nodes;
    let lastError=null;
    for(let i=0;i<search.count;){
      let result;
      try{result=search.at(i)}
      catch(error){lastError=error;break}
      if(!result)break;
      try{
        demo.prepare(result,view.revision);
        if(result.action.kind==='hold'){
          if(decision!==0)throw Error('second Hold in same turn');
          const next=demo.commit(view.revision);
          if(!next.visible.hold.locked)throw Error('Hold lock not set');
          holdCount++;break;
        }
        return {revision:view.revision,nodes,holdCount,searchMs,placement:result.move};
      }catch(error){
        lastError=error;
        i=(result.candidateIndex??i)+1;
      }
    }
    if(decision===0&&holdCount===1)continue;
    throw Error(kind+' no authority-executable recommendation: '+(lastError?.message??'all candidates exhausted'));
  }
  throw Error('post-Hold search did not Place');
}

function asStats(demo,kind,searchNodes,holdMoves,searchMs){
  const s=demo.engine.state,a=s.attack;
  return {kind,playing:s.playing,reason:s.reason,pieces:s.stats.pieces,frame:s.frame,
    generated:a.totals.generated,sent:a.totals.sent,cancelled:a.totals.cancelled,
    tanked:a.totals.tanked,received:a.totals.received,holdMoves,searchNodes,
    searchMs:Math.round(searchMs),msPerPiece:s.stats.pieces?
      Number((searchMs/s.stats.pieces).toFixed(3)):0,
    rawApp:s.stats.pieces?a.totals.generated/s.stats.pieces:0,
    sentApp:s.stats.pieces?a.totals.sent/s.stats.pieces:0};
}
function runPair(seed,order){
  const kinds=order===0?['rook','kiwi']:['kiwi','rook'];
  const demos=[makeDemo(seed),makeDemo(seed)];
  assertMatchingOpening(demos);
  const original=demos.map(d=>d.view().visible);
  let transfers=[],lockSteps=0,searchNodes=[0,0],
    holdMoves=[0,0],searchMs=[0,0],error=null;
  try{
    while(lockSteps<limit&&demos.every(d=>d.engine.state.playing)){
      // No side sees the other side's future move or its unrevealed garbage.
      for(const packet of transfers){
        const receiver=demos[packet.to].engine;
        const cid=receiver.receive({from:'P2',iid:packet.iid,ackiid:packet.ackiid,amt:packet.amt});
        receiver.confirm(cid);
      }
      transfers=[];
      if(demos.some(d=>!d.engine.state.playing))break;
      const turnFrame=assertSimultaneousPair(demos);
      const plans=[];
      for(let i=0;i<2;i++){
        const plan=prepareUntilPlace(demos[i],kinds[i]);
        plans.push(plan);searchNodes[i]+=plan.nodes;holdMoves[i]+=plan.holdCount;
        searchMs[i]+=plan.searchMs;
      }
      // Both decisions are prepared before either placement commits.
      if(assertSimultaneousPair(demos)!==turnFrame)
        throw Error('Decision mutated the synchronous match clock');
      for(let i=0;i<2;i++)demos[i].commit(plans[i].revision);
      assertSimultaneousPair(demos);
      for(let from=0;from<2;from++){
        for(const x of demos[from].engine.state.attack.outbox.splice(0))
          transfers.push({to:1-from,iid:x.iid,ackiid:x.ackiid,amt:x.amt});
      }
      lockSteps++;
      if(lockSteps%25===0)process.stderr.write(JSON.stringify({
        game:order,lockSteps,stats:demos.map((d,i)=>asStats(d,kinds[i],searchNodes[i],holdMoves[i],searchMs[i]))})+'\n');
    }
  }catch(e){error=e instanceof Error?e.message:String(e)}
  const alive=demos.map(d=>d.engine.state.playing);
  const result=scoreKO({alive,rounds:lockSteps,cap:limit,error});
  return {format:'tetrp-visible-ko/2',order,seed,seeds:[seed,seed],kinds,
    sameSeed:true,simultaneousLocks:true,pps:2.5,
    source:'Tetrp TL authority with source RNG private, no replay future',
    nodeBudgets:{rook:rookBudget,kiwi:kiwiBudget},lockSteps,cap:limit,
    scored:result.scored,termination:result.termination,
    error,winnerSlot:result.winnerSlot,
    winner:result.scored?kinds[result.winnerSlot]:null,
    slots:demos.map((d,i)=>asStats(d,kinds[i],searchNodes[i],holdMoves[i],searchMs[i])),
    initialVisibleNext:original.map(v=>v.next)};
}
// An independent seed is played twice, with ROOK / Kiwi swapping slots.
const results=seeds.flatMap(seed=>[runPair(seed,0),runPair(seed,1)]);
for(const result of results)process.stdout.write(JSON.stringify(result)+'\n');
if(process.env.RESULTS_PATH)writeFileSync(process.env.RESULTS_PATH,JSON.stringify(results,null,2)+'\n');
// No artificial winner. Invalid/capped games remain explicit and unscored.
