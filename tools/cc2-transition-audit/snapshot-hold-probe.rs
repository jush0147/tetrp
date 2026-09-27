/// Audit-only observer: use the real request parser, post-Hold helper and analyzer.
pub fn audit_snapshot_hold(text:&str)->Result<Value,String>{
    let r=parse(text)?;
    let post=if r.hold_locked {Value::Null}else{
        let (root,len,same,basis)=post_hold_root(&r);
        json!({"queue":root.queue,"hold":root.hold,"knownLength":len,"samePiece":same,"basis":basis})
    };
    let report=analyze_text(text)?;
    let holds:Vec<_>=report.candidates.iter().filter(|c|matches!(c.action,Action::Hold{..})).map(|c|&c.action).collect();
    Ok(json!({"post":post,"holds":holds,"nodes":report.nodes}))
}
