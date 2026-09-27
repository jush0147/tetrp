use std::{cell::RefCell,collections::HashMap};
use crate::data::*;
#[derive(Default)]
struct Audit { edges:HashMap<(GameState,Piece,Placement),GameState>, recorded:u64,replayed:u64 }
thread_local! {static AUDIT:RefCell<Audit>=RefCell::new(Audit::default());}
thread_local! {static COMMITTED:RefCell<Vec<Vec<serde_json::Value>>>=RefCell::new(Vec::new());}
pub fn reset(){AUDIT.with(|a|*a.borrow_mut()=Audit::default());COMMITTED.with(|c|c.borrow_mut().clear());}
// Sample immediately after Bot.current.advance, before DAG root replay.
pub fn committed(){COMMITTED.with(|c|c.borrow_mut().push(crate::transition_audit_observer::take()));}
pub fn take_committed()->Vec<serde_json::Value>{COMMITTED.with(|c|{let mut c=c.borrow_mut();assert_eq!(c.len(),1,"one commit sample required");c.pop().unwrap()})}
pub fn record(parent:GameState,next:Piece,mv:Placement,child:GameState){
    let mut replay=parent;replay.advance(next,mv);assert_eq!(replay,child,"expansion child != shared transition");
    AUDIT.with(|a|{let mut a=a.borrow_mut();
        if let Some(old)=a.edges.insert((parent,next,mv),child){assert_eq!(old,child,"same edge changed state");}
        a.recorded+=1;});
}
pub fn replay(parent:GameState,next:Piece,mv:Placement,child:GameState){
    AUDIT.with(|a|{let mut a=a.borrow_mut();
        assert_eq!(a.edges.get(&(parent,next,mv)),Some(&child),"selection replay != previously published child");a.replayed+=1;});
}
pub fn counts()->(u64,u64){AUDIT.with(|a|{let a=a.borrow();(a.recorded,a.replayed)})}
