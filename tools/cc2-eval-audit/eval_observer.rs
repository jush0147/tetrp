use std::cell::RefCell;
use crate::data::{GameState, PlacementInfo, Piece, Placement};
use std::collections::BTreeMap;
use serde_json::{json,Value};

#[derive(Default)]
struct Audit { depth:usize, count:u64, with_slot:u64, changed_board:u64, rows:Vec<Value>,
    branch:String, scenario:u32, queue:Vec<Piece>, incoming:Vec<(u32,u32)>, path:Vec<(Piece,Placement)>,
    retained:[usize;3], groups:BTreeMap<String,[u64;3]> }
thread_local! { static AUDIT:RefCell<Audit> = RefCell::new(Audit::default()); }
pub fn reset(){ AUDIT.with(|a|*a.borrow_mut()=Audit::default()); }
pub fn set_depth(depth:usize){ AUDIT.with(|a|a.borrow_mut().depth=depth); }
pub fn set_context(branch:&str,scenario:u32,queue:&[Piece],incoming:&[(u32,u32)]){
    AUDIT.with(|a|{let mut a=a.borrow_mut();a.branch=branch.into();a.scenario=scenario;
        a.queue=queue.to_vec();a.incoming=incoming.to_vec();a.retained=[0;3];});
}
pub fn reset_path(){ AUDIT.with(|a|a.borrow_mut().path.clear()); }
pub fn path_step(next:Piece,p:Placement){ AUDIT.with(|a|a.borrow_mut().path.push((next,p))); }
pub fn observe(before:[u64;10],state:GameState,info:&PlacementInfo,count:usize,cutouts:Vec<Value>,points:Vec<(&str,f32,f32)>){
    AUDIT.with(|a|{
        let mut a=a.borrow_mut();a.count+=1;
        if !cutouts.is_empty(){a.with_slot+=1;}
        if before!=state.board.cols {a.changed_board+=1;}
        // Separate quotas per branch/scenario prevent early non-clearing templates
        // from consuming the entire board-rewrite witness budget.
        let category=if before!=state.board.cols {0} else if !cutouts.is_empty(){1}else{2};
        let key=format!("{}/{}",a.branch,a.scenario);
        a.groups.entry(key).or_insert([0;3])[category]+=1;
        if a.retained[category]>=[24,8,4][category]{return;}
        a.retained[category]+=1;
        assert_eq!(a.path.len()+1,a.depth,"selection path/depth mismatch");
        assert!(a.depth<=a.queue.len(),"finite-visible queue exhausted");
        let remaining=a.queue[a.depth..].to_vec();
        let path=a.path.clone();let branch=a.branch.clone();let scenario=a.scenario;
        let incoming=a.incoming.clone();let queue=a.queue.clone();
        let mut prev=(0.0f32,0.0f32);
        let stages:Vec<_>=points.into_iter().map(|(name,e,r)|{
            let v=json!({"stage":name,"eval":e,"reward":r,"deltaEval":e-prev.0,"deltaReward":r-prev.1});prev=(e,r);v
        }).collect();
        let depth=a.depth;
        a.rows.push(json!({"depth":depth,"branch":branch,"scenario":scenario,"scenarioIncoming":incoming,
            "category":["board_rewrite","template_only","control"][category],
            "normalizedBranchQueue":queue,"normalizedRemainingAfter":remaining,"selectedPathBefore":path,
            "placement":info.placement,"lines":info.lines_cleared,
            "comboBefore":info.combo,"b2bBefore":info.b2b_count_before,"b2bAfter":info.b2b_count_after,
            "reserve":state.reserve,"holdIsEmpty":state.hold_is_empty,"syntheticBag":format!("{:?}",state.bag),
            "pendingAfter":state.forecast.remaining(),"sentAfter":state.forecast.sent,
            "cutoutAllowance":count,"cutouts":cutouts,"realBoardCols":before,"evaluatedBoardCols":state.board.cols,"stages":stages}));
    });
}
pub fn finish()->Value { AUDIT.with(|a|{let a=a.borrow();json!({"evaluations":a.count,"withSlot":a.with_slot,
    "boardRewritten":a.changed_board,"groups":a.groups,"version":2,
    "sampling":"per branch/scenario: first 24 board rewrites + 8 template-only + 4 controls; not random",
    "limitations":"terminal early-return not sampled; selected path is one witness to DAG state, not backed-up best continuation; normalized queue plus reserve require Hold-lineage interpretation",
    "rows":a.rows})}) }
