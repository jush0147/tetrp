//! Diagnostic public Bot API and one real DAG expansion, not a second rule model.
use cold_clear_2::{bot::BotConfig,data::*,tbp::{Start,Randomizer},try_create_bot_with_context,movegen};
use serde::Deserialize;
use serde_json::{json,Value};
use std::{io::{self,BufRead},sync::Arc};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {id:String,start:Start,rules:TetrioRules,hold_locked:bool,placement:Option<Placement>,use_hold:bool}
fn run(r:Input)->Result<Value,String>{
    r.start.validate()?;
    if r.start.queue.len()!=6{return Err("current + NEXT5 required".into());}
    if !matches!(r.start.randomizer,Randomizer::Unknown){return Err("unknown randomizer required".into());}
    let mut bot=try_create_bot_with_context(r.start,Arc::new(BotConfig::review_h9_h12()),r.rules,r.hold_locked)?;
    let before=bot.player_pieces();let state=bot.state();
    let current=before.current.ok_or("missing current")?;
    let held=before.hold.or_else(||before.next.first().copied()).ok_or("missing held piece")?;
    let clutch=state.rules.clutch&&state.combo>0;
    let current_moves=movegen::find_moves_with_clutch(&state.board,current,clutch);
    let held_moves=movegen::find_moves_with_clutch(&state.board,held,clutch);
    let has_legal=bot.has_legal_move();
    let stats=bot.do_work_limited(100000);
    if stats.budget_exhausted{return Err("incomplete root expansion".into());}
    let ranked=bot.ranked_suggestions();
    let play=if let Some(p)=r.placement {
        match bot.try_play(p,r.use_hold){
            Ok(_)=>json!({"accepted":true,"pieces":bot.player_pieces(),"refill":bot.preview_refill_needed()}),
            Err(e)=>json!({"accepted":false,"error":e,"pieces":bot.player_pieces()})
        }
    }else{Value::Null};
    Ok(json!({"id":r.id,"before":before,"currentMoves":current_moves.len(),"heldMoves":held_moves.len(),
        "hasLegal":has_legal,"nodes":stats.nodes,"ranked":ranked.iter().map(|(p,_)|p).collect::<Vec<_>>(),"play":play}))
}
fn main(){for line in io::stdin().lock().lines(){let result=line.map_err(|e|e.to_string()).and_then(|s|
    serde_json::from_str::<Input>(&s).map_err(|e|e.to_string())).map(|r|{
        let id=r.id.clone();run(r).unwrap_or_else(|e|json!({"id":id,"error":e}))
    });
    println!("{}",result.unwrap_or_else(|e|json!({"error":e})));}}
