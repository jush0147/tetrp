#[test]
fn eval_audit_runner(){
    let input=std::env::var("EVAL_AUDIT_INPUT").expect("input path");
    let output=std::env::var("EVAL_AUDIT_OUTPUT").expect("output path");
    let rows:Vec<serde_json::Value>=serde_json::from_str(&std::fs::read_to_string(input).unwrap()).unwrap();
    let mut reports=Vec::new();
    for row in rows {
        #[cfg(eval_observer)] crate::eval_observer::reset();
        let report=crate::snapshot::analyze_text(&row["request"].to_string()).expect("snapshot accepted");
        let value=serde_json::to_value(report).unwrap();
        #[cfg(eval_observer)] let diagnostic=crate::eval_observer::finish();
        #[cfg(not(eval_observer))] let diagnostic=serde_json::Value::Null;
        reports.push(serde_json::json!({"id":row["id"],"report":value,"diagnostic":diagnostic}));
    }
    std::fs::write(output,serde_json::to_string(&reports).unwrap()).unwrap();
}
