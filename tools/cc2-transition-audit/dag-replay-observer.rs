use std::{cell::RefCell,collections::HashMap};
use crate::data::*;
#[derive(Default)]
struct Audit { edges:HashMap<(GameState,Piece,Placement),GameState>, recorded:u64,replayed:u64 }
thread_local! {static AUDIT:RefCell<Audit>=RefCell::new(Audit::default());}
pub fn reset(){AUDIT.with(|a|*a.borrow_mut()=Audit::default());}
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
