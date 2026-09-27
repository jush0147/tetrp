// Release-like candidate: same accepted corrections, without audit observers.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('.cache/cc2-wasm-source'),out='.cache/cc2-wasm-results';
const pin='2e243242b674d57491f99b445f75e35fc48a0e26';
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);
assert.equal(execFileSync('git',['-C',root,'status','--porcelain'],{encoding:'utf8'}).trim(),'');
await mkdir(out,{recursive:true});
for(const name of ['lock-timing','queue-scan','storage','failed-insert','mid-descent']){
 const patch=resolve(`tools/cc2-transition-audit/${name}.patch`);
 execFileSync('git',['-C',root,'apply','--check',patch]);execFileSync('git',['-C',root,'apply',patch]);
}
for(const name of ['spawn','air-prefix'])execFileSync(process.execPath,[`scripts/kiwi-cc2-${name}-prepare.js`,root,`${out}/${name}`],{stdio:'inherit'});
const patch=execFileSync('git',['-C',root,'diff'],{encoding:'utf8'});
assert.ok(!patch.includes('transition_audit_observer'));assert.ok(!patch.includes('dag_replay_observer'));
await writeFile(`${out}/candidate.patch`,patch);
const lock=await readFile(`${root}/Cargo.lock`,'utf8');
const version=lock.match(/name = "wasm-bindgen"\s+version = "([^"]+)"/)?.[1];assert.ok(version);
await writeFile(`${out}/bindgen-version.txt`,version);
const hash=s=>createHash('sha256').update(s).digest('hex');
await writeFile(`${out}/build.json`,JSON.stringify({pin,wasmBindgen:version,patchSha256:hash(patch),
 baselineWasmSha256:hash(await readFile('vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm')),
 note:'Accepted correction transforms, no transaction/DAG instrumentation. Spawn tests compile only under cfg(test). Production vendor is unchanged.'},null,2));
