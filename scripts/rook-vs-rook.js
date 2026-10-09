// Real synchronous Tetrp TL ROOK vs ROOK, swapped roles and public NEXT5.
// The opener is OFF by default in the main bot. This is an experiment only.
import {writeFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {chooseMove} from '../src/analysis/rook.js';

const limit=Number(process.env.MAX_LOCKS??160);
const budget=Number(process.env.ROOK_NODES??6000);
const seeds=[Number(process.env.SEED_A??1),Number(process.env.SEED_B??8)];
const openTiles=Number(process.env.OPEN_TILE_NODES??1200);
const expertOpen=process.env.EXPERT_OPEN!=='0';
const expertRecovery=process.env.EXPERT_RECOVERY==='1';
const expertBelief=process.env.EXPERT_BELIEF==='1';
const beliefProbes=Number(process.env.BELIEF_PROBES??3);
const beliefMaxOutcomes=Number(process.env.BELIEF_MAX_OUTCOMES??10);
const recoveryWeight=Number(process.env.RECOVERY_WEIGHT??1);
const expertLabel=[expertOpen?'opener':null,expertRecovery?'recovery':null,
  expertBelief?'belief':null].filter(Boolean).join('+')||'baseline';
if(!seeds.every(Number.isSafeInteger)||seeds[0]===seeds[1]||
  !Number.isSafeInteger(limit)||limit<1||limit>1000||
  !Number.isSafeInteger(budget)||budget<1||
  !Number.isSafeInteger(openTiles)||openTiles<1||
  !Number.isFinite(recoveryWeight)||recoveryWeight<0||recoveryWeight>4||
  !Number.isInteger(beliefProbes)||beliefProbes<0||beliefProbes>20||
  !Number.isInteger(beliefMaxOutcomes)||beliefMaxOutcomes<1||beliefMaxOutcomes>100)
  throw Error('Invalid ROOK self-play configuration');
const base={depth:4,beamWidth:24,maxNodes:budget,maxStates:1200,
  maxSteps:42,includeRanked:true,reverseOnlyOpen:true,
  reverseOpenMaxTileNodes:openTiles,reverseOpenMaxGoals:8,
  reverseOpenMaxProofs:12};
const makeDemo=seed=>new BotDemo(new Engine({mode:'tl',seed,
  rules:{g:0,gincrease:0,b2bcharge_base:3},
  handling:{arr:0,das:1,dcd:0,sdf:20,safelock:false,cancel:false,
    may20g:true,irs:'off',ihs:'off'}}),{placementMode:'atomic'});

function select(demo,open){
  const stats={nodes:0,holds:0,ms:0,rejections:0,offers:0,selections:0};
  for(let turn=0;turn<2;turn++){
    const view=demo.view();
    if(view.visible.next.length!==5)throw Error('Visible NEXT5 contract violated');
    const started=performance.now();
    const report=chooseMove(view.visible,{...base,
      reversePlanner:open&&expertOpen,
      garbageRecovery:open&&expertRecovery,
      garbageRecoveryWeight:recoveryWeight,
      garbageBelief:open&&expertBelief,
      beliefProbes,beliefMaxOutcomes});
    stats.ms+=performance.now()-started;
    stats.nodes+=report.diagnostics.evaluated;
    stats.offers+=report.diagnostics.reversePlans;
    stats.selections+=Number(report.diagnostics.reverseSelectedGoal!==null);
    let lastError=null,didHold=false;
    for(const a of report.ranked){
      const request=a.kind==='hold'
        ?{action:{kind:'hold',mode:a.mode,samePiece:a.samePiece,requiresReanalysis:true}}
        :{action:{kind:'place'},move:a.move,execution:a.execution};
      try{
        demo.prepare(request,view.revision);
        if(a.kind==='hold'){
          if(turn!==0)throw Error('second Hold is forbidden');
          demo.commit(view.revision);stats.holds++;didHold=true;break;
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
  return {kind,pieces,playing:s.playing,reason:s.reason,
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
function pairedGame(swap){
  const kinds=swap?['baseline','opener']:['opener','baseline'];
  const demos=seeds.map(makeDemo),original=demos.map(d=>d.engine.serialize());
  const totals=Array.from({length:2},()=>({nodes:0,holds:0,ms:0,
    rejections:0,offers:0,selections:0,tsd:0,tss:0,mini:0,quad:0,maxBtb:0}));
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
      const moves=[];
      for(let i=0;i<2;i++){
        const decision=select(demos[i],kinds[i]==='opener');
        moves.push(decision);
        for(const key of Object.keys(totals[i]))
          totals[i][key]+=decision[key]??0;
      }
      // Neither player gets to observe the other player's prepared move.
      for(let i=0;i<2;i++){
        const view=demos[i].commit(moves[i].revision),last=view.lastPlacement;
        totals[i].tsd+=Number(last.piece==='t'&&last.spin==='full'&&last.lines===2);
        totals[i].tss+=Number(last.piece==='t'&&last.spin==='full'&&last.lines===1);
        totals[i].mini+=Number(last.spin==='mini'&&last.lines>0);
        totals[i].quad+=Number(last.lines===4);
        totals[i].maxBtb=Math.max(totals[i].maxBtb,demos[i].engine.state.attack.btb);
      }
      for(let from=0;from<2;from++)
        for(const packet of demos[from].engine.state.attack.outbox.splice(0))
          inbound.push({to:1-from,iid:packet.iid,ackiid:packet.ackiid,amt:packet.amt});
      turns++;
      if([6,12,24,48,72,96,120,150].includes(turns))
        checkpoints.push({turns,slots:demos.map(health)});
    }
  }catch(e){error=e instanceof Error?e.message:String(e)}
  if(turns&&!error&&demos.some((d,i)=>d.engine.serialize()===original[i]))
    error='A Tetrp authority did not advance';
  const alive=demos.map(d=>d.engine.state.playing);
  const scored=!error&&turns<limit&&alive[0]!==alive[1];
  return {format:'rook-paired-tetrp-ko/1',swap,kinds,seeds,pps:2.5,
    nodeBudget:budget,extraOpenerCPU:expertOpen,expertLabel,
    expertOpen,expertRecovery,expertBelief,
    beliefProbes,beliefMaxOutcomes,recoveryWeight,
    turns,cap:limit,scored,
    termination:error?'invalid-match':scored?'KO':turns>=limit?'capped':'unresolved',
    error,winner:scored?kinds[alive[0]?0:1]:null,
    checkpoints,slots:demos.map((d,i)=>summary(d,kinds[i],totals[i]))};
}
const results=[pairedGame(false),pairedGame(true)];
for(const row of results)console.log(JSON.stringify(row));
if(process.env.RESULTS_PATH)
  writeFileSync(process.env.RESULTS_PATH,JSON.stringify(results,null,2)+'\n');
if(results.some(r=>r.error))process.exitCode=1;
