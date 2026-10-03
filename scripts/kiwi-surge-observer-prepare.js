import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {instrumentContext} from './kiwi-eval-observer-prepare.js';
export function instrument(source){
 const anchor='                        children[next].push(ChildData {';
 assert.equal(source.split(anchor).length,2);
 const insert='                        #[cfg(surge_observer)] crate::surge_observer::observe(node.depth(), state, &info, incoming_before, sent_before, eval.value.0, reward.value.0);\n';
 assert.ok(!source.includes(insert));const after=source.replace(anchor,insert+anchor);assert.equal(after.replace(insert,''),source);return after;
}
if(process.argv[2]==='install'){
 const root=process.argv[3]??'.cache/cc2-wasm-source';
 const file=`${root}/src/bot/freestyle.rs`;await writeFile(file,instrument(await readFile(file,'utf8')));
 for(const kind of ['analysis','dag']){
  const path=`${root}/src/${kind}.rs`,s=(await readFile(path,'utf8')).replace(/\r/g,'');
  await writeFile(path,instrumentContext(s,kind).replaceAll('eval_observer','surge_observer'));
 }
 await writeFile(`${root}/src/lib.rs`,(await readFile(`${root}/src/lib.rs`,'utf8'))+'\n#[cfg(surge_observer)] pub mod surge_observer;\n');
 await copyFile('tools/cc2-eval-audit/surge_observer.rs',`${root}/src/surge_observer.rs`);await mkdir(`${root}/src/bin`,{recursive:true});
 await writeFile(`${root}/src/bin/snapshot_surge.rs`,String.raw`
use std::io::{self,BufRead,Write};
fn main()->Result<(),Box<dyn std::error::Error>> {
 let stdin=io::stdin();let stdout=io::stdout();let mut out=stdout.lock();
 for line in stdin.lock().lines(){
  cold_clear_2::surge_observer::reset();let report=cold_clear_2::snapshot::analyze_text(&line?)?;
  let encoded=serde_json::to_string(&report)?;
  out.write_all(b"{\"ok\":true,\"report\":")?;out.write_all(encoded[..encoded.len()-1].as_bytes())?;
  out.write_all(b",\"_surgeObserver\":")?;serde_json::to_writer(&mut out,&cold_clear_2::surge_observer::finish())?;
  out.write_all(b"}}\n")?;out.flush()?;
 }Ok(())
}
`);
}
