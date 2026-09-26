// Read-only instrumentation of a disposable pinned CC2 checkout. No policy changes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
export const PIN='2e243242b674d57491f99b445f75e35fc48a0e26';
const root=resolve(process.argv[2]??'.cache/cc2-transition-source');
const dest=resolve(process.argv[3]??'.cache/cc2-transition-results');
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),PIN);
assert.equal(execFileSync('git',['-C',root,'status','--porcelain'],{encoding:'utf8'}).trim(),'','requires pristine disposable checkout');
await mkdir(dest,{recursive:true});
const hash=s=>createHash('sha256').update(s).digest('hex');
const changes=[];
async function patch(file,fn){
  const before=await readFile(`${root}/${file}`,'utf8'),after=fn(before);
  await writeFile(`${root}/${file}`,after);changes.push({file,before:hash(before),after:hash(after)});
}
function once(s,needle,addition){assert.equal(s.split(needle).length,2,`unique source anchor: ${needle}`);return s.replace(needle,needle+addition);}
await patch('src/lib.rs',s=>s+'\npub mod transition_audit_observer;\n');
await patch('src/forecast.rs',s=>{
  s=once(s,'self.consume(cancelled);','\n            crate::transition_audit_observer::attack(attack,cancelled,outgoing);');
  s=once(s,'board.garbage_rows=(board.garbage_rows<<1)|1;','\n                crate::transition_audit_observer::tanked(hole);');
  return s+`\nimpl Forecast {
    pub fn transition_audit_readout(&self)->serde_json::Value {
        serde_json::json!({"elapsed":self.elapsed_frames,"pieces":self.pieces_placed,
            "sent":self.sent,"toppedOut":self.topped_out,
            "pending":self.packets[..self.len].iter().map(|p|serde_json::json!({
                "amt":p.lines,"ready":p.ready_at,"active":p.ready_at<=self.elapsed_frames,
                "hypotheticalHole":p.hole})).collect::<Vec<_>>()})
    }
}\n`;
});
const observer=`use std::cell::RefCell;
use serde_json::{json,Value};
thread_local! {static EVENTS:RefCell<Vec<Value>>=RefCell::new(Vec::new());}
pub fn reset(){EVENTS.with(|e|e.borrow_mut().clear());}
pub fn take()->Vec<Value>{EVENTS.with(|e|std::mem::take(&mut *e.borrow_mut()))}
pub fn attack(g:u32,c:u32,s:u32){EVENTS.with(|e|e.borrow_mut().push(json!({"kind":"attack","generated":g,"cancelled":c,"sent":s})));}
pub fn tanked(h:u8){EVENTS.with(|e|e.borrow_mut().push(json!({"kind":"tank","hole":h})));}
`;
await writeFile(`${root}/src/transition_audit_observer.rs`,observer);
const diff=execFileSync('git',['-C',root,'diff','--','src/lib.rs','src/forecast.rs'],{encoding:'utf8'});
await writeFile(`${dest}/instrumentation.patch`,diff);
await writeFile(`${dest}/instrumentation.json`,JSON.stringify({pin:PIN,changes,observerSha256:hash(observer),
  scope:'readout and diagnostic event hooks only; GameState/Forecast rules unchanged'},null,2));
console.log('Pinned CC2 observer prepared; gameplay source unchanged apart from observation hooks.');
