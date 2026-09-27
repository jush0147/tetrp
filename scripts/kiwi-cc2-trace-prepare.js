import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root=process.argv[2]??'.cache/cc2-transition-source';
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'2e243242b674d57491f99b445f75e35fc48a0e26');
async function edit(file,a,b){const s=await readFile(`${root}/${file}`,'utf8');assert.equal(s.split(a).length,2,a);await writeFile(`${root}/${file}`,s.replace(a,b));}
await edit('src/lib.rs','pub mod transition_audit_observer;','pub mod transition_audit_observer;\npub mod dag_replay_observer;');
await writeFile(`${root}/src/dag_replay_observer.rs`,await readFile('tools/cc2-transition-audit/dag-replay-observer.rs'));
await edit('src/bot.rs',
 '        let info = self.current.advance(self.queue.pop_front().expect("cannot advance an exhausted search queue"), mv);',
 '        let info = self.current.advance(self.queue.pop_front().expect("cannot advance an exhausted search queue"), mv);\n        crate::dag_replay_observer::committed();');
await edit('src/dag.rs','                    game_state.advance(next, placement);',`                    let before=game_state;
                    game_state.advance(next, placement);
                    crate::dag_replay_observer::replay(before,next,placement,game_state);`);
await edit('src/dag.rs','        let mut layers = self.layers;',`        for (piece,list) in &children { for child in list {
            crate::dag_replay_observer::record(self.game_state,piece,child.mv,child.resulting_state);
        }}
        let mut layers = self.layers;`);
await mkdir('.cache/cc2-trace-results',{recursive:true});
await writeFile('.cache/cc2-trace-results/dag-instrumentation.patch',execFileSync('git',['-C',root,'diff','--','src/dag.rs','src/bot.rs'],{encoding:'utf8'}));
