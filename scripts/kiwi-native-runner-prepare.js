// Only adds a JSON-lines transport binary; search and rules remain unchanged.
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.argv[2]??'.cache/cc2-wasm-source';
await mkdir(`${root}/src/bin`,{recursive:true});
await writeFile(`${root}/src/bin/snapshot_stdio.rs`,String.raw`
use std::io::{self, BufRead, Write};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let stdin=io::stdin(); let stdout=io::stdout(); let mut out=stdout.lock();
    for line in stdin.lock().lines() {
        let line=line?;
        // Serialize the typed report directly, like analyze_snapshot_json.
        // Converting via serde_json::Value would widen f32 score formatting.
        match cold_clear_2::snapshot::analyze_text(&line) {
            Ok(report) => {write!(out,"{{\"ok\":true,\"report\":")?;
                serde_json::to_writer(&mut out,&report)?; writeln!(out,"}}")?;},
            Err(error) => {writeln!(out,"{}",serde_json::json!({"ok":false,"error":error}))?;},
        }
        out.flush()?;
    }
    Ok(())
}
`);
