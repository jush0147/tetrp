// Opt-in local audit. Reports aggregates only; never publishes replay content.
import {readFileSync} from 'node:fs';
import {parseReplay,prepareReplay,Reconstruction} from '../src/replay/index.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {prepareKiwi,normalizeRecommendation,normalizeSnapshotError} from '../src/analysis/kiwi.js';
import init,{analyze_snapshot_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';
if(process.argv.length<3)throw new Error('Usage: node scripts/validate-analysis.mjs <local replay paths...>');
await init({module_or_path:readFileSync(new URL('../vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm',import.meta.url))});
for(const file of process.argv.slice(2)){
 const replay=parseReplay(readFileSync(file,'utf8'));
 const report={variant:replay.variant,streams:0,positions:0,searches:0,pending:0,holds:0,limitations:{},geometryMs:[],searchMs:[]};
 for(const round of replay.rounds)for(const player of round.players){
  const r=new Reconstruction(prepareReplay(player));report.streams++;let previous=-1,pendingTested=false;
  const inspect=()=>{
   const s=r.state;if(s.stats.pieces===previous)return;previous=s.stats.pieces;report.positions++;
   const pending=[...(s.attack?.are??[]),...(s.attack?.pending??[])].some(p=>p.amt>0);
   // Per stream: initial root, first placement, first successful pending root.
   if(previous>1&&(!pending||pendingTested))return;
   const checkpoint=r.checkpoint(),input=visibleState(s);
   try{
    const start=performance.now(),p=prepareKiwi(input),ready=performance.now();
    const result=JSON.parse(analyze_snapshot_json(JSON.stringify(p.request)));report.searchMs.push(performance.now()-ready);report.geometryMs.push(ready-start);
    const normalized=normalizeRecommendation(input,p,result);report.searches++;
    if(pending){report.pending++;pendingTested=true;}if(normalized.action.kind==='hold')report.holds++;
   }catch(error){const code=normalizeSnapshotError(error).code;report.limitations[code]=(report.limitations[code]??0)+1;}
   if(r.checkpoint()!==checkpoint)throw new Error('Analysis mutated Reconstruction');
  };
  inspect();while(r.advance())inspect();
 }
 for(const key of ['geometryMs','searchMs']){const a=report[key].sort((a,b)=>a-b);report[key]={min:a[0],median:a[Math.floor(a.length/2)],max:a.at(-1)};}
 console.log(JSON.stringify(report));
}
