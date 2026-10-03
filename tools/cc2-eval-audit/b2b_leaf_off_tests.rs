#[cfg(test)]
mod b2b_leaf_off_gate_tests {
    use super::*;
    #[test]
    fn config_and_full_evaluator_leaf_only_delta() {
        let config=crate::bot::BotConfig::review_h9_h12();
        assert_eq!(config.freestyle_weights.has_back_to_back,if cfg!(b2b_leaf_off) {0.0} else {0.5});
        assert_eq!(config.freestyle_weights.h3_b2b_charge_value,0.0);
        assert_eq!(config.freestyle_weights.h3_surge_bank_value,0.0);
        assert_eq!(config.freestyle_weights.wasted_t,-1.5);
        if let Ok(path)=std::env::var("KIWI_CONFIG_OUTPUT") {
            std::fs::write(path,serde_json::to_string_pretty(&config).unwrap()).unwrap();
        }
        let start:crate::tbp::Start=serde_json::from_value(serde_json::json!({
            "board":[],"queue":["I","T","S","Z","J","L"],"hold":"O","combo":0,"back_to_back":false
        })).unwrap();
        let initial=crate::try_create_bot_with_context(start,std::sync::Arc::new(config.clone()),TetrioRules::default(),false).unwrap().state();
        let mut on=config.freestyle_weights.clone();on.has_back_to_back=0.5;
        let mut off=on.clone();off.has_back_to_back=0.0;
        // Same-state synthetic evaluator cases, not legal placement claims.
        for active in [false,true] { for count in [0,1,3,4,8,20] { for charging in [false,true] { for pc in [false,true] { for dead in [false,true] {
            let mut state=initial;state.back_to_back=active;state.b2b_count=count;
            state.rules.b2b_charging=charging;state.forecast.topped_out=dead;
            let info=PlacementInfo {
                placement:Placement {location:PieceLocation {piece:Piece::I,rotation:Rotation::North,x:4,y:3},spin:Spin::None},
                lines_cleared:0,garbage_cleared:0,combo:0,back_to_back:false,
                b2b_count_before:0,b2b_count_after:count as u32,b2b_broken:false,perfect_clear:pc,
            };
            let (a,ar)=evaluate(&on,state,&info,0,0,0);
            let (b,br)=evaluate(&off,state,&info,0,0,0);
            assert_eq!(ar.value,br.value,"Edge reward changed");
            let expected=if active && !dead {-0.5} else {0.0};
            assert!((b.value.0-a.value.0-expected).abs()<0.0001,"Wrong leaf delta");
        }}}}}
    }
}
