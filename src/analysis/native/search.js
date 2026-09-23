import {cells} from './board.js';
import {generate} from './movegen.js';
import {fromSnapshot,holdState,scenarios,place,leaf,stateKey} from './model.js';
import {Transpositions} from './tt.js';

export const VERSION='kiwi-native-v0.1';
export const DEFAULTS=Object.freeze({nodeBudget:200000,beamWidth:32,ttCapacity:32768,framesPerPiece:24,
  geometryBudget:100000,rootStateLimit:60000,weights:Object.freeze({sent:1,load:1,coveredEmpty:1,height:1})});
function configuration(options){
  const c={...DEFAULTS,...options,weights:{...DEFAULTS.weights,...options.weights}};
  c.objective=options.objective??'sent-safety';
  if(!['sent-safety','generated-app'].includes(c.objective))throw new Error('NATIVE_OBJECTIVE_INVALID');
  if(c.objective==='generated-app')c.weights={sent:1,load:0,coveredEmpty:0,height:0};
  for(const k of ['nodeBudget','beamWidth','ttCapacity','framesPerPiece','geometryBudget','rootStateLimit'])
    if(!Number.isSafeInteger(c[k])||c[k]<1)throw new Error('NATIVE_CONFIG_INVALID: '+k);
  if(c.nodeBudget>2000000||c.beamWidth>1024||c.ttCapacity>32768||c.rootStateLimit>60000||c.geometryBudget>10000000||c.framesPerPiece>600)
    throw new Error('NATIVE_CONFIG_LIMIT');
  if(Object.values(c.weights).some(v=>!Number.isFinite(v)||v<0))throw new Error('NATIVE_WEIGHT_INVALID');
  return c;
}
function selectBeam(nodes,width){
  nodes.sort((a,b)=>b.score-a.score||a.root-b.root||a.order-b.order);
  const roots=new Set(),selected=[],used=new Set();
  for(const n of nodes)if(!roots.has(n.root)){roots.add(n.root);selected.push(n);used.add(n);}
  for(const n of nodes)if(selected.length<width&&!used.has(n))selected.push(n);
  return selected;
}
/** No Engine, RNG, previous request, or replay object is accepted by this core. */
export function analyze(snapshot,options={},capture){
  const started=performance.now(),config=configuration(options),root=fromSnapshot(snapshot),rules=snapshot.rules;
  const horizon=options.horizon??(root.hold.piece===null?5:6);
  if(!Number.isInteger(horizon)||horizon<1||horizon>6)throw new Error('NATIVE_HORIZON_INVALID');
  const hypotheses=scenarios(root,{...config,horizon}),tt=new Transpositions(config.ttCapacity);
  let nodes=0,geometryStates=0,order=0,completion='finite_visible',stopped=false;
  const rootActions=[],rootGeometryStart=performance.now();
  const enumerate=(state,complete=false,paths=false)=>{
    const r=generate(state.board,state.current,rules,{complete,paths,maxStates:config.rootStateLimit,
      onState(){if(geometryStates>=config.geometryBudget)return false;geometryStates++;return true;}});
    if(!r.complete){completion='geometry_budget';stopped=true;}
    return r.moves;
  };
  const currentMoves=enumerate(root,false,true);
  if(stopped)throw new Error('NATIVE_ROOT_GEOMETRY_LIMIT');
  for(const move of currentMoves)rootActions.push({action:{kind:'place'},move:{piece:move.piece.type,x:move.piece.x,y:Math.ceil(move.piece.y),
    rotation:move.piece.r,useHold:false,cells:cells(move.piece)},execution:{moves:move.path,spin:move.piece.spin}});
  const held=holdState(root,rules),heldMoves=held&&!held.dead?enumerate(held):[];
  if(stopped)throw new Error('NATIVE_ROOT_GEOMETRY_LIMIT');
  const holdIndex=held?rootActions.length:-1;
  if(held)rootActions.push({action:{kind:'hold',mode:root.hold.piece===null?'empty':'occupied',
    samePiece:(root.hold.piece??root.next[0])===root.current.type,requiresReanalysis:true},move:null});
  if(!rootActions.length)throw new Error('NATIVE_NO_ROOT_ACTION');
  const geometryMs=performance.now()-rootGeometryStart;
  function evaluate(parent,source,move,rootId,depth){
    if(nodes+hypotheses.length>config.nodeBudget){completion='node_budget';stopped=true;return null;}
    const outcomes=hypotheses.map(scenario=>{nodes++;return place(source,move.piece,rules,{framesPerPiece:config.framesPerPiece,rootFrame:root.frame,scenario});});
    const app=config.objective==='generated-app';
    const gain=o=>app?o.state.attack.totals.generated-source.attack.totals.generated:o.sent*config.weights.sent;
    const reward=parent.reward+outcomes.reduce((n,o)=>n+gain(o),0)/outcomes.length;
    // APP uses generated attack (including cancellation), per speculative lock.
    // Hold itself is not a placement. Retain the existing terminal death penalty.
    const values=outcomes.map(o=>(parent.reward+gain(o))/(app?depth:1)+leaf(o.state,config.weights).value);
    const terminal=outcomes.some(o=>o.state.dead||o.state.frontier)||depth>=horizon;
    const score=values.reduce((a,b)=>a+b,0)/values.length;
    const state=outcomes[0].state;
    const key=rootId+'|'+depth+'|'+stateKey(state);
    // Only deterministic continuations are transposed. Frontier scores can
    // represent several distinct outcomes, so they cannot use the first state.
    if(!terminal&&tt.dominated(key,reward))return null;
    return {state,reward,score,root:rootId,terminal,depth,order:order++,worst:Math.min(...values),
      ...(capture?{outcomes}:{}),
      features:outcomes.map(o=>leaf(o.state,config.weights).features)};
  }
  const parent={reward:0};let layer=[];
  for(let i=0;i<currentMoves.length;i++){
    const n=evaluate(parent,root,currentMoves[i],i,1);if(stopped)throw new Error('NATIVE_ROOT_BUDGET_INSUFFICIENT');if(n)layer.push(n);
  }
  if(held){
    if(held.dead)layer.push({state:held,reward:0,score:-1e6,root:holdIndex,terminal:true,depth:1,order:order++,worst:-1e6,features:[]});
    else for(const move of heldMoves){const n=evaluate(parent,held,move,holdIndex,1);if(stopped)throw new Error('NATIVE_ROOT_BUDGET_INSUFFICIENT');if(n)layer.push(n);}
  }
  if(!layer.length)throw new Error('NATIVE_NO_ROOT_ACTION');
  const summarize=ns=>{
    capture?.(ns,rootActions);
    const best=new Map();for(const n of ns)if(!best.has(n.root)||n.score>best.get(n.root).score)best.set(n.root,n);
    return [...best.values()].sort((a,b)=>b.score-a.score||a.root-b.root).map(n=>({...rootActions[n.root],score:n.score,worstScore:n.worst,
      features:n.features,depth:n.depth,frontier:n.terminal}));
  };
  let candidates=summarize(layer),completedDepth=1;
  layer=selectBeam(layer,config.beamWidth);
  for(let depth=2;depth<=horizon&&!layer.every(n=>n.terminal);depth++){
    const next=[];
    for(const n of layer){
      if(n.terminal){next.push(n);continue;}
      const sources=[n.state],h=holdState(n.state,rules);if(h&&!h.dead)sources.push(h);
      let produced=false,legalMoves=0;
      for(const source of sources){
        const moves=enumerate(source);if(stopped)break;legalMoves+=moves.length;
        for(const move of moves){const child=evaluate(n,source,move,n.root,depth);if(stopped)break;if(child){next.push(child);produced=true;}}
        if(stopped)break;
      }
      if(stopped)break;
      // Ordinary-regime movegen / pruning failure is NOT proven gameplay death.
      if(!produced&&!legalMoves)next.push({...n,terminal:true});
    }
    if(stopped)break; // Do not publish a partially evaluated comparison layer.
    candidates=summarize(next);completedDepth=depth;layer=selectBeam(next,config.beamWidth);
  }
  return {core:VERSION,config:{...config,horizon},candidates,nodes,nodeBudget:config.nodeBudget,geometryStates,
    geometryMs,searchMs:performance.now()-started-geometryMs,totalMs:performance.now()-started,
    completion,completedDepth,ttHits:tt.hits,ttEntries:tt.size,scenarios:hypotheses.length,
    unknownActivationPackets:root.attack.pending.filter(p=>!p.active&&p.activeFrame===null).length,
    model:'finite-visible; first-uncertain-reveal cutoff; equal-weight scenarios',
    limitations:['Placement-level clock; authority must validate timed execution.',
      'Movegen uses shortest ordinary-regime paths, not exhaustive rotation-history or timed paths.',
      'Bounded JS data structures; 64 MiB physical heap ceiling is not certified.']};
}
export function recommendation(report,index=0){
  if(!Number.isInteger(index)||index<0||!report.candidates[index])throw new Error('NATIVE_NO_MORE_CANDIDATES');
  return {...report.candidates[index],candidateIndex:index,candidateCount:report.candidates.length,
    core:report.core,path:'native',nodeBudget:report.nodeBudget,nodes:report.nodes,completion:report.completion,
    geometryMs:report.geometryMs,searchMs:report.searchMs,totalMs:report.totalMs,
    unknownActivationPackets:report.unknownActivationPackets,completedDepth:report.completedDepth,
    warnings:['Native Kiwi 候選版；尚未證明優於現有 Kiwi。','有限可見搜尋；垃圾情境在首次未知資訊分歧截斷。',
      '深層搜尋為落子／幾何模型，提交仍由 Tetrp 驗證實際時序。']};
}
