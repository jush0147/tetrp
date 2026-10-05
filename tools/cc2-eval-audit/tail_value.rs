// Experimental one-step IID value backup; never recursive, never reads real tail.
fn tail_value(weights:&Weights, original:GameState, budget:u64)->(Option<Eval>,u64) {
    let mut used=0;
    let mut sum=0.0;
    for next in EnumSet::<Piece>::all() {
        let mut state=original;
        // This experiment explicitly rejects bag-remainder inference.
        state.bag=EnumSet::all();
        let clutch=state.rules.clutch && state.combo>0;
        let current=if state.hold_is_empty {state.reserve} else {next};
        let mut best:Option<Eval>=None;
        if !state.forecast.topped_out && crate::movegen::spawn_available(&state.board,current,clutch) {
            for piece in EnumSet::only(next)|state.reserve {
                for (mv,sd) in find_moves_with_clutch(&state.board,piece,clutch) {
                    if used==budget {return (None,used);}
                    used+=1;
                    let mut child=state;
                    let incoming=child.forecast.remaining();let sent=child.forecast.sent;
                    let info=child.advance(next,mv);
                    // The synthetic piece must not create a hidden bag belief at V0.
                    child.bag=EnumSet::all();
                    let (eval,reward)=evaluate(weights,child,&info,sd,incoming,sent);
                    let value=eval+reward;
                    best=Some(best.map_or(value,|v|v.max(value)));
                }
            }
        }
        // Death/no legal action is a full-weight scenario, never dropped.
        sum+=best.map_or(-1_000_000.0,|v|v.value.0);
    }
    (Some(Eval{value:(sum/7.0).into()}),used)
}

#[cfg(test)]
mod tail_value_tests {
 use super::*;
 fn initial(empty:bool)->GameState {
  let start:crate::tbp::Start=serde_json::from_value(serde_json::json!({"board":[],"queue":["I","T","S","Z","J","L"],"hold":if empty {serde_json::Value::Null}else{serde_json::json!("O")},"combo":0,"back_to_back":false})).unwrap();
  crate::try_create_bot_with_context(start,std::sync::Arc::new(crate::bot::BotConfig::review_h9_h12()),TetrioRules::default(),false).unwrap().state()
 }
 #[test]
 fn atomic_budget_and_unknown_bag_independence() {
  let w=crate::bot::BotConfig::review_h9_h12().freestyle_weights;
  for empty in [false,true] {
   let s=initial(empty);assert_eq!(s.hold_is_empty,empty);
   let (full,n)=tail_value(&w,s,100000);assert!(full.is_some()&&n>7&&n<100000);
   let (short,used)=tail_value(&w,s,n-1);assert!(short.is_none());assert_eq!(used,n-1);
   let (exact,cost)=tail_value(&w,s,n);assert_eq!(exact,full);assert_eq!(cost,n);
   let mut alternate=s;alternate.bag=EnumSet::only(Piece::T);
   assert_eq!(tail_value(&w,alternate,n),(full,n));
   assert_eq!(tail_value(&w,s,0),(None,0));
  }
 }
 #[test]
 fn dead_scenarios_cannot_be_ignored_or_rescued_by_hold() {
  let w=crate::bot::BotConfig::review_h9_h12().freestyle_weights;
  for empty in [false,true] {
   let mut s=initial(empty);s.board.cols=[(1u64<<40)-1;10];
   let (value,cost)=tail_value(&w,s,10000);assert_eq!(value.unwrap().value.0,-1_000_000.0);assert_eq!(cost,0);
  }
 }
}
