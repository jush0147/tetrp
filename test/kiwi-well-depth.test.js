import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformWellConfig,wellCandidateConfig,renderWellTests} from '../scripts/kiwi-well-depth-prepare.js';
test('well-off isolates one coefficient and preserves other profile bodies',()=>{
 const original=JSON.parse(readFileSync('docs/audits/cc2-alignment/ACTIVE_PARAMETERS_2026-09-28.json')).config;
 const expected=structuredClone(original);expected.freestyle_weights.tetris_well_depth=0;
 assert.deepEqual(wellCandidateConfig(original),expected);assert.equal(original.freestyle_weights.tetris_well_depth,0.3);
 const other='    pub fn other() -> Self {\n        config.freestyle_weights.tetris_well_depth = 0.8;\n    }\n';
 const body='    pub fn review_h9_h12() -> Self {\n        config.freestyle_weights.h3_surge_bank_value = 0.0;\n        config\n    }';
 const patched=transformWellConfig(other+body);assert.ok(patched.startsWith(other));
 assert.equal(patched.replace('\n        if cfg!(well_depth_candidate) { config.freestyle_weights.tetris_well_depth = 0.0; }',''),other+body);
 assert.throws(()=>transformWellConfig(patched));assert.throws(()=>transformWellConfig(body+body));
 assert.throws(()=>transformWellConfig(body.replace('        config\n','        config.freestyle_weights.tetris_well_depth = 1.0;\n        config\n')));
});

test('well 0.6 changes only the well coefficient and expands matching Rust expectation',()=>{
 const original=JSON.parse(readFileSync('docs/audits/cc2-alignment/ACTIVE_PARAMETERS_2026-09-28.json')).config;
 const expected=structuredClone(original);expected.freestyle_weights.tetris_well_depth=0.6;
 assert.deepEqual(wellCandidateConfig(original,0.6),expected);
 const body='    pub fn review_h9_h12() -> Self {\n        config.freestyle_weights.h3_surge_bank_value = 0.0;\n        config\n    }';
 const patched=transformWellConfig(body,0.6);
 assert.equal(patched.replace('\n        if cfg!(well_depth_candidate) { config.freestyle_weights.tetris_well_depth = 0.6; }',''),body);
 assert.throws(()=>transformWellConfig(patched,0));
 const tests=readFileSync('tools/cc2-eval-audit/well_depth_tests.rs','utf8');
 for(const weight of [0,0.6]){const rendered=renderWellTests(tests,weight);assert.ok(!rendered.includes('CANDIDATE_WELL_WEIGHT'));assert.ok(rendered.includes('candidate.tetris_well_depth='+weight.toFixed(1)));assert.ok(rendered.includes('('+weight.toFixed(1)+'-0.3)'));}
 for(const bad of [-1,0.3,1,NaN,'0.6']){assert.throws(()=>wellCandidateConfig(original,bad));assert.throws(()=>transformWellConfig(body,bad));assert.throws(()=>renderWellTests(tests,bad));}
 assert.throws(()=>renderWellTests('missing placeholder',0.6));
});

test('arena well variants map exactly to isolated candidate configurations',async()=>{
 const {variant,candidateConfig}=await import('../scripts/kiwi-surge-variant.js');
 const {transformConfig}=await import('../scripts/kiwi-surge-residual-prepare.js');
 const original=JSON.parse(readFileSync('docs/audits/cc2-alignment/ACTIVE_PARAMETERS_2026-09-28.json')).config;
 const source='    pub fn review_h9_h12() -> Self {\n        config.freestyle_weights.h3_surge_bank_value = 0.0;\n        config\n    }';
 for(const [name,weight] of [['well-off',0],['well-double',0.6]]){
  assert.deepEqual(candidateConfig(original,variant(name)),wellCandidateConfig(original,weight));
  assert.equal(transformConfig(source,variant(name)),transformWellConfig(source,weight));
 }
});
