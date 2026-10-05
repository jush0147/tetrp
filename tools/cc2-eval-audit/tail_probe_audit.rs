use std::cell::RefCell;
use serde_json::{json,Value};
#[derive(Default)]
struct Counts { calls:u64, complete:u64, transitions:u64, published:u64, incomplete:u64 }
thread_local!{static A:RefCell<Counts>=RefCell::new(Counts::default());}
pub fn reset(){A.with(|a|*a.borrow_mut()=Counts::default());}
pub fn probe(nodes:u64,complete:bool){A.with(|a|{let mut a=a.borrow_mut();a.calls+=1;a.transitions+=nodes;if complete{a.complete+=1;}else{a.incomplete+=1;}});}
pub fn publish(n:u64){A.with(|a|a.borrow_mut().published+=n);}
pub fn finish()->Value {A.with(|a|{let a=a.borrow();json!({"calls":a.calls,"completed":a.complete,"published":a.published,"incomplete":a.incomplete,"transitions":a.transitions,"scope":"Completed probes may be discarded with an incomplete parent expansion; published counts only completed parent expansions, not unique TT states or selected best continuations."})})}
