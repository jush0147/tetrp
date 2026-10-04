#[cfg(test)]
mod surge_residual_gate_tests {
 use super::*;
 #[test]
 fn btb_clear_config_and_full_evaluator_delta() {
  let config=crate::bot::BotConfig::review_h9_h12();
  let normal=[0.0,-2.0,-1.5,-1.0,3.5];let mini=[0.0,-1.5,-1.0];let full=[0.0,1.0,4.0,6.0];
  assert_eq!(config.freestyle_weights.normal_clears,normal);
  assert_eq!(config.freestyle_weights.mini_spin_clears,mini);
  assert_eq!(config.freestyle_weights.spin_clears,full);
  assert_eq!(config.freestyle_weights.has_back_to_back,0.5);
  assert_eq!(config.freestyle_weights.h3_surge_bank_value,0.0);
  assert_eq!(config.freestyle_weights.h3_b2b_charge_value,0.0);
  assert_eq!(config.freestyle_weights.back_to_back_clear,if cfg!(surge_residual){CANDIDATE_BTB_CLEAR}else{1.0});
  assert_eq!(config.freestyle_weights.combo_attack,1.5);
  assert_eq!(config.freestyle_weights.perfect_clear,15.0);
  assert!(config.freestyle_weights.perfect_clear_override);
  assert!(!config.freestyle_weights.tetrio_s2);
  if let Ok(path)=std::env::var("KIWI_CONFIG_OUTPUT") {std::fs::write(path,serde_json::to_string_pretty(&config).unwrap()).unwrap();}
  let start:crate::tbp::Start=serde_json::from_value(serde_json::json!({"board":[],"queue":["I","T","S","Z","J","L"],"hold":"O","combo":0,"back_to_back":false})).unwrap();
  let initial=crate::try_create_bot_with_context(start,std::sync::Arc::new(config.clone()),TetrioRules::default(),false).unwrap().state();
  for spin in [Spin::None,Spin::Mini,Spin::Full] {for lines in 0..=4 {for pc in [false,true] {for override_pc in [false,true] {for combo in [0,2,5] {for btb in [false,true] {for dead in [false,true] {
   let mut on=config.freestyle_weights.clone();on.normal_clears=normal;on.mini_spin_clears=mini;on.spin_clears=full;on.perfect_clear_override=override_pc;on.back_to_back_clear=1.0;
   let mut off=on.clone();off.back_to_back_clear=CANDIDATE_BTB_CLEAR;
   let mut state=initial;state.back_to_back=btb;state.forecast.topped_out=dead;
   let info=PlacementInfo {placement:Placement {location:PieceLocation {piece:Piece::T,rotation:Rotation::North,x:4,y:3},spin},lines_cleared:lines,garbage_cleared:0,combo,back_to_back:btb,b2b_count_before:0,b2b_count_after:0,b2b_broken:false,perfect_clear:pc};
   let delta=if dead || !btb || (pc && override_pc) {0.0}else{CANDIDATE_BTB_CLEAR-1.0};
   let (a,ar)=evaluate(&on,state,&info,0,8,0);let (b,br)=evaluate(&off,state,&info,0,8,0);
   assert_eq!(a.value,b.value,"Only edge clear shaping may change, never leaf");
   assert!((br.value.0-ar.value.0-delta).abs()<0.0002,"Unexpected reward delta");
  }}}}}}}
 }
}
