import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export function instrument(source){
 let s=source;const put=(anchor,value)=>{assert.equal(s.split(anchor).length,2,anchor);s=s.replace(anchor,value);};
 assert.ok(!s.includes('tail_value('),'already installed');
 put('    dag: Dag<Eval>,','    dag: Dag<Eval>,\n    known_depth: usize,');
 put('            dag: Dag::new(root, queue),','            dag: Dag::new(root, queue),\n            known_depth: queue.len(),');
 put('            let mut children: EnumMap<_, Vec<_>> = EnumMap::default();','            let mut children: EnumMap<_, Vec<_>> = EnumMap::default();\n            let mut staged_probes=0;');
 put('                    for (mv, sd_distance) in selected {','                    let sibling_count=selected.len();\n                    for (sibling_index,(mv, sd_distance)) in selected.into_iter().enumerate() {');
 put('                        children[next].push(ChildData {',`                        #[cfg(any(tail_value_candidate,tail_value_shadow))]
                        let eval=if node.depth()==self.known_depth && !state.forecast.topped_out {
                            let reserve=(sibling_count-sibling_index-1) as u64;
                            let allowance=crate::tail_probe_audit::allowance(budget.saturating_sub(new_stats.nodes).saturating_sub(reserve));
                            let (value,cost)=tail_value(&options.config.freestyle_weights,state,allowance);
                            new_stats.nodes+=cost;
                            crate::tail_probe_audit::probe(cost,value.is_some());
                            if let Some(value)=value {staged_probes+=1;if cfg!(tail_value_candidate){value}else{eval}} else {eval}
                        } else {eval};
                        children[next].push(ChildData {`);
 put('            new_stats.expansions += 1;','            crate::tail_probe_audit::publish(staged_probes);\n            new_stats.expansions += 1;');
 return s;
}
export function instrumentAllocation(source){
 const anchor='        let mut stats = Statistics::default();';
 assert.ok(!source.includes('tail_probe_audit::begin'));assert.equal(source.split(anchor).length,2);
 return source.replace(anchor,'        crate::tail_probe_audit::begin(allocation);\n'+anchor);
}
if(process.argv[2]==='install'){
 const root=process.argv[3]??'.cache/cc2-wasm-source',out='.cache/tail-value-build';await mkdir(out,{recursive:true});
 const file=`${root}/src/bot/freestyle.rs`,before=await readFile(file,'utf8');
 const sha=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(sha(before),'9fe27a686c21515eb729af2ec73c4b99cd0ad6201b783fd35319a93c265f03d1','Expected accepted evaluator');
 const after=instrument(before)+'\n'+await readFile('tools/cc2-eval-audit/tail_value.rs','utf8');await writeFile(file,after);
 const analysis=`${root}/src/analysis.rs`;await writeFile(analysis,instrumentAllocation(await readFile(analysis,'utf8')));
 await copyFile('tools/cc2-eval-audit/tail_probe_audit.rs',`${root}/src/tail_probe_audit.rs`);
 await writeFile(`${root}/src/lib.rs`,(await readFile(`${root}/src/lib.rs`,'utf8'))+'\npub mod tail_probe_audit;\n');
 await mkdir(`${root}/src/bin`,{recursive:true});
 await writeFile(`${root}/src/bin/snapshot_tail.rs`,String.raw`
use std::io::{self,BufRead,Write};
fn main()->Result<(),Box<dyn std::error::Error>> {
 let stdin=io::stdin();let stdout=io::stdout();let mut out=stdout.lock();
 for line in stdin.lock().lines(){
  cold_clear_2::tail_probe_audit::reset();
  match cold_clear_2::snapshot::analyze_text(&line?) {
   Ok(report)=>{
    let encoded=serde_json::to_string(&report)?;
    out.write_all(b"{\"ok\":true,\"report\":")?;out.write_all(encoded[..encoded.len()-1].as_bytes())?;
    out.write_all(b",\"value_model\":")?;serde_json::to_writer(&mut out,&if cfg!(tail_value_candidate){"experimental-iid-one-step-frontier-bounded-v2"}else if cfg!(tail_value_shadow){"experimental-iid-one-step-shadow-bounded-v2"}else{"accepted"})?;
    out.write_all(b",\"_tailProbe\":")?;serde_json::to_writer(&mut out,&cold_clear_2::tail_probe_audit::finish())?;
    out.write_all(b"}}\n")?;
   },Err(e)=>{writeln!(out,"{}",serde_json::json!({"ok":false,"error":e}))?;}
  }out.flush()?;
 }Ok(())
}
`);
 await writeFile(`${out}/source-delta.json`,JSON.stringify({before:sha(before),after:sha(after),hypothesis:'one-step IID frontier backup; atomic admission, 20% per-allocation cap, sibling reserve, shadow control; no arena'},null,2));
}
