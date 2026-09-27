use cold_clear_2::{bot::BotConfig,data::*,tbp::Start,try_create_bot_with_context,movegen};
use serde::Deserialize;
use serde_json::json;
use std::{io::{self,BufRead},sync::Arc};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {id:String,start:Start,rules:TetrioRules,from:PieceLocation,direction:u8}
fn main(){
    for line in io::stdin().lock().lines(){
        let result=(||->Result<serde_json::Value,String>{
            let r:Input=serde_json::from_str(&line.map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
            r.start.validate()?;
            let bot=try_create_bot_with_context(r.start,Arc::new(BotConfig::review_h9_h12()),r.rules,false)?;
            Ok(json!({"id":r.id,"result":movegen::audit_rotation_probe(&bot.state().board,r.from,r.direction)}))
        })();
        println!("{}",result.unwrap_or_else(|e|json!({"error":e})));
    }
}
