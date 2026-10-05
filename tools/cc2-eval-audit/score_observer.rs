use std::cell::RefCell;
use serde_json::{json,Value};
use crate::data::{GameState,PlacementInfo};
use crate::data::Placement;
use std::collections::HashMap;
#[derive(Default)]
struct Work { attempts:u64, nodes:u64, expansions:u64, cancelled:u64 }
#[derive(Default)]
struct Allocation { budget:u64, depth:usize, known:bool, root:Option<Placement>, rank:Option<usize>, selected:bool, counts:HashMap<(Option<Placement>,usize,&'static str),Work>, ranks:HashMap<usize,u64>, max_stall:u32 }
#[derive(Default)]
struct Audit { recording:bool, stages:Value, scenarios:Vec<Value>, branches:Vec<Value>, allocation:Allocation, allocations:Vec<Value> }
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
pub fn finish()->Value {A.with(|a|{let a=a.borrow();assert!(!a.recording);json!({"version":1,"scenarios":a.scenarios,"branches":a.branches,"allocationVersion":1,"allocations":a.allocations,"scope":"Completed DAG paths plus offline search-work counters. Root work is attributed to the selected route, not exclusive ownership of shared DAG descendants. No strategy change or production latency claim."})})}
pub fn allocation_begin(budget:u64){A.with(|a|a.borrow_mut().allocation=Allocation{budget,..Allocation::default()});}
pub fn attempt_begin(){A.with(|a|{let mut a=a.borrow_mut();let w=&mut a.allocation;w.depth=0;w.known=true;w.root=None;w.rank=None;w.selected=false;});}
pub fn visit(depth:usize,known:bool){A.with(|a|{let mut a=a.borrow_mut();a.allocation.depth=depth;a.allocation.known=known;});}
pub fn root_choice(p:Placement,rank:usize){A.with(|a|{let mut a=a.borrow_mut();if a.allocation.depth==1 {a.allocation.root=Some(p);a.allocation.rank=Some(rank);}});}
pub fn selected(){A.with(|a|a.borrow_mut().allocation.selected=true);}
pub fn attempt_end(nodes:u64,expansions:u64,cancelled:bool,stall:u32){A.with(|a|{
 let mut a=a.borrow_mut();let w=&mut a.allocation;assert!(w.depth>0);w.max_stall=w.max_stall.max(stall);
 let reason=if cancelled{"partial_cancel"}else if w.selected {if nodes>0{"expanded"}else{"selected_zero_nodes"}}else if !w.known{"finite_frontier"}else{"known_failed"};
 if let Some(rank)=w.rank{*w.ranks.entry(rank).or_default()+=1;}
 let c=w.counts.entry((w.root,w.depth,reason)).or_default();c.attempts+=1;c.nodes+=nodes;c.expansions+=expansions;c.cancelled+=u64::from(cancelled);
});}
pub fn allocation_end(place:bool,scenario:u32,nodes:u64,selections:u64,expansions:u64,exhausted:bool,stall:u32){A.with(|a|{
 let mut a=a.borrow_mut();let w=&a.allocation;
 assert_eq!(w.counts.values().map(|c|c.nodes).sum::<u64>(),nodes);
 assert_eq!(w.counts.values().map(|c|c.attempts).sum::<u64>(),selections);
 assert_eq!(w.counts.values().map(|c|c.expansions).sum::<u64>(),expansions);
 let rows:Vec<_>=w.counts.iter().map(|((root,depth,reason),c)|json!({"root":root,"depth":depth,"reason":reason,"attempts":c.attempts,"nodes":c.nodes,"expansions":c.expansions,"cancelled":c.cancelled})).collect();
 let ranks:Vec<_>=w.ranks.iter().map(|(rank,n)|json!({"rankAtSelection":rank,"attempts":n})).collect();
 let v=json!({"branch":if place{"place"}else{"post_hold"},"scenario":scenario,"budget":w.budget,"nodes":nodes,"selections":selections,"expansions":expansions,"budgetExhausted":exhausted,"finalStall":stall,"maxStall":w.max_stall,"stop":if exhausted{"partial_budget"}else if nodes>=w.budget{"budget"}else if stall>=1024{"stall_limit"}else{"other"},"rows":rows,"ranks":ranks});
 a.allocations.push(v);
});}
