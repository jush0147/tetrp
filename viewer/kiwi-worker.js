import init,{analyze_snapshot_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';
import {prepareKiwi,normalizeRankedRecommendation,normalizeSnapshotError,NODE_BUDGET} from '../src/analysis/kiwi.js';
import {analyze,recommendation} from '../src/analysis/native/search.js';
let initialized,lastKey,lastResult,lastPrepared,lastReport;
self.onmessage=async({data:{id,state,candidateIndex=0,core='legacy'}})=>{
  try{
    const key=JSON.stringify([core,state]);
    if(key===lastKey&&lastResult&&candidateIndex===lastResult.candidateIndex){postMessage({id,result:{...lastResult,cached:true}});return;}
    if(core==='native'&&state.rules.mode==='tl'){
      const cached=key===lastKey&&lastReport;
      const report=cached?lastReport:analyze(state);
      lastResult={...recommendation(report,candidateIndex),cached:Boolean(cached)};
      lastReport=report;lastKey=key;postMessage({id,result:lastResult});return;
    }
    initialized??=init({module_or_path:new URL('./cold_clear_2_bg.wasm',import.meta.url)});
    await initialized;
    const cached=key===lastKey&&lastReport;
    const start=performance.now(),prepared=cached?lastPrepared:prepareKiwi(state),geometryMs=performance.now()-start;
    const searchStart=performance.now(),report=cached?lastReport:JSON.parse(analyze_snapshot_json(JSON.stringify(prepared.request)));
    const searchMs=performance.now()-searchStart;
    const normalized=normalizeRankedRecommendation(state,prepared,report,candidateIndex);
    lastResult={...normalized,warnings:prepared.warnings,path:'snapshot',nodeBudget:NODE_BUDGET,nodes:report.nodes,
      cached:Boolean(cached),
      completion:report.completion,unknownActivationPackets:report.unknown_activation_packets,
      geometryMs,searchMs,totalMs:performance.now()-start};
    lastKey=key;lastPrepared=prepared;lastReport=report;postMessage({id,result:lastResult});
  }catch(error){
    lastKey=null;lastResult=null;lastPrepared=null;lastReport=null;
    const e=normalizeSnapshotError(error);
    postMessage({id,error:`${e.code}: ${e.message}`});
  }
};
