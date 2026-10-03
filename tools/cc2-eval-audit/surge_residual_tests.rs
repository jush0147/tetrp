#[cfg(test)]
mod surge_residual_gate_tests {
 use super::*;
 #[test]
 fn config_full_eval_units_and_release_zero() {
  let config=crate::bot::BotConfig::review_h9_h12();
  assert_eq!(config.freestyle_weights.h3_surge_bank_value,if cfg!(surge_residual){0.5}else{0.0});
  assert_eq!(config.freestyle_weights.h3_b2b_charge_value,0.0);
  assert_eq!(config.freestyle_weights.has_back_to_back,0.5);
  assert_eq!(config.freestyle_weights.wasted_t,-1.5);
  if let Ok(path)=std::env::var("KIWI_CONFIG_OUTPUT") {std::fs::write(path,serde_json::to_string_pretty(&config).unwrap()).unwrap();}
  let start:crate::tbp::Start=serde_json::from_value(serde_json::json!({"board":[],"queue":["I","T","S","Z","J","L"],"hold":"O","combo":0,"back_to_back":false})).unwrap();
  let initial=crate::try_create_bot_with_context(start,std::sync::Arc::new(config.clone()),TetrioRules::default(),false).unwrap().state();
  let mut zero=config.freestyle_weights.clone();zero.h3_surge_bank_value=0.0;
  let mut on=zero.clone();on.h3_surge_bank_value=0.5;
  let fixtures:Vec<serde_json::Value>=serde_json::from_str(&std::fs::read_to_string(std::env::var("SURGE_FIXTURES").unwrap()).unwrap()).unwrap();
  for f in fixtures {
   for dead in [false,true] {
    let mut state=initial;let raw=f["rawB2B"].as_u64().unwrap() as u32;
    state.back_to_back=raw>0;state.b2b_count=raw.saturating_sub(1) as u16;
    state.rules.b2b_charging=f["charging"].as_bool().unwrap();state.rules.b2b_charge_base=f["base"].as_u64().unwrap() as u32;
    let pending=f["pending"].as_u64().unwrap() as u32;
    let packets=if pending>0 {vec![(pending,1)]}else{vec![]};
    state.forecast=crate::forecast::Forecast::new_timed_with_clock(&packets,30,0,24,0,f["multiplier"].as_f64().unwrap(),10800,0.0,0).unwrap();
    state.forecast.topped_out=dead;
    let info=PlacementInfo {placement:Placement {location:PieceLocation {piece:Piece::I,rotation:Rotation::North,x:4,y:3},spin:Spin::None},lines_cleared:0,garbage_cleared:0,combo:0,back_to_back:false,b2b_count_before:0,b2b_count_after:state.b2b_count as u32,b2b_broken:false,perfect_clear:false};
    let (a,ar)=evaluate(&zero,state,&info,0,pending,0);let (b,br)=evaluate(&on,state,&info,0,pending,0);
    assert_eq!(ar.value,br.value,"Residual must not change edge Reward");
    let amount=if cfg!(surge_residual) {f["surgeGenerated"].as_u64().unwrap() as f32}else{h3_inventory(state.back_to_back,state.b2b_count,state.rules).1 as f32};
    let expected=if dead {0.0}else{0.5*amount};
    assert!((b.value.0-a.value.0-expected).abs()<0.0002,"Authority units mismatch: {:?}",f);
    // Advance an O single (one nonempty row remains), exercising actual transition.
    state.forecast.topped_out=false;state.board.cols=[1;10];state.board.cols[4]=0;state.board.cols[5]=0;
    let released=state.advance(Piece::O,Placement {location:PieceLocation {piece:Piece::O,rotation:Rotation::North,x:4,y:0},spin:Spin::None});
    assert_eq!(released.lines_cleared,1);assert!(!released.perfect_clear);assert!(!state.back_to_back);
    let (a,ar)=evaluate(&zero,state,&info,0,pending,0);let (b,br)=evaluate(&on,state,&info,0,pending,0);
    assert_eq!(a.value,b.value,"Released bank must have zero residual");assert_eq!(ar.value,br.value);
   }
  }
 }
}
