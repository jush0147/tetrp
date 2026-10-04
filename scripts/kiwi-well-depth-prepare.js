// Prepared offline only; no workflow dispatch or production asset changes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export function transformWellConfig(source){
 assert.ok(!source.includes('cfg!(well_depth_off)'),'Already installed');
 const marker='    pub fn review_h9_h12() -> Self {';
 assert.equal(source.split(marker).length,2);
 const start=source.indexOf(marker),end=source.indexOf('\n    }',start);assert.ok(end>start);
 const body=source.slice(start,end),anchor='        config.freestyle_weights.h3_surge_bank_value = 0.0;';
 assert.equal(body.split(anchor).length,2);assert.ok(!body.includes('tetris_well_depth'),'Unexpected existing override');
 const extra='\n        if cfg!(well_depth_off) { config.freestyle_weights.tetris_well_depth = 0.0; }';
 return source.slice(0,start)+body.replace(anchor,anchor+extra)+source.slice(end);
}
export function wellCandidateConfig(original){
 const result=structuredClone(original);assert.equal(result.freestyle_weights.tetris_well_depth,0.3);
 result.freestyle_weights.tetris_well_depth=0;return result;
}
if(process.argv[2]==='install'){
 const root=process.argv[3];assert.ok(root,'Explicit isolated source directory required');
 const output='.cache/well-depth-build';await mkdir(output,{recursive:true});
 const before=await readFile(`${root}/src/bot.rs`,'utf8'),evaluator=await readFile(`${root}/src/bot/freestyle.rs`,'utf8');
 assert.ok(!evaluator.includes('mod well_depth_gate_tests'),'Tests already installed');
 const after=transformWellConfig(before),tests=await readFile('tools/cc2-eval-audit/well_depth_tests.rs','utf8');
 await writeFile(`${root}/src/bot.rs`,after);
 await writeFile(`${root}/src/bot/freestyle.rs`,evaluator+'\n'+tests);
 const sha=s=>createHash('sha256').update(s).digest('hex');
 await writeFile(`${output}/source-delta.json`,JSON.stringify({candidate:'well-depth-off',beforeConfig:sha(before),afterConfig:sha(after),evaluatorBefore:sha(evaluator),evaluatorAfter:sha(evaluator),note:'Evaluator unchanged, only test module appended; cfg well_depth_off changes 0.3 to 0'},null,2)+'\n');
}
