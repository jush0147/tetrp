import init,{WasmBot,analyze_pending_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';
import {prepareKiwi,normalizePlacement,NODE_BUDGET} from '../src/analysis/kiwi.js';
let initialized,bot,lastKey,lastResult;
self.onmessage=async({data:{id,state}})=>{
  try{
    const prepared=prepareKiwi(state),key=JSON.stringify(state);
    initialized??=init({module_or_path:new URL('./cold_clear_2_bg.wasm',import.meta.url)});
    await initialized;
    if(key===lastKey&&lastResult){postMessage({id,result:{...lastResult,cached:true}});return;}
    const start=performance.now();let placement,nodes;
    if(prepared.path==='pending-snapshot'){
      bot?.free();bot=null;
      const report=JSON.parse(analyze_pending_json(JSON.stringify(prepared.request)));
      placement=report.candidates[0]?.placement;
      nodes=report.nodes??report.total_nodes??null;
    }else{
      bot??=new WasmBot();
      // Replay seeks are independent roots; never advance a retained DAG using
      // the recorded player's moves. Same-position clicks reuse the result.
      bot.start(JSON.stringify(prepared.request.start));
      nodes=Number(bot.think_nodes(NODE_BUDGET));
      placement=JSON.parse(bot.suggest_json())[0];
    }
    const searchMs=performance.now()-start;
    const move=normalizePlacement(state,prepared.visible,placement);
    lastResult={move,warnings:prepared.warnings,path:prepared.path,nodeBudget:NODE_BUDGET,nodes,searchMs,totalMs:performance.now()-start};
    lastKey=key;postMessage({id,result:lastResult});
  }catch(error){
    bot?.free();bot=null;lastKey=null;lastResult=null;
    const message=String(error?.message??error);
    // The upstream path helper's diagnostic includes a board; keep that out of UI.
    postMessage({id,error:message.startsWith('no Tetrp input path')?'Kiwi 建議在此位置找不到 Tetrp 合法路徑；請選擇其他位置。':message});
  }
};
