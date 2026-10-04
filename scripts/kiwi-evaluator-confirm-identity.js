import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {VARIANT,candidateConfig} from './kiwi-surge-variant.js';
import {PLAN} from './kiwi-evaluator-confirm-plan.js';
export const BUILD='.cache/surge-residual-build';
export const read=async p=>JSON.parse(await readFile(p,'utf8'));
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const planHash=hash(JSON.stringify(PLAN));

export function verifyMetadata({manifest,gate,accepted,candidate,originalConfig},original=false){
 assert.equal(gate.complete,true);assert.deepEqual(gate.manifest,manifest);
 assert.equal(manifest.candidate,'surge-residual');assert.deepEqual(manifest.variant,VARIANT);
 assert.equal(manifest.baselineNative,PLAN.acceptedNative);assert.equal(manifest.candidateNative,PLAN.source.native);
 assert.equal(manifest.nativeRun,original?PLAN.source.run:Number(process.env.GITHUB_RUN_ID));
 assert.equal(gate.sampleCount,20);assert.equal(gate.placements,20);assert.equal(gate.baselineReports,20);
 assert.ok(gate.changedTop1>0);assert.deepEqual(gate.explicitHoldModes,['empty','occupied']);
 assert.deepEqual(accepted,originalConfig);
 assert.deepEqual(candidate,candidateConfig(accepted));
}
export async function verifyBundle(original=false){
 const manifest=await read(`${BUILD}/${original?'source-':''}manifest.json`);
 const gate=await read(`${BUILD}/${original?'source-':''}gate.json`);
 verifyMetadata({manifest,gate,accepted:await read(`${BUILD}/accepted-config.json`),candidate:await read(`${BUILD}/surge-residual-config.json`),
  originalConfig:(await read('docs/audits/cc2-alignment/ACTIVE_PARAMETERS_2026-09-28.json')).config},original);
 for(const [name,sha] of [['accepted',PLAN.acceptedNative],['surge-residual',PLAN.source.native]])
  assert.equal(hash(await readFile(`${BUILD}/snapshot-${name}`)),sha);
 // Refuse to reuse a binary in a changed rules/adapter/execution environment.
 const paths=['src','vendor','scripts/kiwi-arena-core.js','scripts/kiwi-native-client.js','scripts/kiwi-match-pool.js','scripts/kiwi-cc2-series-score.js',
  'scripts/kiwi-h1-short-metrics.js','docs/audits/cc2-alignment/ACTIVE_PARAMETERS_2026-09-28.json',
  'docs/audits/cc2-alignment/SURGE_PUBLIC_INPUTS.json','docs/audits/cc2-alignment/perf-snapshots.json'];
 assert.equal(execFileSync('git',['diff',PLAN.source.commit,'HEAD','--name-only','--',...paths],{encoding:'utf8',windowsHide:true}).trim(),'','Frozen environment drift');
 return {manifest,source:PLAN.source,planHash};
}
export async function identities(){await verifyBundle(true);return verifyBundle(false);}

if(process.argv[2]==='prepare'&&process.argv[1]?.replaceAll('\\','/').endsWith('/kiwi-evaluator-confirm-identity.js')){
 await copyFile(`${BUILD}/manifest.json`,`${BUILD}/source-manifest.json`);
 await copyFile(`${BUILD}/gate.json`,`${BUILD}/source-gate.json`);
 await verifyBundle(true);
 await mkdir('.cache/native-artifact',{recursive:true});
 await copyFile(`${BUILD}/snapshot-accepted`,'.cache/native-artifact/snapshot-accepted');
 await writeFile(`${BUILD}/confirmation-plan.json`,JSON.stringify({plan:PLAN,planHash},null,2)+'\n');
}
