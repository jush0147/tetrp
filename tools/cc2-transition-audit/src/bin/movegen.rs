//! Spawn-based movegen diagnostic; no search, evaluator or hidden sequence.
use cold_clear_2::{bot::BotConfig,data::*,tbp::Start,try_create_bot_with_context,movegen};
use serde::Deserialize;
use serde_json::{json,Value};
use std::{io::{self,BufRead},sync::Arc};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {id:String,start:Start,rules:TetrioRules,clutch:bool}
fn run(r:Input)->Result<Value,String>{
    r.start.validate()?;
    if r.start.queue.len()!=6 {return Err("current + NEXT5 required".into());}
    let piece=r.start.queue[0];
    let bot=try_create_bot_with_context(r.start,Arc::new(BotConfig::review_h9_h12()),r.rules,false)?;
    let board=bot.state().board;
    #[cfg(cc2_air_prefix)]
    if std::env::var_os("CC2_KEEP_AIR_CACHE").is_none(){movegen::audit_air_cache_clear();}
    #[cfg(cc2_profile)]
    movegen::audit_profile_reset();
    let first_begin=std::time::Instant::now();
    let moves=movegen::find_moves_with_clutch(&board,piece,r.clutch);
    let first_call_ns=first_begin.elapsed().as_nanos() as u64;
    #[cfg(cc2_air_prefix)]
    let air_cache=Some(movegen::audit_air_cache_size());
    #[cfg(not(cc2_air_prefix))]
    let air_cache:Option<(usize,usize)>=None;
    #[cfg(cc2_profile)]
    let profile=Some(movegen::audit_profile_take());
    #[cfg(not(cc2_profile))]
    let profile:Option<[u64;8]>=None;
    // Same-run kernel timing, excludes parsing and bot construction. This is
    // diagnostic native latency, not a browser performance acceptance test.
    let mut timing_ns=Vec::new();
    for _ in 0..(if cfg!(cc2_profile) {0} else {7}) {
        let begin=std::time::Instant::now();
        for _ in 0..25 {
            let again=movegen::find_moves_with_clutch(std::hint::black_box(&board),piece,r.clutch);
            assert_eq!(again,moves,"movegen must be repeatable");
            std::hint::black_box(again);
        }
        timing_ns.push(begin.elapsed().as_nanos() as u64/25);
    }
    Ok(json!({"id":r.id,"timingNs":timing_ns,"firstCallNs":first_call_ns,"airCache":air_cache,"profile":profile,"moves":moves.iter().map(|(p,cost)|json!({
        "placement":p,"cells":p.location.cells(),"softDrops":cost})).collect::<Vec<_>>() }))
}
fn main(){
    for line in io::stdin().lock().lines(){
        let result=line.map_err(|e|e.to_string()).and_then(|s|
            serde_json::from_str::<Input>(&s).map_err(|e|e.to_string())).and_then(run);
        println!("{}",result.unwrap_or_else(|e|json!({"error":e})));
    }
}
