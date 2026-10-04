import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformWellConfig,wellCandidateConfig} from '../scripts/kiwi-well-depth-prepare.js';
test('well-off isolates one coefficient and preserves other profile bodies',()=>{
 const original=JSON.parse(readFileSync('docs/audits/cc2-alignment/ACTIVE_PARAMETERS_2026-09-28.json')).config;
 const expected=structuredClone(original);expected.freestyle_weights.tetris_well_depth=0;
 assert.deepEqual(wellCandidateConfig(original),expected);assert.equal(original.freestyle_weights.tetris_well_depth,0.3);
 const other='    pub fn other() -> Self {\n        config.freestyle_weights.tetris_well_depth = 0.8;\n    }\n';
 const body='    pub fn review_h9_h12() -> Self {\n        config.freestyle_weights.h3_surge_bank_value = 0.0;\n        config\n    }';
 const patched=transformWellConfig(other+body);assert.ok(patched.startsWith(other));
 assert.equal(patched.replace('\n        if cfg!(well_depth_off) { config.freestyle_weights.tetris_well_depth = 0.0; }',''),other+body);
 assert.throws(()=>transformWellConfig(patched));assert.throws(()=>transformWellConfig(body+body));
 assert.throws(()=>transformWellConfig(body.replace('        config\n','        config.freestyle_weights.tetris_well_depth = 1.0;\n        config\n')));
});
