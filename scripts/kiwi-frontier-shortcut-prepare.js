import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export function patchDag(source) {
 const anchor='                    game_state.advance(next, placement);';
 assert.equal(source.split(anchor).length,2,'expected exactly one selection transition');
 assert.ok(source.includes('SelectResult::Advance(next, placement) => {'));
 return source.replace(anchor,`                    // Preserve the original child draw. A finite-visible request would
                    // advance here only to fail at the speculative layer immediately.
                    // Do not force a lazy layer or skip an unexpanded known node.
                    if !speculate && Lazy::get(&layer.next_layer)
                        .is_some_and(|next_layer| next_layer.kind.piece().is_none())
                    {
                        return None;
                    }
${anchor}`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const path=`${process.argv[2]??'.cache/cc2-wasm-source'}/src/dag.rs`;
 await writeFile(path,patchDag(await readFile(path,'utf8')));
}
