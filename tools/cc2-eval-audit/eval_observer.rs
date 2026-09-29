use std::cell::RefCell;
use crate::data::{GameState, PlacementInfo};
use serde_json::{json,Value};

#[derive(Default)]
struct Audit { depth:usize, count:u64, with_slot:u64, changed_board:u64, rows:Vec<Value>, controls:usize, slots:usize }
thread_local! { static AUDIT:RefCell<Audit> = RefCell::new(Audit::default()); }
pub fn reset(){ AUDIT.with(|a|*a.borrow_mut()=Audit::default()); }
pub fn set_depth(depth:usize){ AUDIT.with(|a|a.borrow_mut().depth=depth); }
pub fn observe(before:[u64;10],state:GameState,info:&PlacementInfo,count:usize,cutouts:Vec<Value>,points:Vec<(&str,f32,f32)>){
    AUDIT.with(|a|{
        let mut a=a.borrow_mut();a.count+=1;
        if !cutouts.is_empty(){a.with_slot+=1;}
        if before!=state.board.cols {a.changed_board+=1;}
        // Deterministic bounded witnesses, not an unbiased sample or importance estimate.
        let keep=if !cutouts.is_empty(){if a.slots<64 {a.slots+=1;true}else{false}}
            else if a.controls<8 {a.controls+=1;true}else{false};
        if !keep{return;}
        let mut prev=(0.0f32,0.0f32);
        let stages:Vec<_>=points.into_iter().map(|(name,e,r)|{
            let v=json!({"stage":name,"eval":e,"reward":r,"deltaEval":e-prev.0,"deltaReward":r-prev.1});prev=(e,r);v
        }).collect();
        let depth=a.depth;
        a.rows.push(json!({"depth":depth,"placement":info.placement,"lines":info.lines_cleared,
            "comboBefore":info.combo,"b2bBefore":info.b2b_count_before,"b2bAfter":info.b2b_count_after,
            "reserve":state.reserve,"holdIsEmpty":state.hold_is_empty,"syntheticBag":format!("{:?}",state.bag),
            "pendingAfter":state.forecast.remaining(),"sentAfter":state.forecast.sent,
            "cutoutAllowance":count,"cutouts":cutouts,"realBoardCols":before,"evaluatedBoardCols":state.board.cols,"stages":stages}));
    });
}
pub fn finish()->Value { AUDIT.with(|a|{let a=a.borrow();json!({"evaluations":a.count,"withSlot":a.with_slot,
    "boardRewritten":a.changed_board,"sampling":"first 64 template hits + first 8 controls; not random; both root branches/scenarios pooled",
    "limitations":"terminal early-return not sampled; local evaluation only, not backed-up root attribution or full continuation",
    "rows":a.rows})}) }
