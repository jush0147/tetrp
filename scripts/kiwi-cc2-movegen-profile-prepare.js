// Diagnostic counters only, applied AFTER mid-descent.patch in a disposable checkout.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.argv[2]??'.cache/cc2-transition-source';
const dest=process.argv[3]??'.cache/cc2-profile-results';
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'2e243242b674d57491f99b445f75e35fc48a0e26');
let s=await readFile(`${root}/src/movegen.rs`,'utf8');
assert.ok(s.includes('let fast_mode = false;')&&s.includes('expand.soft_drops + 1'));
const before=createHash('sha256').update(s).digest('hex');
function insert(anchor,addition){assert.equal(s.split(anchor).length,2,anchor);s=s.replace(anchor,anchor+addition);}
insert('    let mut queue = BinaryHeap::new();','\n    let mut profile=[0u64;8];');
insert('    while let Some(expand) = queue.pop() {',
  '\n        profile[0]+=1; profile[5]=profile[5].max(queue.len() as u64+1);');
insert('        if expand.soft_drops != values.get(&expand.mv).copied().unwrap_or(40) { continue; }',
  '\n        profile[1]+=1;\n        if expand.mv.location.above_stack(board) {profile[2]+=1;}');
insert('        let drop_dist = expand.mv.location.drop_distance(board);',
  '\n        profile[3]+=drop_dist as u64; if drop_dist==0 {profile[4]+=1;}');
insert('    locks.dedup_by_key(|(m, _)| *m);',
  '\n    profile[6]=values.len() as u64; profile[7]=locks.len() as u64;\n    AUDIT_PROFILE.with(|p|*p.borrow_mut()=profile);');
s+=`\n// Read-only movegen accounting; this build is NEVER used for latency samples.
thread_local! {static AUDIT_PROFILE:std::cell::RefCell<[u64;8]>=std::cell::RefCell::new([0;8]);}
pub fn audit_profile_reset(){AUDIT_PROFILE.with(|p|*p.borrow_mut()=[0;8]);}
pub fn audit_profile_take()->[u64;8]{AUDIT_PROFILE.with(|p|*p.borrow())}
`;
await writeFile(`${root}/src/movegen.rs`,s);await mkdir(dest,{recursive:true});
await writeFile(`${dest}/instrumentation.json`,JSON.stringify({before,after:createHash('sha256').update(s).digest('hex'),
  columns:['popped','expanded','aboveStackExpanded','sumDropDistance','groundedExpanded','maxQueue','uniqueVisited','landings'],
  scope:'counters only; timing disabled; aboveStack is local-column clearance, NOT a proven safe pruning predicate'},null,2));
await writeFile(`${dest}/instrumentation.patch`,execFileSync('git',['-C',root,'diff','--','src/movegen.rs'],{encoding:'utf8'}));
