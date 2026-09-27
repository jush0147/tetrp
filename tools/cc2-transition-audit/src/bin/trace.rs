use cold_clear_2::{bot::BotConfig,data::*,forecast::Forecast,tbp::{Start,Randomizer},tetrio,
    try_create_bot_with_context,transition_audit_observer as observer,dag_replay_observer as dag};
use serde::Deserialize;
use serde_json::{json,Value};
use std::{io::{self,BufRead},sync::Arc};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Step {placement:Placement,use_hold:bool}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {id:String,start:Start,rules:TetrioRules,placement:Placement,steps:Vec<Step>,
 frame:u32,cadence:u32,multiplier:f64,margin:u32,rate:f64,pieces:u32,sent:u32,incoming:Vec<(u32,u32)>,scenario:u32}
fn state_json(s:&GameState)->Value{json!({"cols":s.board.cols.map(|c|c.to_string()),"garbageRows":s.board.garbage_rows.to_string(),
 "combo":s.combo,"btb":if s.back_to_back{u32::from(s.b2b_count)+1}else{0},"reserve":s.reserve,"forecast":s.forecast.transition_audit_readout()})}
fn run(r:Input)->Result<Value,String>{
 r.start.validate()?;if r.start.queue.len()!=6||!matches!(r.start.randomizer,Randomizer::Unknown)||r.steps.len()!=4||r.cadence!=24{return Err("finite four-step public-prefix contract".into());}
 if r.steps[0].placement!=r.placement{return Err("first placement mismatch".into());}
 let mut f=Forecast::new_timed_with_clock(&r.incoming,r.pieces,r.sent,r.cadence,r.frame,r.multiplier,r.margin,r.rate,r.scenario)?;
 f.set_opener_phase_pieces(r.rules.opener_phase_pieces);
 let mut bot=try_create_bot_with_context(r.start,Arc::new(BotConfig::review_h9_h12()),r.rules,false)?;bot.set_forecast(f);dag::reset();
 let mut steps=Vec::new();let mut max_depth=0;
 for step in r.steps {
  let mut remaining=4000;
  for _ in 0..100 {
   if remaining==0{break;}let stats=bot.do_work_limited(remaining);remaining-=stats.nodes;
   max_depth=max_depth.max(stats.max_depth);assert_eq!(stats.speculative_expansions,0,"unknown tail expanded");
   if stats.budget_exhausted||stats.nodes==0{break;}
  }
  let before=state_json(&bot.state());let multiplier=bot.state().forecast.next_attack_multiplier();observer::reset();
  let p=Placement{location:step.placement.location.canonical_form(),spin:step.placement.spin};
  let info=bot.try_play(p,step.use_hold)?;let events=observer::take();let state=bot.state();
  let attack=tetrio::attack_with_multiplier_and_rules(&info,multiplier,state.rules);
  steps.push(json!({"before":before,"after":state_json(&state),"pieces":bot.player_pieces(),
    "placement":info.placement,"cells":info.placement.location.cells(),"clear":{"lines":info.lines_cleared,"garbageRows":info.garbage_cleared,"allClear":info.perfect_clear},
    "packets":attack.packets(),"generated":attack.total,"lockMultiplier":multiplier,"events":events}));
 }
 Ok(json!({"id":r.id,"steps":steps,"dag":dag::counts(),"maxDepth":max_depth}))
}
fn main(){for line in io::stdin().lock().lines(){let result=match line.map_err(|e|e.to_string()).and_then(|s|serde_json::from_str::<Input>(&s).map_err(|e|e.to_string())){
 Ok(r)=>{let id=r.id.clone();run(r).unwrap_or_else(|e|json!({"id":id,"error":e}))},Err(e)=>json!({"error":e})};println!("{}",result);}}
