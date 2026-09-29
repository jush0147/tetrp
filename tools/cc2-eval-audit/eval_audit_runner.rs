fn typed_report_json<T: serde::Serialize>(report:&T)->String {
    serde_json::to_string(report).unwrap()
}

#[test]
fn eval_audit_runner_preserves_f32_json() {
    #[derive(serde::Serialize)]
    struct Scores { worst_score:f32, mean_score:f64 }
    let scores=Scores { worst_score:-58.4, mean_score:-58.400001525878906 };
    assert_eq!(typed_report_json(&scores),
        "{\"worst_score\":-58.4,\"mean_score\":-58.400001525878906}");
    assert_ne!(typed_report_json(&scores),
        serde_json::to_string(&serde_json::to_value(&scores).unwrap()).unwrap());
}

#[test]
fn eval_audit_runner(){
    let input=std::env::var("EVAL_AUDIT_INPUT").expect("input path");
    let output=std::env::var("EVAL_AUDIT_OUTPUT").expect("output path");
    let rows:Vec<serde_json::Value>=serde_json::from_str(&std::fs::read_to_string(input).unwrap()).unwrap();
    let mut reports=Vec::new();
    for row in rows {
        #[cfg(eval_observer)] crate::eval_observer::reset();
        let started=std::time::Instant::now();
        let report=crate::snapshot::analyze_text(&row["request"].to_string()).expect("snapshot accepted");
        let elapsed_ms=started.elapsed().as_secs_f64()*1000.0;
        // Serialize the typed report directly, exactly as the WASM API does.
        // to_value widens f32 worst_score to a JSON Number backed by f64 and
        // changes decimal rendering without changing the underlying f32 score.
        let report_json=typed_report_json(&report);
        #[cfg(eval_observer)] let diagnostic=crate::eval_observer::finish();
        #[cfg(not(eval_observer))] let diagnostic=serde_json::Value::Null;
        reports.push(format!("{{\"id\":{},\"report\":{},\"diagnostic\":{},\"elapsedMs\":{}}}",
            serde_json::to_string(&row["id"]).unwrap(),report_json,
            serde_json::to_string(&diagnostic).unwrap(),elapsed_ms));
    }
    std::fs::write(output,format!("[{}]",reports.join(","))).unwrap();
}
