//! Diagnostic only: execute the pinned, otherwise unmodified GameState::advance.
//! Reachability is certified by the JS authority before input. This does not
//! certify CC2 movegen, Hold lifecycle, next spawn, or the policy's information set.
use cold_clear_2::{bot::BotConfig, data::*, forecast::Forecast, tbp::{Start, Randomizer},
    tetrio, transition_audit_observer as observer, try_create_bot_with_context};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{io::{self, BufRead}, sync::Arc};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {
    id: String, start: Start, rules: TetrioRules, placement: Placement,
    frame: u32, cadence: u32, multiplier: f64, margin: u32, rate: f64,
    pieces: u32, sent: u32, incoming: Vec<(u32,u32)>, scenario: u32,
}
fn state_json(s: &GameState) -> Value {
    json!({"cols":s.board.cols.map(|c|c.to_string()),
        "garbageRows":s.board.garbage_rows.to_string(),"combo":s.combo,
        "btb":if s.back_to_back {u32::from(s.b2b_count)+1} else {0},
        "reserve":s.reserve,"forecast":s.forecast.transition_audit_readout()})
}
fn run(r: Input) -> Result<Value,String> {
    if r.start.queue.len()!=6 || !matches!(r.start.randomizer,Randomizer::Unknown) {
        return Err("requires current + NEXT5, unknown randomizer".into());
    }
    if r.cadence!=24 || r.scenario>9 { return Err("invalid diagnostic contract".into()); }
    if r.placement.location.piece!=r.start.queue[0] { return Err("Place must use current".into()); }
    r.start.validate()?;
    // Match the product's normalized next/reserve representation explicitly.
    let next=if r.start.hold.is_none() {r.start.queue[1]} else {r.start.queue[0]};
    let mut forecast=Forecast::new_timed_with_clock(&r.incoming,r.pieces,r.sent,
        r.cadence,r.frame,r.multiplier,r.margin,r.rate,r.scenario)?;
    forecast.set_opener_phase_pieces(r.rules.opener_phase_pieces);
    let bot=try_create_bot_with_context(r.start,Arc::new(BotConfig::review_h9_h12()),r.rules,false)?;
    let mut state=bot.state();state.forecast=forecast;
    // Reject bad conversion rather than calling trusted advance on illegal cells.
    if r.placement.location.obstructed(&state.board) || r.placement.location.drop_distance(&state.board)!=0 {
        return Err("nonlegal/nonlanding supplied placement".into());
    }
    let before=state_json(&state);
    let multiplier=state.forecast.next_attack_multiplier();
    observer::reset();
    let info=state.advance(next,r.placement);
    let events=observer::take();
    let attack=tetrio::attack_with_multiplier_and_rules(&info,multiplier,state.rules);
    Ok(json!({"id":r.id,"before":before,"after":state_json(&state),
        "placement":info.placement,"cells":info.placement.location.cells(),
        "clear":{"lines":info.lines_cleared,"garbageRows":info.garbage_cleared,"allClear":info.perfect_clear},
        "packets":attack.packets(),"generated":attack.total,"lockMultiplier":multiplier,
        "events":events,"unsupportedOutputs":["next_spawn_KO","Hold_lifecycle","authority_rotation_provenance"]}))
}
fn main() {
    for line in io::stdin().lock().lines() {
        let output=match line {
            Ok(s)=>match serde_json::from_str::<Input>(&s) {
                Ok(r)=>{let id=r.id.clone();match run(r) {Ok(v)=>v,Err(e)=>json!({"id":id,"error":e})}},
                Err(e)=>json!({"error":e.to_string()}),
            },
            Err(e)=>json!({"error":e.to_string()}),
        };
        println!("{}",output);
    }
}
