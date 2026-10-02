import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {nativeClient} from './kiwi-native-client.js';
const root='.cache/cc2-wasm-source',out='.cache/h1-short';
if(process.argv[2]==='install'){
 let s=await readFile(`${root}/src/bot/freestyle.rs`,'utf8');
 const insert=(anchor,code)=>{assert.equal(s.split(anchor).length,2);s=s.replace(anchor,code+'\n'+anchor);};
 insert('    // H1: unsafe structure','    #[cfg(h1_activation)] let h1_before = eval;');
 insert('    let legacy_shape = legacy_clear_reward','    #[cfg(h1_activation)] crate::h1_activation::record(eval-h1_before);');
 await writeFile(`${root}/src/bot/freestyle.rs`,s);
 await writeFile(`${root}/src/lib.rs`,(await readFile(`${root}/src/lib.rs`,'utf8'))+'\n#[cfg(h1_activation)] pub mod h1_activation;\n');
 await copyFile('tools/cc2-eval-audit/h1_activation.rs',`${root}/src/h1_activation.rs`);
 await mkdir(`${root}/src/bin`,{recursive:true});
 await writeFile(`${root}/src/bin/snapshot_activation.rs`,String.raw`
use std::io::{self,BufRead,Write};
fn main()->Result<(),Box<dyn std::error::Error>> {
 let stdin=io::stdin();let stdout=io::stdout();let mut out=stdout.lock();
 for line in stdin.lock().lines(){
  cold_clear_2::h1_activation::reset();
  let report=cold_clear_2::snapshot::analyze_text(&line?)?;
  let encoded=serde_json::to_string(&report)?;
  out.write_all(b"{\"ok\":true,\"report\":")?;
  out.write_all(encoded[..encoded.len()-1].as_bytes())?;
  out.write_all(b",\"_h1Activation\":")?;
  serde_json::to_writer(&mut out,&cold_clear_2::h1_activation::finish())?;
  out.write_all(b"}}\n")?;out.flush()?;
 }Ok(())
}
`);
}else if(process.argv[2]==='audit'){
 const witnesses=JSON.parse(await readFile(`${out}/witnesses.json`)),result=JSON.parse(await readFile(`${out}/result.json`));
 const client=nativeClient(resolve(`${root}/target/release/snapshot_activation`));
 const observed=[];try{
  for(const w of witnesses){const r=await client.request(JSON.stringify(w.requestInput)),c=r._h1Activation;delete r._h1Activation;
   assert.deepEqual(r,w.on.report,'Observer changed accepted policy report');assert.ok(c.evaluations>0);
   observed.push({id:w.id,frame:w.frame,pending:w.pending,changedTop1:w.changedTop1,...c});}
 }finally{await client.close();}
 result.activation={observed,nonzeroWitnesses:observed.filter(r=>r.nonzero>0).length,scope:'Actual evaluated-node H1 increments; terminal early returns excluded. Offline replay only, exact report parity required.'};
 await writeFile(`${out}/result.json`,JSON.stringify(result,null,2));
}else throw Error('install | audit');
