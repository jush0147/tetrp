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
    let moves=movegen::find_moves_with_clutch(&board,piece,r.clutch);
    Ok(json!({"id":r.id,"moves":moves.iter().map(|(p,cost)|json!({
        "placement":p,"cells":p.location.cells(),"softDrops":cost})).collect::<Vec<_>>() }))
}
fn main(){
    for line in io::stdin().lock().lines(){
        let result=line.map_err(|e|e.to_string()).and_then(|s|
            serde_json::from_str::<Input>(&s).map_err(|e|e.to_string())).and_then(run);
        println!("{}",result.unwrap_or_else(|e|json!({"error":e})));
    }
}
