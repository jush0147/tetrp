#[cfg(test)]
mod well_depth_gate_tests {
 use super::*;
 fn measured_delta(mut state:GameState,config:&crate::bot::BotConfig,expected:u32) {
  let mut on=config.freestyle_weights.clone();on.tetris_well_depth=0.3;
  let mut off=on.clone();off.tetris_well_depth=0.0;
  let info=PlacementInfo {placement:Placement {location:PieceLocation {piece:Piece::O,rotation:Rotation::North,x:4,y:3},spin:Spin::None},lines_cleared:0,garbage_cleared:0,combo:0,back_to_back:false,b2b_count_before:0,b2b_count_after:0,b2b_broken:false,perfect_clear:false};
  for dead in [false,true] {
   state.forecast.topped_out=dead;
   let (a,ar)=evaluate(&on,state,&info,0,0,0);let (b,br)=evaluate(&off,state,&info,0,0,0);
   assert_eq!(ar.value,br.value,"Well depth must not alter edge reward");
   let delta=if dead {0.0}else{-(expected as f32)*0.3};
   assert!((b.value.0-a.value.0-delta).abs()<0.0002,"Unexpected leaf delta: {:?}",state.board.cols);
  }
 }
 #[test]
 fn config_geometry_and_piece_independence() {
  let config=crate::bot::BotConfig::review_h9_h12();
  assert_eq!(config.freestyle_weights.tetris_well_depth,if cfg!(well_depth_off){0.0}else{0.3});
  if let Ok(path)=std::env::var("KIWI_CONFIG_OUTPUT") {std::fs::write(path,serde_json::to_string_pretty(&config).unwrap()).unwrap();}
  let start:crate::tbp::Start=serde_json::from_value(serde_json::json!({"board":[],"queue":["I","T","S","Z","J","L"],"hold":"O","combo":0,"back_to_back":false})).unwrap();
  let initial=crate::try_create_bot_with_context(start,std::sync::Arc::new(config.clone()),TetrioRules::default(),false).unwrap().state();
  // Flat walls, no T-slot cutouts: hand-calculated depth, not a copy of the bit formula.
  for depth in [0,1,3,4,8] {for column in [0,4,9] {for has_i in [false,true] {for reserve in [Piece::O,Piece::I] {
   let mut state=initial;state.bag=EnumSet::all();state.bag.remove(Piece::T);if !has_i {state.bag.remove(Piece::I);}state.reserve=reserve;
   state.board.cols=[(1u64<<depth)-1;10];state.board.cols[column]=0;
   measured_delta(state,&config,depth);
  }}}}
  let mut state=initial;state.bag=EnumSet::all();state.bag.remove(Piece::T);state.reserve=Piece::O;
  state.board.cols=[15;10];state.board.cols[9]=0;state.board.cols[0]=11;measured_delta(state,&config,2); // Interrupted at row 2.
  state.board.cols=[31;10];state.board.cols[9]=1;measured_delta(state,&config,4); // Floor at height 1.
  state.board.cols=[15;10];state.board.cols[0]=0;state.board.cols[9]=0;measured_delta(state,&config,0); // Two missing columns.
  state.board.cols=[15;10];state.board.cols[9]=16;measured_delta(state,&config,0); // Roofed hole is not an open well.
  // Existing T-slot heuristic fills the bottom two rows before measuring the well.
  state.board.cols=[3;10];state.board.cols[0]=1;state.board.cols[1]=0;state.board.cols[2]=5;
  measured_delta(state,&config,1); // No visible/reserved T and >3 known bag entries.
  let loc=well_known_tslot_left(&state.board).unwrap();let mut cut=state.board;cut.place(loc);
  assert_eq!(cut.line_clears().count_ones(),2);
  cut.remove_lines(cut.line_clears());assert_eq!(cut.cols,[0,0,1,0,0,0,0,0,0,0]);
  state.bag.insert(Piece::T);measured_delta(state,&config,0);
 }
}
