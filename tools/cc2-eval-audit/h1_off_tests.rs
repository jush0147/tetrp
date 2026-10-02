#[cfg(test)]
mod h1_off_gate_tests {
    use super::*;
    #[test]
    fn config_identity_and_full_evaluator_delta() {
        let config = crate::bot::BotConfig::review_h9_h12();
        assert_eq!(config.freestyle_weights.pending_safety,
            if cfg!(h1_off) { 0.0 } else { 1.0 });
        assert_eq!(config.freestyle_weights.h9_cavity_excavation,-0.5);
        if let Ok(path) = std::env::var("KIWI_CONFIG_OUTPUT") {
            std::fs::write(path,serde_json::to_string_pretty(&config).unwrap()).unwrap();
        }
        let start:crate::tbp::Start=serde_json::from_value(serde_json::json!({
            "board":[],"queue":["I","T","S","Z","J","L"],"hold":"O","combo":0,"back_to_back":false
        })).unwrap();
        let mut state=crate::try_create_bot_with_context(start,std::sync::Arc::new(config.clone()),
            TetrioRules::default(),false).unwrap().state();
        let info=PlacementInfo {
            placement:Placement {location:PieceLocation {piece:Piece::I,rotation:Rotation::North,x:4,y:3},spin:Spin::None},
            lines_cleared:0,garbage_cleared:0,combo:0,back_to_back:false,
            b2b_count_before:0,b2b_count_after:0,b2b_broken:false,perfect_clear:false,
        };
        let mut on=config.freestyle_weights.clone();on.pending_safety=1.0;
        let mut off=on.clone();off.pending_safety=0.0;
        // Same post-transition state: no garbage clock, cancellation or board logic changes.
        // Danger magnitudes: clean low=0, one covered hole=1.5+2*0.2,
        // clean height16=6*1.5+1*5. Pending pressure caps at 16/8.
        for (cols,danger) in [([0;10],0.0),([7,5,7,0,0,0,0,0,0,0],1.9),
            ([65535,0,0,0,0,0,0,0,0,0],14.0)] {
            for pending in [0u32,4,8,16,20] {
                for ready_in in [0,48] {
                    state.board.cols=cols;
                    let packets=if pending==0 {vec![]} else {vec![(pending,ready_in)]};
                    state.forecast=crate::forecast::Forecast::new_timed(&packets,14,0,24,0).unwrap();
                    assert_eq!(state.forecast.remaining(),pending);
                    let (a,ar)=evaluate(&on,state,&info,0,pending,0);
                    let (b,br)=evaluate(&off,state,&info,0,pending,0);
                    assert_eq!(ar.value,br.value,"Reward/cancellation changed");
                    let expected=pending.min(16) as f32/8.0*danger;
                    assert!((b.value.0-a.value.0-expected).abs()<0.0001,
                        "Only H1 may contribute to same-state Eval delta: {} vs {}",b.value.0-a.value.0,expected);
                }
            }
        }
    }
}
