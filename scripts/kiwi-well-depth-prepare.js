// Prepared offline only; no workflow dispatch or production asset changes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
function validateWeight(weight){assert.ok(weight===0||weight===0.6,'Only fixed well candidates 0 and 0.6 are authorized');}
export function renderWellTests(source,weight=0){
 validateWeight(weight);assert.ok(source.includes('CANDIDATE_WELL_WEIGHT'),'Missing test weight placeholder');
 return source.replaceAll('CANDIDATE_WELL_WEIGHT',weight.toFixed(1));
}
export function transformWellConfig(source,weight=0){
 validateWeight(weight);
 assert.ok(!source.includes('cfg!(well_depth_off)')&&!source.includes('cfg!(well_depth_candidate)'),'Already installed');
 const marker='    pub fn review_h9_h12() -> Self {';
 assert.equal(source.split(marker).length,2);
 const start=source.indexOf(marker),end=source.indexOf('\n    }',start);assert.ok(end>start);
 const body=source.slice(start,end),anchor='        config.freestyle_weights.h3_surge_bank_value = 0.0;';
 assert.equal(body.split(anchor).length,2);assert.ok(!body.includes('tetris_well_depth'),'Unexpected existing override');
 const extra='\n        if cfg!(well_depth_candidate) { config.freestyle_weights.tetris_well_depth = '+weight.toFixed(1)+'; }';
 return source.slice(0,start)+body.replace(anchor,anchor+extra)+source.slice(end);
}
export function wellCandidateConfig(original,weight=0){
 validateWeight(weight);
 const result=structuredClone(original);assert.equal(result.freestyle_weights.tetris_well_depth,0.3);
 result.freestyle_weights.tetris_well_depth=weight;return result;
}
if(process.argv[2]==='install'){
 const root=process.argv[3];assert.ok(root,'Explicit isolated source directory required');
 const weight=Number(process.argv[4]??0);validateWeight(weight);
 const candidate=weight===0?'well-depth-off':'well-depth-double';
 const output=`.cache/${candidate}-build`;await mkdir(output,{recursive:true});
 const before=await readFile(`${root}/src/bot.rs`,'utf8'),evaluator=await readFile(`${root}/src/bot/freestyle.rs`,'utf8');
 assert.ok(!evaluator.includes('mod well_depth_gate_tests'),'Tests already installed');
 const after=transformWellConfig(before,weight),tests=renderWellTests(await readFile('tools/cc2-eval-audit/well_depth_tests.rs','utf8'),weight);
 await writeFile(`${root}/src/bot.rs`,after);
 await writeFile(`${root}/src/bot/freestyle.rs`,evaluator+'\n'+tests);
 const sha=s=>createHash('sha256').update(s).digest('hex');
 await writeFile(`${output}/source-delta.json`,JSON.stringify({candidate,weight,cfg:'well_depth_candidate',beforeConfig:sha(before),afterConfig:sha(after),evaluatorBefore:sha(evaluator),evaluatorAfter:sha(evaluator),note:`Evaluator unchanged, only test module appended; candidate changes 0.3 to ${weight}`},null,2)+'\n');
}
