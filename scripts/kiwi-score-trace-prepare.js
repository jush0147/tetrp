import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {instrument} from './kiwi-eval-observer-prepare.js';
export function insert(source,anchor,code){assert.equal(source.split(anchor).length,2,anchor);return source.replace(anchor,code+anchor);}
export function instrumentFreestyle(source){
 let s=instrument(source);
 // During search, retain original arithmetic but collect no vectors/logs.
 s=s.replaceAll('audit_points.push(', 'if crate::eval_observer::recording() { audit_points.push(')
    .replace(/audit_points\.push\(([^\n]+)\);/g,'audit_points.push($1); }');
 s=s.replace('audit_cutouts.push(serde_json::json!', 'if crate::eval_observer::recording() { audit_cutouts.push(serde_json::json!')
    .replace('"before":state.board.cols})); }','"before":state.board.cols})); } }');
 assert.equal(s.replace(/\n\/\/ EVAL_OBSERVER_BEGIN\n[\s\S]*?\/\/ EVAL_OBSERVER_END\n/g,''),source,'trace must not change original arithmetic');
 return s+`
#[cfg(eval_observer)]
impl Freestyle {
 pub fn score_paths(&self,options:&BotOptions)->serde_json::Value {
  assert_eq!(options.config.freestyle_weights.softdrop,0.0);
  self.dag.score_paths(|before,next,mv,reward|{
   let mut after=before;let info=after.advance(next,mv);
   crate::eval_observer::start();
   let (value,fresh_reward)=evaluate(&options.config.freestyle_weights,after,&info,0,before.forecast.remaining(),before.forecast.sent);
   let stages=crate::eval_observer::stop();
   assert_eq!(fresh_reward.value.0.to_bits(),reward.value.0.to_bits(),"edge reward replay mismatch");
   serde_json::json!({"reward":reward.value.0,"localEval":value.scalar(),"breakdown":stages,
    "lines":info.lines_cleared,"spin":info.placement.spin,"comboBefore":before.combo,"comboAfter":after.combo,
    "b2bBefore":before.b2b_count,"b2bAfter":after.b2b_count,"pendingBefore":before.forecast.remaining(),"pendingAfter":after.forecast.remaining(),
    "sentBefore":before.forecast.sent,"sentAfter":after.forecast.sent,"toppedOut":after.forecast.topped_out})
  })
 }
}
`;
}
if(process.argv[2]==='install-score'){
 const root=process.argv[3]??'.cache/cc2-wasm-source';
 const p=`${root}/src/bot/freestyle.rs`,s=await readFile(p,'utf8');
 assert.equal(createHash('sha256').update(s).digest('hex'),'9fe27a686c21515eb729af2ec73c4b99cd0ad6201b783fd35319a93c265f03d1');
 await writeFile(p,instrumentFreestyle(s));
 const dag=`${root}/src/dag.rs`;await writeFile(dag,(await readFile(dag,'utf8'))+'\n'+await readFile('tools/cc2-eval-audit/score_paths.rs','utf8'));
 const bot=`${root}/src/bot.rs`;await writeFile(bot,(await readFile(bot,'utf8'))+`
#[cfg(eval_observer)]
impl Bot { pub fn score_paths(&self)->serde_json::Value {match &self.mode {ModeEnum::Freestyle(m)=>m.score_paths(&self.options)}} }
`);
 const analysis=`${root}/src/analysis.rs`;let a=await readFile(analysis,'utf8');
 a=insert(a,'        for (placement, score) in bot.ranked_suggestions() {','        #[cfg(eval_observer)]\n        crate::eval_observer::scenario(root_legal_placements.is_some(),scenario,bot.score_paths());\n');
 a=insert(a,'    Ok(Report {','    #[cfg(eval_observer)]\n    crate::eval_observer::branch(root_legal_placements.is_some(),serde_json::to_value(&candidates).unwrap());\n');
 await writeFile(analysis,a);
 await copyFile('tools/cc2-eval-audit/score_observer.rs',`${root}/src/eval_observer.rs`);
}
