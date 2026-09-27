#[cfg(test)]
mod spawn_audit_tests {
    use super::*;
    use crate::{data::*,tbp::Start,try_create_bot_with_context};
    fn bot(empty:bool)->Bot {
        let start:Start=serde_json::from_value(serde_json::json!({"board":[],"queue":["T","I","O","S","Z","J"],
            "hold":if empty {None}else{Some("L")},"combo":0,"back_to_back":false})).unwrap();
        try_create_bot_with_context(start,Arc::new(BotConfig::review_h9_h12()),TetrioRules::default(),false).unwrap()
    }
    #[test]
    fn empty_hold_lineage_survives_normal_placements_and_enters_state_identity(){
        let mut b=bot(true);assert!(b.state().hold_is_empty);
        let mut other=b.state();other.hold_is_empty=false;assert_ne!(b.state(),other);
        for _ in 0..2 {
            let p=b.player_pieces().current.unwrap();let mv=find_moves_with_clutch(&b.state().board,p,false)[0].0;
            b.try_play(mv,false).unwrap();assert!(b.state().hold_is_empty);
            assert_eq!(b.state().reserve,b.player_pieces().current.unwrap());
        }
    }
    #[test]
    fn first_hold_switches_lineage(){
        let mut b=bot(true);let p=b.player_pieces().next[0];
        let mv=find_moves_with_clutch(&b.state().board,p,false)[0].0;
        b.try_play(mv,true).unwrap();assert!(!b.state().hold_is_empty);
        assert_eq!(b.player_pieces().hold,Some(Piece::T));
    }
    #[test]
    fn occupied_hold_stays_occupied(){assert!(!bot(false).state().hold_is_empty);}
    #[test]
    fn actual_second_dag_expansion_cannot_hold_out_of_dead_spawn(){
        for empty in [false,true] {
            let mut rows=vec![vec![serde_json::Value::Null;10];40];rows[21][3]=serde_json::json!("J");
            let start:Start=serde_json::from_value(serde_json::json!({"board":rows,"queue":["O","I","O","S","Z","J"],
                "hold":if empty {None}else{Some("O")},"combo":0,"back_to_back":false})).unwrap();
            let b=crate::try_create_bot_with_search_context(start,Arc::new(BotConfig::review_h9_h12()),
                TetrioRules::default(),false,true,None).unwrap();
            assert!(b.do_work_limited(100000).nodes>0);
            let second=b.do_work_limited(100000);
            assert_eq!(second.max_depth,2);assert_eq!(second.nodes,0);assert_eq!(second.expansions,1);
        }
    }
    #[test]
    fn known_active_root_is_not_rejected_by_spawn_obstruction(){
        let mut b=bot(false);
        // T spawn intersects this cell, but a supplied active-pose landing is valid below it.
        b.current.board.cols[3]|=1<<21;
        let landing=find_moves_with_clutch(&Board::default(),Piece::T,false)[0].0;
        let mut options=b.options;options.root_no_hold_only=true;
        options.root_legal_placements=Some(Arc::new(vec![landing]));
        let state=b.current;
        let b=Bot::new(options,state,&[Piece::T,Piece::I,Piece::O]);
        b.do_work_limited(100000);
        assert_eq!(b.ranked_suggestions().len(),1);
    }
}
