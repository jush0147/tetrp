import init,{analyze_snapshot_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';
import {prepareKiwi,normalizeRecommendation,normalizeSnapshotError,NODE_BUDGET} from '../src/analysis/kiwi.js';
let initialized,lastKey,lastResult;
self.onmessage=async({data:{id,state}})=>{
  try{
    const key=JSON.stringify(state);
    if(key===lastKey&&lastResult){postMessage({id,result:{...lastResult,cached:true}});return;}
    initialized??=init({module_or_path:new URL('./cold_clear_2_bg.wasm',import.meta.url)});
    await initialized;
    const start=performance.now(),prepared=prepareKiwi(state),geometryMs=performance.now()-start;
    const searchStart=performance.now(),report=JSON.parse(analyze_snapshot_json(JSON.stringify(prepared.request)));
    const searchMs=performance.now()-searchStart;
    const normalized=normalizeRecommendation(state,prepared,report);
    lastResult={...normalized,warnings:prepared.warnings,path:'snapshot',nodeBudget:NODE_BUDGET,nodes:report.nodes,
      completion:report.completion,unknownActivationPackets:report.unknown_activation_packets,
      geometryMs,searchMs,totalMs:performance.now()-start};
    lastKey=key;postMessage({id,result:lastResult});
  }catch(error){
    lastKey=null;lastResult=null;
    const e=normalizeSnapshotError(error);
    postMessage({id,error:`${e.code}: ${e.message}`});
  }
};
