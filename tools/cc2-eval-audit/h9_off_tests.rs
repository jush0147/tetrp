#[cfg(test)]
mod h9_off_gate_tests {
    use super::*;
    #[test]
    fn config_identity_and_full_evaluator_delta() {
        let config = crate::bot::BotConfig::review_h9_h12();
        assert_eq!(config.freestyle_weights.h9_cavity_excavation,
            if cfg!(h9_off) { 0.0 } else { -0.5 });
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
        let mut on=config.freestyle_weights.clone();on.h9_cavity_excavation=-0.5;
        let mut off=on.clone();off.h9_cavity_excavation=0.0;
        // Equal hole counts but different empty-cell connectivity, and a larger cavity.
        for (cols,cost) in [([7,5,7,0,0,0,0,0,0,0],1),([7,7,5,0,0,0,0,0,0,0],0),
            ([7,5,5,7,0,0,0,0,0,0],1),([0;10],0)] {
            state.board.cols=cols;
            assert_eq!(cavity_excavation_cost(&state.board),cost);
            let (a,ar)=evaluate(&on,state,&info,0,0,0);
            let (b,br)=evaluate(&off,state,&info,0,0,0);
            assert_eq!(ar.value,br.value,"Reward changed");
            assert!((b.value.0-a.value.0-0.5*cost as f32).abs()<0.0001,
                "Only H9 may contribute to same-state Eval delta");
        }
    }
}
