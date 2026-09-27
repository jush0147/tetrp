#[cfg(test)]
mod alignment_failed_insert_tests {
    use super::*;
    #[test]
    fn emit_boundary_transactions_and_verify_terminal_noop() {
        let mut rows=Vec::new();
        for depth in 0..3 {
            for middle in [false,true] {
                let incoming=if middle {vec![(2,49),(1,0),(4,0)]} else {vec![(5,0)]};
                let mut f=Forecast::new_timed(&incoming,20,0,24,0).unwrap();
                let mut b=Board::default();b.cols=[1u64<<(39-depth);10];
                crate::transition_audit_observer::reset();
                f.resolve(&mut b,&[],0);
                let events=crate::transition_audit_observer::take();
                let tanked=events.iter().filter(|e|e["kind"]=="tank").count();
                assert!(f.topped_out);assert_eq!(tanked,depth as usize);
                rows.push(serde_json::json!({"id":format!("depth-{depth}-middle-{middle}"),
                    "cols":b.cols.map(|c|c.to_string()),"garbageRows":b.garbage_rows.to_string(),
                    "blocked":f.topped_out,"tanked":tanked,
                    "pending":f.packets[..f.len].iter().map(|p|serde_json::json!({
                        "amt":p.lines,"ready":p.ready_at,"hole":p.hole})).collect::<Vec<_>>() }));
                let before=(f,b);
                f.resolve(&mut b,&[99],0);
                assert_eq!((f,b),before,"terminal resolve must be a no-op");
            }
        }
        let path=std::env::var("CC2_FAILED_INSERT_REPORT").expect("boundary report path required");
        std::fs::write(path,serde_json::to_string_pretty(&rows).unwrap()).unwrap();
    }
}
