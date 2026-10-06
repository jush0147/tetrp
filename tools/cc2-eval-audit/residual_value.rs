
#[cfg(residual_value)]
fn residual_delay(reserve:Piece, supply:(u32,u32))->u32 {
    // After a completed placement, reserve is either available Hold or the
    // active-current proxy in CC2's empty-Hold normalization. Either can be T.
    if reserve==Piece::T {1} else if supply.0!=0 {supply.0} else {supply.1+7}
}
#[cfg(residual_value)]
fn residual_discount(delay:u32,due:u32,height:u32)->f32 {
    1.0 / (delay as f32 * (1.0 + due as f32 / 20u32.saturating_sub(height).max(1) as f32))
}
#[cfg(residual_value)]
fn residual_board_value(weights:&Weights,state:&GameState,supply:(u32,u32))->f32 {
    let base=residual_base(weights,&state.board);
    let Some(location)=well_known_tslot_left(&state.board).or_else(||well_known_tslot_right(&state.board)) else {return base;};
    if location.cells().iter().any(|&cell|state.board.occupied(cell)) {return base;}
    let mut template=state.board;
    template.place(location);
    let clear=template.line_clears();let lines=clear.count_ones() as usize;
    if lines>=weights.tslot.len(){return base;}
    if lines>1 {template.remove_lines(clear);} else {template=state.board;}
    let after=if lines>1 {residual_base(weights,&template)} else {base};
    let asset=(weights.tslot[lines]+after-base).max(0.0);
    let delay=residual_delay(state.reserve,supply);
    let due=state.forecast.residual_due(delay);
    let height=state.board.cols.iter().map(|c|64-c.leading_zeros()).max().unwrap();
    let discount=residual_discount(delay,due,height);
    #[cfg(residual_trace)]
    RESIDUAL_WITNESSES.with(|rows|{let mut rows=rows.borrow_mut();if rows.len()<24 && asset>0.0 {
        rows.push(serde_json::json!({"board":state.board.cols,"template":template.cols,"reserve":state.reserve,
            "holdEmpty":state.hold_is_empty,"supply":supply,"lines":lines,"base":base,"after":after,
            "slotBonus":weights.tslot[lines],"asset":asset,"delay":delay,"due":due,"height":height,
            "discount":discount,"value":base+discount*asset}));
    }});
    base+discount*asset
}
#[cfg(all(residual_value,residual_trace))]
thread_local! {static RESIDUAL_WITNESSES:std::cell::RefCell<Vec<serde_json::Value>>=std::cell::RefCell::new(Vec::new());}

#[cfg(all(test,residual_value))]
mod residual_value_tests {
    use super::*;
    #[test]
    fn residual_supply_matches_normalized_piece_consumption(){
        // Both normal and empty-Hold transitions consume one layer; a reserve
        // T is immediately usable, otherwise suffix index j needs j+1 locks.
        for reserve in [Piece::I,Piece::T] {
            for n in 0..6u32 {for pos in 0..=n {
                let expected=if reserve==Piece::T {1} else if pos>0 {pos} else {n+7};
                assert_eq!(residual_delay(reserve,(pos,n)),expected);
            }}
        }
    }
    #[test]
    fn residual_discount_bounds_and_monotonicity(){
        for d in 1..14 {for p in 0..20 {for h in 0..40 {
            let g=residual_discount(d,p,h);assert!(g>0.0&&g<=1.0);
            assert!(residual_discount(d+1,p,h)<=g);
            assert!(residual_discount(d,p+1,h)<=g);
        }}}
    }
    #[test]
    fn residual_template_and_bag_independence(){
        let start:crate::tbp::Start=serde_json::from_value(serde_json::json!({"board":[],"queue":["T","I","T","S","T","J"],"hold":"I","combo":0,"back_to_back":false})).unwrap();
        let config=std::sync::Arc::new(crate::bot::BotConfig::review_h9_h12());
        let mut s=crate::try_create_bot_with_context(start,config.clone(),TetrioRules::default(),false).unwrap().state();
        let w=&config.freestyle_weights;
        assert_eq!(residual_board_value(w,&s,(0,5)),residual_base(w,&s.board));
        // Template x=1,y=1 faces an open T cavity completing two rows.
        s.board.cols=[1,0,5,3,3,3,3,3,3,3];
        let before=s.board;
        assert!(well_known_tslot_left(&s.board).is_some());
        let value=residual_board_value(w,&s,(1,5));
        assert!(value>residual_base(w,&s.board));
        s.bag=EnumSet::only(Piece::T);assert_eq!(residual_board_value(w,&s,(1,5)),value);
        s.bag=EnumSet::all();assert_eq!(residual_board_value(w,&s,(1,5)),value);
        assert_eq!(s.board,before);
    }
    #[test]
    fn residual_hold_transitions_conserve_supply(){
        for (hold,played,next,suffix,expected) in [
            (None,Piece::T,Piece::I,(0,3),10),
            (None,Piece::I,Piece::I,(2,3),1),
            (Some("T"),Piece::T,Piece::I,(0,3),10),
            (Some("I"),Piece::I,Piece::T,(0,3),1),
        ] {
            let start:crate::tbp::Start=serde_json::from_value(serde_json::json!({"board":[],"queue":["T","I","S","Z","L","J"],"hold":hold,"combo":0,"back_to_back":false})).unwrap();
            let mut s=crate::try_create_bot_with_context(start,std::sync::Arc::new(crate::bot::BotConfig::review_h9_h12()),TetrioRules::default(),false).unwrap().state();
            let mv=crate::movegen::find_moves_with_clutch(&s.board,played,false)[0].0;
            s.advance(next,mv);
            assert_eq!(residual_delay(s.reserve,suffix),expected);
        }
    }
    #[cfg(residual_trace)]
    #[test]
    fn residual_trace_real_inputs(){
        let Ok(path)=std::env::var("RESIDUAL_INPUT") else {return;};
        let samples:Vec<serde_json::Value>=serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
        let mut out=Vec::new();
        for row in samples {
            RESIDUAL_WITNESSES.with(|r|r.borrow_mut().clear());
            let report=crate::snapshot::analyze_text(&row["request"].to_string()).unwrap();
            // Keep typed report serialization, avoiding f32 widening via Value.
            let report=serde_json::to_string(&report).unwrap();
            let witnesses=RESIDUAL_WITNESSES.with(|r|r.borrow().clone());
            out.push(format!("{{\"id\":{},\"report\":{},\"witnesses\":{}}}",row["id"],report,serde_json::to_string(&witnesses).unwrap()));
        }
        std::fs::write(std::env::var("RESIDUAL_OUTPUT").unwrap(),format!("[{}]",out.join(","))).unwrap();
    }
}
