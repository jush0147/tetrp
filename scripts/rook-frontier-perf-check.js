// Compare a previous unoptimized frontier implementation against the current
// implementation on IDENTICAL legitimate Tetrp public snapshots. No hidden
// bag tail or opponent state enters either chooser. Timing is descriptive,
// not a CPU-adjusted strength claim; outputs must match exactly.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {enumerateReachable} from '../src/analysis/rook.js';

const legacyPath=process.env.ROOK_COMPARE_BASE;
if(!legacyPath)throw Error('Set ROOK_COMPARE_BASE to pre-optimization git worktree');
const legacy=await import(pathToFileURL(
  path.join(legacyPath,'src/analysis/rook.js')).href);
const current=await import('../src/analysis/rook.js');

const seeds=[67310,67311,67312,67313];
const samples=[];
for(const seed of seeds){
  const engine=new Engine({mode:'tl',seed,rules:{g:0,gincrease:0,
    b2bcharge_base:3}});
  const demo=new BotDemo(engine,{placementMode:'atomic'});
  for(let step=0;step<5;step++){
    if(step===0||step===2||step===4){
      const view=demo.view();
      samples.push({seed,step,publicState:structuredClone(view.visible)});
    }
    const view=demo.view(),v=view.visible;
    const landings=enumerateReachable(v.board,v.current,v.rules,
      {maxStates:600,maxSteps:42});
    if(!landings.length)throw Error('Could not generate legal setup lock');
    const move=landings[Math.min(landings.length-1,(seed+step*7)%landings.length)];
    const p=move.piece;
    const req={action:{kind:'place'},move:{
      piece:p.type,x:p.x,y:Math.ceil(p.y),rotation:p.r,
      useHold:false,cells:(await import('../src/board.js'))
        .cells(p).map(([x,y])=>[x,Math.ceil(y)])
    },execution:{moves:move.path,spin:move.spin}};
    demo.prepare(req,view.revision);
    demo.commit(view.revision);
    if(!demo.engine.state.playing)break;
  }
}
const configs=[
  {name:'frontier',optionFrontierSlots:3,optionFrontierMaxScoreGap:70},
  {name:'baseline',optionFrontierSlots:0}
];
const common={depth:4,beamWidth:16,maxNodes:2200,maxStates:700,
  maxSteps:42,spinForecast:false,futureReachableProbes:3,
  includeRanked:true,traceRootScores:true};
let samplesChecked=0;
const rows=[];
for(const cfg of configs){
  let baselineMs=0,optimizedMs=0,checked=0;
  for(const entry of samples){
    const before=structuredClone(entry.publicState);
    let start=performance.now();
    const old=legacy.chooseMove(entry.publicState,{...common,...cfg});
    baselineMs+=performance.now()-start;
    start=performance.now();
    const now=current.chooseMove(entry.publicState,{...common,...cfg});
    optimizedMs+=performance.now()-start;
    try{assert.deepEqual(now,old);}
    catch(e){throw Error('Policy or diagnostics drift seed='+entry.seed+
      ',step='+entry.step+',mode='+cfg.name+'\n'+e.message);}
    assert.deepEqual(entry.publicState,before);
    checked++;samplesChecked++;
  }
  rows.push({mode:cfg.name,states:checked,legacyMs:+baselineMs.toFixed(2),
    optimizedMs:+optimizedMs.toFixed(2),
    cpuRatio:+(optimizedMs/baselineMs).toFixed(3),
    identicalReports:checked});
}
console.log(JSON.stringify({format:'rook-frontier-evaluator-reuse/1',
  independentInitialSeeds:seeds.length,totalIdenticalReports:samplesChecked,
  samePublicState:true,comparisons:rows},null,2));
