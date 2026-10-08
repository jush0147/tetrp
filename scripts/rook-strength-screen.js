// Reproducible strength screen, NOT a claim of competitive KO strength.
// Bot input: only the fresh Tetrp visibleState projection from BotDemo.view().
// Authority: every Hold, placement, spin, line clear, B2B and attack is executed
// by BotDemo/Tetrp, never by ROOK's hypothetical forecast.
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {chooseMove} from '../src/analysis/rook.js';

const seeds=(process.env.SEEDS??'67020,67021').split(',').map(Number);
const count=Number(process.env.PIECES??120);
const options={depth:Number(process.env.ROOK_DEPTH??4),
  beamWidth:Number(process.env.ROOK_BEAM??24),
  maxNodes:Number(process.env.ROOK_NODES??6000),
  maxStates:Number(process.env.ROOK_STATES??1200),
  maxSteps:42,includeRanked:true,
  spinForecast:process.env.ROOK_SPIN_FORECAST!=='0',
  reversePlanner:process.env.ROOK_REVERSE_PLANNER==='1',
  reverseMaxCandidates:Number(process.env.ROOK_REVERSE_CANDIDATES??250),
  reverseLongMaxCandidates:Number(process.env.ROOK_REVERSE_LONG_CANDIDATES??600),
  reverseLongMaxGoals:Number(process.env.ROOK_REVERSE_LONG_GOALS??15)};
if(!seeds.length||seeds.some(x=>!Number.isSafeInteger(x))||
  !Number.isSafeInteger(count)||count<1||count>1000)throw Error('invalid strength screen');
for(const seed of seeds){
  const engine=new Engine({mode:'tl',seed,rules:{g:0,gincrease:0,b2bcharge_base:3},
    handling:{arr:0,das:1,dcd:0,sdf:20,safelock:false,cancel:false,may20g:true,irs:'off',ihs:'off'}});
  const demo=new BotDemo(engine,{placementMode:'atomic'});
  const original=engine.serialize();
  let pieces=0,holdMoves=0,quads=0,spins=0,attempted=0,elapsed=0;
  const spinByPiece={},spinByKind={},spinByClear={};let peakB2B=0;
  let tsd=0,tss=0,tst=0,tMini=0;
  let reverseProposals=0,reverseSelections=0,reverseCandidates=0;
  while(pieces<count&&!demo.view().stopped){
    let placed=false;
    const start=performance.now();
    for(let decision=0;decision<2&&!placed;decision++){
      const {visible,revision}=demo.view();
      if(visible.next.length!==5)throw Error('leaked or missing NEXT5');
      const report=chooseMove(visible,options);
      reverseProposals+=report.diagnostics.reversePlans;
      reverseSelections+=Number(report.diagnostics.reverseSelectedGoal!==null);
      reverseCandidates+=report.diagnostics.reverseCandidates;
      let prepared=false;
      for(const action of report.ranked){
        const candidate=action.kind==='hold'
          ?{action:{kind:'hold',mode:action.mode,samePiece:action.samePiece,requiresReanalysis:true}}
          :{action:{kind:'place'},move:action.move,execution:action.execution};
        attempted++;
        try{
          demo.prepare(candidate,revision);
          demo.commit(revision);
          if(action.kind==='hold')holdMoves++;
          else {
            pieces++;
            const clear=demo.view().lastPlacement;
            if(clear.lines===4)quads++;
            if(clear.spin!=='none'&&clear.lines>0){
              spins++;
              const name=clear.piece.toUpperCase();
              spinByPiece[name]=(spinByPiece[name]??0)+1;
              spinByKind[clear.spin]=(spinByKind[clear.spin]??0)+1;
              const key=clear.piece.toUpperCase()+':'+clear.spin+':'+clear.lines;
              spinByClear[key]=(spinByClear[key]??0)+1;
              if(clear.piece==='t'&&clear.spin==='full'){
                if(clear.lines===2)tsd++;
                else if(clear.lines===1)tss++;
                else if(clear.lines===3)tst++;
              }
              if(clear.piece==='t'&&clear.spin==='mini')tMini++;
            }
            peakB2B=Math.max(peakB2B,demo.engine.state.attack.btb);
            placed=true;
          }
          prepared=true;break;
        }catch{/* Try next ranked public-state candidate; never move by teleport. */}
      }
      if(!prepared)throw Error('No executable action: '+seed+' piece '+pieces);
    }
    elapsed+=performance.now()-start;
    if(!placed)throw Error('Post-Hold placement missing at '+seed+' piece '+pieces);
    if(engine.serialize()!==original)throw Error('source Tetrp replay mutated');
  }
  const a=demo.engine.state.attack.totals;
  const row={type:'rook-visible-strength-screen',seed,pieces,holds:holdMoves,quads,spins,
    generated:a.generated,sent:a.sent,spinByPiece,spinByKind,spinByClear,tsd,tss,tst,tMini,peakB2B,rawAPP:Number((a.generated/pieces).toFixed(4)),
    sentAPP:Number((a.sent/pieces).toFixed(4)),attempted,
    reverseProposals,reverseSelections,reverseCandidates,
    meanDecisionMs:Math.round(elapsed/pieces),stopped:demo.view().stopped,
    originalUnchanged:engine.serialize()===original,options};
  console.log(JSON.stringify(row));
}
