use serde::Deserialize;
use serde_json::{json,Value};
use std::io::{self,BufRead};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {id:String,request:Value}
fn main(){for line in io::stdin().lock().lines(){
    let output=match line.map_err(|e|e.to_string()).and_then(|s|serde_json::from_str::<Input>(&s).map_err(|e|e.to_string())){
        Ok(r)=>match cold_clear_2::snapshot::audit_snapshot_hold(&r.request.to_string()){
            Ok(result)=>json!({"id":r.id,"result":result}),Err(e)=>json!({"id":r.id,"error":e})},
        Err(e)=>json!({"error":e}),
    };println!("{}",output);
}}
