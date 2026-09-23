// Diagnostic instrumentation of the EXACT current production search source.
// No algorithm, budget, traversal order, scoring or policy output is changed.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {leaf} from '../src/analysis/native/model.js';
import {cells} from '../src/analysis/native/board.js';
let instrumented;
async function load(){
  if(instrumented)return instrumented;
  const file=new URL('../src/analysis/native/search.js',import.meta.url),original=await readFile(file,'utf8');
  let source=original.replace(/from '\.\/([^']+)'/g,(_,p)=>`from '${new URL(p,file).href}'`);
  const replace=(before,after)=>{
    if(source.split(before).length!==2)throw new Error('Audit instrumentation source drift: '+before);
    source=source.replace(before,after);
  };
  replace('function selectBeam(nodes,width){','function selectBeam(nodes,width,observer){');
  replace('  return selected;','  observer?.beam({nodes,selected,width});\n  return selected;');
  replace('export function analyze(snapshot,options={}){','export function analyze(snapshot,options={},observer){');
  source=source.replaceAll('selectBeam(layer,config.beamWidth)','selectBeam(layer,config.beamWidth,observer)');
  source=source.replaceAll('selectBeam(next,config.beamWidth)','selectBeam(next,config.beamWidth,observer)');
  replace("    if(!r.complete){completion='geometry_budget';stopped=true;}",
    "    observer?.geometry({state,states:r.states,moves:r.moves.length,complete:r.complete});\n    if(!r.complete){completion='geometry_budget';stopped=true;}");
  replace('    if(!terminal&&tt.dominated(key,reward))return null;',
    '    if(!terminal&&tt.dominated(key,reward)){observer?.tt({rootId,depth,parent,score});return null;}');
  replace('    return {state,reward,score,root:rootId,terminal,depth,order:order++,worst:Math.min(...values),',
    '    const node={state,reward,score,root:rootId,terminal,depth,order:order++,worst:Math.min(...values),');
  replace('      features:outcomes.map(o=>leaf(o.state,config.weights).features)};',
    '      features:outcomes.map(o=>leaf(o.state,config.weights).features)};\n    observer?.node({node,parent,source,move,outcomes});return node;');
  replace('  const summarize=ns=>{','  const summarize=ns=>{\n    observer?.summary({nodes:ns,roots:rootActions});');
  replace('    if(stopped)break; // Do not publish a partially evaluated comparison layer.',
    '    if(stopped){observer?.discard({depth,nodes:next});break;} // Original partial-layer discard.');
  const hash=createHash('sha256').update(original).digest('hex');
  const output=resolve('.cache/ft7-decision-audit/instrumented-search.mjs');await mkdir(resolve('.cache/ft7-decision-audit'),{recursive:true});
  await writeFile(output,source);instrumented={module:await import(pathToFileURL(output).href),hash};return instrumented;
}
const status=(s,rules)=>({combo:s.attack.combo,btb:s.attack.btb,b2bCount:Math.max(0,s.attack.btb-1),
  b2bActive:s.attack.btb>0,surgeCharge:Math.max(0,s.attack.btb-rules.b2bcharge_at+rules.b2bcharge_base),
  surgeCharged:s.attack.btb>rules.b2bcharge_at,pending:s.attack.pending.reduce((n,p)=>n+p.amt,0)});
export async function auditSearch(snapshot,options={}){
  const {module,hash}=await load(),nodes=[],beams=[],summaries=[],geometry=[],ttPrunes={},discarded=[];
  const rules=snapshot.rules;
  const report=module.analyze(snapshot,options,{
    node:({node,parent,source,move,outcomes})=>{
      const immediate=outcomes.map(o=>({generated:o.state.attack.totals.generated-source.attack.totals.generated,
        cancelled:o.state.attack.totals.cancelled-source.attack.totals.cancelled,sent:o.sent,inserted:o.inserted,
        clear:o.clear,after:status(o.state,rules),features:leaf(o.state,{load:1,coveredEmpty:1,height:1}).features,
        dead:o.state.dead,frontier:o.state.frontier}));
      nodes.push({id:node.order,parent:parent.order??null,root:node.root,depth:node.depth,score:node.score,reward:node.reward,
        terminal:node.terminal,before:status(source,rules),piece:move.piece.type,x:move.piece.x,y:Math.ceil(move.piece.y),
        rotation:move.piece.r,cells:cells(move.piece),spin:move.piece.spin,
        held:parent.state?source.hold.piece!==parent.state.hold.piece||source.hold.locked!==parent.state.hold.locked:null,
        immediate});
    },
    beam:({nodes:ns,selected,width})=>beams.push({width,input:ns.length,selected:selected.map(n=>n.order),
      dropped:ns.filter(n=>!selected.includes(n)).map(n=>n.order),roots:new Set(ns.map(n=>n.root)).size}),
    summary:({nodes:ns,roots})=>{
      const best=new Map();for(const n of ns)if(!best.has(n.root)||n.score>best.get(n.root).score)best.set(n.root,n);
      summaries.push({roots:structuredClone(roots),best:[...best.values()].sort((a,b)=>b.score-a.score||a.root-b.root).map(n=>({root:n.root,node:n.order,score:n.score}))});
    },
    geometry:({states,moves,complete})=>geometry.push({states,moves,complete}),
    tt:({rootId,depth})=>{const k=rootId+':'+depth;ttPrunes[k]=(ttPrunes[k]??0)+1;},
    discard:({depth,nodes:ns})=>discarded.push({depth,nodes:ns.map(n=>n.order)}),
  });
  return {sourceHash:hash,report,nodes,beams,summaries,geometry,ttPrunes,discarded};
}

// node scripts/kiwi-audit-search.js <audit-or-snapshot.json> [output.json] [geometryBudget]
// Offline diagnosis only. This module is not imported by the bot or arena.
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  if(!process.argv[2])throw new Error('Expected a PublicSnapshot or audit JSON file');
  const input=JSON.parse(await readFile(process.argv[2],'utf8'));
  const snapshot=input.snapshot??input;
  const options=process.argv[4]?{geometryBudget:Number(process.argv[4])}:{};
  const result={snapshot,...await auditSearch(snapshot,options)};
  const output=process.argv[3]??'.cache/ft7-decision-audit/search-trace.json';
  await writeFile(output,JSON.stringify(result));
  console.log(JSON.stringify({output,sourceHash:result.sourceHash,completedDepth:result.report.completedDepth,
    completion:result.report.completion,top1:result.report.candidates[0]}));
}
