// Offline insertion-only observer. Paths are selected witnesses, NOT backed-up best lines.
use std::cell::RefCell;
use std::collections::BTreeMap;
use crate::data::{GameState,Piece,Placement,PlacementInfo};
use serde_json::{json,Value};
#[derive(Default)]
struct Audit { branch:String, scenario:u32, queue:Vec<Piece>, path:Vec<(Piece,Placement)>,
    groups:BTreeMap<String,u64>, retained:BTreeMap<String,usize>, rows:Vec<Value>, evaluations:u64 }
thread_local! { static A:RefCell<Audit> = RefCell::new(Audit::default()); }
pub fn reset(){A.with(|a|*a.borrow_mut()=Audit::default());}
pub fn set_context(branch:&str,scenario:u32,queue:&[Piece],_incoming:&[(u32,u32)]){
 A.with(|a|{let mut a=a.borrow_mut();a.branch=branch.into();a.scenario=scenario;a.queue=queue.to_vec();});
}
pub fn reset_path(){A.with(|a|a.borrow_mut().path.clear());}
pub fn path_step(next:Piece,p:Placement){A.with(|a|a.borrow_mut().path.push((next,p)));}
pub fn observe(depth:usize,state:GameState,info:&PlacementInfo,incoming:u32,sent:u32,eval:f32,reward:f32){
 A.with(|a|{let mut a=a.borrow_mut();a.evaluations+=1;
  assert_eq!(a.path.len()+1,depth);assert!(depth<=a.queue.len());
  let bank=if state.back_to_back {crate::tetrio::surge_size_with_rules(state.b2b_count as u32,state.rules)} else {0};
  let released=info.b2b_broken && crate::tetrio::surge_size_with_rules(info.b2b_count_before,state.rules)>0;
  let frontier=depth==a.queue.len();
  let category=if state.forecast.topped_out {"terminal"} else if released {"release"} else if bank>0 {"bank-held"} else {"other"};
  let group=format!("{}/{}/depth{}/{}/frontier{}",a.branch,a.scenario,depth,category,frontier);
  *a.groups.entry(group.clone()).or_default()+=1;
  if category=="other"||category=="terminal" {return;}
  let n=a.retained.entry(group.clone()).or_default();if *n>=2{return;}*n+=1;
  let row=json!({"group":group,"branch":a.branch,"scenario":a.scenario,"depth":depth,"atKnownQueueFrontier":frontier,
   "selectedPathBefore":a.path,"placement":info.placement,"normalizedQueue":a.queue,"remainingAfter":a.queue[depth..],
   "realBoardCols":state.board.cols,"holdIsEmpty":state.hold_is_empty,"reserve":state.reserve,
   "rawB2BAfter":if state.back_to_back {state.b2b_count as u32+1}else{0},"b2bCountBefore":info.b2b_count_before,
   "bankBaseUnitsAfter":bank,"nextLockMultiplier":state.forecast.next_attack_multiplier(),
   "released":released,"lines":info.lines_cleared,"pendingBefore":incoming,"pendingAfter":state.forecast.remaining(),
   "sentBefore":sent,"sentAfter":state.forecast.sent,"sentDelta":state.forecast.sent.saturating_sub(sent),
   "eval":eval,"edgeReward":reward});a.rows.push(row);
 });
}
pub fn finish()->Value {A.with(|a|{let a=a.borrow();json!({"evaluations":a.evaluations,"groups":a.groups,"rows":a.rows,
 "scope":"All evaluated nodes counted; first two release/bank-held witnesses per branch/scenario/depth/category. Paths are selection witnesses, not backed-up best continuations. Evaluations may be discarded at budget boundary. Frontier means all normalized known queue consumed; it is not every current DAG leaf. Bank is pre-multiplier units, not sent or KO value."})})}
