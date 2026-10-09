// Reproducible OFFLINE search scaling on the EXACT SAME public observations.
// Never invent a future bag, hidden hole, oracle landing, or KO outcome.
// Obtain varied boards only by playing legal Tetrp actions from public state.
import {performance} from 'node:perf_hooks';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {chooseMove} from '../src/analysis/rook.js';
import {actionSignature} from '../src/analysis/rook-disagreement.js';

const env=process.env;
const parseList=(raw,{min,max}={})=>{
  const xs=raw.split(',').map(s=>s.trim());
  if(!xs.length||xs.some(x=>!/^\d+$/.test(x)))throw Error('Invalid comma list: '+raw);
  const ns=xs.map(Number);
  if(ns.some(x=>!Number.isSafeInteger(x)||x<(min??0)||x>(max??Infinity))||
     ns.length!==new Set(ns).size)throw Error('Duplicate, unsafe, or out-of-range list');
  return ns;
};
const budgets=parseList(env.BUDGETS??'6000,12000,24000,48000',{min:1,max:2000000});
const seeds=parseList(env.SEEDS??'67020,67023',{min:0});
const turns=parseList(env.SAMPLE_TURNS??'0,4,8',{min:0,max:64});
if(!budgets.includes(6000)||budgets.length>8||seeds.length>8||turns.length>12)
  throw Error('Budget screen requires 6000 baseline and bounded workload');
const baseline=6000;
const base={depth:4,beamWidth:24,maxStates:1200,maxSteps:42,
  includeRanked:true,reverseOnlyOpen:true,
  reverseOpenMaxTileNodes:1200,reverseOpenMaxGoals:8,
  reverseOpenMaxProofs:12,reversePlanner:false};
const makeDemo=seed=>new BotDemo(new Engine({mode:'tl',seed,
  rules:{g:0,gincrease:0,b2bcharge_base:3},
  handling:{arr:0,das:1,dcd:0,sdf:20,safelock:false,cancel:false,
    may20g:true,irs:'off',ihs:'off'}}),{placementMode:'atomic'});

function advancePublicPiece(demo){
  for(let turn=0;turn<2;turn++){
    const {visible,revision}=demo.view();
    const report=chooseMove(visible,{...base,maxNodes:baseline});
    let held=false;
    let error=null;
    for(const a of report.ranked){
      const request=a.kind==='hold'
        ?{action:{kind:'hold',mode:a.mode,samePiece:a.samePiece,requiresReanalysis:true}}
        :{action:{kind:'place'},move:a.move,execution:a.execution};
      try{
        demo.prepare(request,revision);
        demo.commit(revision);
        if(a.kind==='hold'){held=true;break;}
        return true;
      }catch(e){error=e;}
    }
    if(!held||turn!==0)
      throw Error('Could not legally advance public Tetrp sample: '+error?.message);
  }
  throw Error('No legal placement after Hold');
}
const percentile=(values,p)=>{
  if(!values.length)return null;
  const ordered=values.slice().sort((a,b)=>a-b);
  const at=(ordered.length-1)*p,lo=Math.floor(at),hi=Math.ceil(at);
  return ordered[lo]+(ordered[hi]-ordered[lo])*(at-lo);
};
const actionOf=report=>actionSignature(report);
const rows=[];
for(const seed of seeds){
  const demo=makeDemo(seed);
  const original=demo.engine.serialize();
  const targets=new Set(turns);
  const last=Math.max(...turns);
  for(let turn=0;turn<=last;turn++){
    if(demo.view().stopped)throw Error('KO before sample turn '+turn+' seed '+seed);
    const state=demo.view().visible;
    if(targets.has(turn)){
      const originalVisible=JSON.stringify(state);
      const local=[];
      for(const budget of budgets){
        const before=performance.now();
        const r=chooseMove(state,{...base,maxNodes:budget,
          traceRootSurvival:true});
        const ms=performance.now()-before;
        if(JSON.stringify(state)!==originalVisible)throw Error('Bot mutated public state');
        local.push({seed,turn,budget,
          evaluated:r.diagnostics.evaluated,
          utilization:r.diagnostics.evaluated/budget,
          budgetReached:r.diagnostics.evaluated>=budget,
          selected:actionOf(r),
          searchedPly:r.rootSurvival.length,
          rootsByPly:r.rootSurvival.map(x=>x.roots.length),
          ranked:r.ranked.length,
          forwardProbes:r.diagnostics.futureProbes,
          searchMs:Math.round(ms*100)/100});
      }
      const root=local.find(r=>r.budget===baseline).selected;
      for(const row of local)rows.push({...row,changedVs6000:row.selected!==root});
    }
    if(turn<last)advancePublicPiece(demo);
  }
  if(demo.engine.serialize()===original)throw Error('Authority did not progress');
}
const summary=budgets.map(budget=>{
  const list=rows.filter(r=>r.budget===budget),times=list.map(r=>r.searchMs);
  return {budget,positions:list.length,
    evaluatedMean:list.reduce((s,r)=>s+r.evaluated,0)/list.length,
    evaluatedMin:Math.min(...list.map(r=>r.evaluated)),
    evaluatedMax:Math.max(...list.map(r=>r.evaluated)),
    atCap:list.filter(r=>r.budgetReached).length,
    changedVs6000:list.filter(r=>r.changedVs6000).length,
    msMedian:percentile(times,.5),msP95:percentile(times,.95),
    deepestPlyMax:Math.max(...list.map(r=>r.searchedPly))};
});
console.log(JSON.stringify({format:'rook-budget-public-state-profile/1',
  budgets,seeds,turns,positions:seeds.length*turns.length,
  authority:'Tetrp atomic; each snapshot is independently player-visible NEXT5',
  disclaimer:'No KO claim; maxNodes is a CAP, not guaranteed work or equivalent compute',
  summary,rows}));
