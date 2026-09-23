import {analyze} from './search.js';
import {generate} from './movegen.js';
import {clone,holdState,place,leaf,stateKey} from './model.js';

export const FRONTIER_LIMITS=Object.freeze({geometryBudget:500000,nodeBudget:50000});
const average=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
// Opt-in experiment: rerank the original best prefix per root, without changing
// the base beam, traversal, budgets or weights. No partially extended ranking.
export function analyzeFrontier(snapshot,options={},limits=FRONTIER_LIMITS){
  if(options.objective&&options.objective!=='sent-safety')throw new Error('NATIVE_FRONTIER_OBJECTIVE_UNSUPPORTED');
  for(const k of ['geometryBudget','nodeBudget'])if(!Number.isSafeInteger(limits[k])||limits[k]<1||limits[k]>1000000)
    throw new Error('NATIVE_FRONTIER_LIMIT_INVALID');
  let published;
  const report=analyze(snapshot,options,ns=>{published=ns;});
  const start=performance.now(),weights=report.config.weights,rules=snapshot.rules;
  const stats={enabled:true,applied:false,reason:'no-eligible-frontier',eligibleRoots:0,extendedRoots:0,
    geometryStates:0,nodes:0,cacheHits:0,changedTop1:false,extraMs:0,limits:{...limits}};
  const finish=()=>{
    stats.extraMs=performance.now()-start;report.totalMs+=stats.extraMs;report.searchMs+=stats.extraMs;
    report.frontierExtension=stats;return report;
  };
  // Narrow initial contract: one packet, publicly known activation, no future
  // packets/hole schedule to condition on after the first reveal.
  const pending=snapshot.attack.pending.filter(p=>p.amt>0);
  if(pending.length!==1||pending[0].activeFrame===null){stats.reason='unsupported-packet-context';return finish();}
  const best=new Map();for(const n of published)if(!best.has(n.root)||n.score>best.get(n.root).score)best.set(n.root,n);
  const ordered=[...best.values()].sort((a,b)=>b.score-a.score||a.root-b.root);
  const eligible=n=>n.outcomes?.some(o=>!o.state.dead)&&n.outcomes.every(o=>o.inserted>0&&o.state.frontier&&o.state.attack.pending.length===0&&
    (o.state.dead||o.state.current&&o.state.next.length>=2));
  stats.eligibleRoots=ordered.filter(eligible).length;
  if(!stats.eligibleRoots)return finish();
  const cache=new Map(),abort=reason=>{throw {frontierAbort:reason};};
  function extend(revealed){
    if(revealed.dead)return {value:leaf(revealed,weights).value,features:null};
    const key=stateKey(revealed);if(cache.has(key)){stats.cacheHits++;return cache.get(key);}
    const state=clone(revealed);state.frontier=false;
    const sources=[state],held=holdState(state,rules);if(held&&!held.dead)sources.push(held);
    let choice;
    for(const source of sources){
      // No new previews are supplied, including after Hold.
      if(source.attack.pending.length||!source.current||!source.next.length)abort('unknown-continuation');
      const generated=generate(source.board,source.current,rules,{maxStates:report.config.rootStateLimit,
        onState(){if(stats.geometryStates>=limits.geometryBudget)return false;stats.geometryStates++;return true;}});
      if(!generated.complete)abort('geometry-budget-or-movegen-limit');
      for(const move of generated.moves){
        if(stats.nodes>=limits.nodeBudget)abort('node-budget');stats.nodes++;
        const out=place(source,move.piece,rules,{framesPerPiece:report.config.framesPerPiece,rootFrame:snapshot.frame,
          scenario:{hole:0,unknownDelay:Infinity}}); // All garbage has already been revealed and drained.
        const l=leaf(out.state,weights),value=out.sent*weights.sent+l.value;
        if(!choice||value>choice.value)choice={value,features:l.features,generated:out.state.attack.totals.generated-source.attack.totals.generated,
          cancelled:out.state.attack.totals.cancelled-source.attack.totals.cancelled,sent:out.sent,btb:out.state.attack.btb};
      }
    }
    if(!choice)abort('incomplete-movegen'); // Not proof of gameplay death.
    cache.set(key,choice);return choice;
  }
  const staged=[];
  try{
    for(let i=0;i<ordered.length;i++){
      const n=ordered[i],candidate=report.candidates[i];
      if(!eligible(n)){staged.push({root:n.root,candidate});continue;}
      const parentReward=n.reward-average(n.outcomes.map(o=>o.sent*weights.sent));
      const extensions=n.outcomes.map(o=>extend(o.state));
      const values=n.outcomes.map((o,j)=>parentReward+o.sent*weights.sent+extensions[j].value);
      staged.push({root:n.root,candidate:{...candidate,score:average(values),worstScore:Math.min(...values),
        features:extensions.map(x=>x.features),frontierExtension:{baselineScore:candidate.score,effectiveDepth:n.depth+1,
          generated:average(extensions.map(x=>x.generated??0)),cancelled:average(extensions.map(x=>x.cancelled??0)),
          sent:average(extensions.map(x=>x.sent??0))}}});
      stats.extendedRoots++;
    }
  }catch(error){
    if(!error.frontierAbort)throw error;
    stats.reason=error.frontierAbort;stats.discardedRoots=stats.extendedRoots;stats.extendedRoots=0;
    return finish(); // Exact original candidates; no candidate execution fallback.
  }
  staged.sort((a,b)=>b.candidate.score-a.candidate.score||a.root-b.root);
  stats.changedTop1=staged[0].root!==ordered[0].root;
  report.candidates=staged.map(x=>x.candidate);stats.applied=true;stats.reason='complete';
  report.model+='; drained-known-packet frontier one-placement reranking';
  return finish();
}
