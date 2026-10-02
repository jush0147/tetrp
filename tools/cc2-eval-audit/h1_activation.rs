// Offline observer only. Reset for each captured public request.
use std::cell::RefCell;
#[derive(Default,serde::Serialize)]
struct Counters { evaluations:u64, nonzero:u64, min_delta:f32, max_delta:f32 }
thread_local! { static COUNTERS:RefCell<Counters> = RefCell::new(Counters::default()); }
pub fn reset(){COUNTERS.with(|c|*c.borrow_mut()=Counters::default());}
pub fn record(delta:f32){COUNTERS.with(|c|{let mut c=c.borrow_mut();c.evaluations+=1;
    if delta!=0.0 {c.nonzero+=1;} c.min_delta=c.min_delta.min(delta);c.max_delta=c.max_delta.max(delta);});}
pub fn finish()->serde_json::Value{COUNTERS.with(|c|serde_json::to_value(&*c.borrow()).unwrap())}
