use std::cell::RefCell;
use serde_json::{json,Value};
#[derive(Default)]
struct Counts { calls:u64, complete:u64, transitions:u64, published:u64, incomplete:u64, allocations:Vec<Allocation> }
struct Allocation {budget:u64,quota:u64,spent:u64}
thread_local!{static A:RefCell<Counts>=RefCell::new(Counts::default());}
pub fn reset(){A.with(|a|*a.borrow_mut()=Counts::default());}
pub fn begin(budget:u64){A.with(|a|a.borrow_mut().allocations.push(Allocation{budget,quota:budget/5,spent:0}));}
pub fn allowance(spare:u64)->u64 {A.with(|a|{let a=a.borrow();let q=a.allocations.last().unwrap();spare.min(q.quota-q.spent)})}
pub fn probe(nodes:u64,complete:bool){A.with(|a|{let mut a=a.borrow_mut();let q=a.allocations.last_mut().unwrap();assert!(q.spent+nodes<=q.quota);assert!(complete||nodes==0);q.spent+=nodes;a.calls+=1;a.transitions+=nodes;if complete{a.complete+=1;}else{a.incomplete+=1;}});}
pub fn publish(n:u64){A.with(|a|a.borrow_mut().published+=n);}
pub fn finish()->Value {A.with(|a|{let a=a.borrow();json!({"version":2,"calls":a.calls,"completed":a.complete,"published":a.published,"incomplete":a.incomplete,"transitions":a.transitions,"allocations":a.allocations.iter().map(|q|json!({"budget":q.budget,"quota":q.quota,"spent":q.spent})).collect::<Vec<_>>(),"scope":"Published counts completed parent expansions, not unique TT states or selected continuations. Shadow submits old Eval. Incomplete means admission rejected before transitions; movegen overhead is wall time only."})})}
