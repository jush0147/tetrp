use std::cell::RefCell;
use serde_json::{json,Value};
use crate::data::{GameState,PlacementInfo};
#[derive(Default)]
struct Audit { recording:bool, stages:Value, scenarios:Vec<Value>, branches:Vec<Value> }
thread_local!{static A:RefCell<Audit>=RefCell::new(Audit::default());}
pub fn reset(){A.with(|a|*a.borrow_mut()=Audit::default());}
pub fn set_depth(_:usize){}
pub fn recording()->bool {A.with(|a|a.borrow().recording)}
pub fn start(){A.with(|a|{let mut a=a.borrow_mut();assert!(!a.recording);a.recording=true;a.stages=Value::Null;});}
pub fn stop()->Value {A.with(|a|{let mut a=a.borrow_mut();a.recording=false;a.stages.take()})}
pub fn observe(before:[u64;10],state:GameState,_:&PlacementInfo,count:usize,cutouts:Vec<Value>,points:Vec<(&str,f32,f32)>){
    A.with(|a|{let mut a=a.borrow_mut();if !a.recording{return;}
        a.stages=json!({"realBoard":before,"evaluatedBoard":state.board.cols,"cutoutAllowance":count,"cutouts":cutouts,
            "stages":points.into_iter().map(|(name,eval,reward)|json!({"name":name,"eval":eval,"reward":reward})).collect::<Vec<_>>()});
    });
}
pub fn scenario(place:bool,scenario:u32,paths:Value){A.with(|a|a.borrow_mut().scenarios.push(json!({"branch":if place{"place"}else{"post_hold"},"scenario":scenario,"paths":paths})));}
pub fn branch(place:bool,candidates:Value){A.with(|a|a.borrow_mut().branches.push(json!({"branch":if place{"place"}else{"post_hold"},"candidates":candidates})));}
pub fn finish()->Value {A.with(|a|{let a=a.borrow();assert!(!a.recording);json!({"version":1,"scenarios":a.scenarios,"branches":a.branches,"scope":"Post-search readout of completed DAGs; all root paths retained to recover globally ranked top-2 across scenarios. No extra search. Diagnostic replay only; not performance evidence."})})}
