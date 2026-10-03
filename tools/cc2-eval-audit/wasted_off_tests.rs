#[cfg(test)]
mod wasted_off_gate_tests {
    use super::*;
    #[test]
    fn config_identity_and_full_evaluator_delta() {
        let config = crate::bot::BotConfig::review_h9_h12();
        assert_eq!(config.freestyle_weights.wasted_t,
            if cfg!(wasted_off) { 0.0 } else { -1.5 });
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
        let mut on=config.freestyle_weights.clone();on.wasted_t=-1.5;
        let mut off=on.clone();off.wasted_t=0.0;
        // Full evaluate, same post-transition state: only Reward may change.
        for piece in [Piece::T,Piece::I] {
            for spin in [Spin::None,Spin::Mini,Spin::Full] {
                for lines in 0..=4 {
                    for pc in [false,true] {
                        let mut info=info.clone();
                        info.placement.location.piece=piece;info.placement.spin=spin;
                        info.lines_cleared=lines;info.perfect_clear=pc;
                        let (a,ar)=evaluate(&on,state,&info,0,0,0);
                        let (b,br)=evaluate(&off,state,&info,0,0,0);
                        assert_eq!(a.value,b.value,"Leaf changed");
                        let expected=if piece==Piece::T && (lines<2 || !matches!(spin,Spin::Full)) {1.5} else {0.0};
                        assert!((br.value-ar.value-expected).abs()<0.0001,"Unexpected Reward delta");
                    }
                }
            }
        }
    }
}
