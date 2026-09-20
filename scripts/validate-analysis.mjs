// Opt-in private replay audit. Emits aggregate counts only; never writes inputs.
import {readFileSync} from 'node:fs';
import {parseReplay,prepareReplay,Reconstruction} from '../src/replay/index.js';
import {ObservedDraws,visibleState} from '../src/analysis/visible-state.js';
import {prepareKiwi,normalizePlacement,NODE_BUDGET} from '../src/analysis/kiwi.js';
import init,{WasmBot,analyze_pending_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';
if(process.argv.length<3)throw new Error('Usage: node scripts/validate-analysis.mjs <local replay paths...>');
await init({module_or_path:readFileSync(new URL('../vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm',import.meta.url))});
for(const file of process.argv.slice(2)){
  const replay=parseReplay(readFileSync(file,'utf8'));
  const report={variant:replay.variant,streams:0,historyPositions:0,searches:0,persistent:0,pending:0,holds:0,limitations:{},searchMs:[]};
  for(const round of replay.rounds)for(const player of round.players){
    const r=new Reconstruction(prepareReplay(player));report.streams++;
    const history=new ObservedDraws(r.state);let previous=-1,pendingTested=false;
    const inspect=()=>{
      const s=r.state;if(s.stats.pieces===previous)return;previous=s.stats.pieces;report.historyPositions++;
      const hasPending=[...(s.attack?.are??[]),...(s.attack?.pending??[])].some(p=>p.amt>0);
      if(previous%25!==0&&!(hasPending&&!pendingTested)&&previous!==1)return;
      const checkpoint=r.checkpoint(),input=visibleState(s,history.draws);
      try{
        const p=prepareKiwi(input),start=performance.now();let placement;
        if(p.path==='persistent'){
          const b=new WasmBot();try{b.start(JSON.stringify(p.request.start));b.think_nodes(NODE_BUDGET);placement=JSON.parse(b.suggest_json())[0];}finally{b.free();}
          report.persistent++;
        }else{const result=JSON.parse(analyze_pending_json(JSON.stringify(p.request)));placement=result.candidates[0]?.placement;report.pending++;pendingTested=true;}
        report.searchMs.push(performance.now()-start);report.searches++;
        if(normalizePlacement(input,p.visible,placement).useHold)report.holds++;
      }catch(error){
        // Path helper errors may contain a board; retain only their category.
        const message=error.message.startsWith('no Tetrp input path')?'no Tetrp input path':error.message;
        report.limitations[message]=(report.limitations[message]??0)+1;
      }
      if(r.checkpoint()!==checkpoint)throw new Error('Analysis mutated Reconstruction');
    };
    inspect();while(true){const before=r.state;if(!r.advance())break;history.advance(before,r.state,r.transitions);inspect();}
  }
  const timings=report.searchMs.sort((a,b)=>a-b);report.searchMs={min:timings[0],median:timings[Math.floor(timings.length/2)],max:timings.at(-1)};
  console.log(JSON.stringify(report));
}
