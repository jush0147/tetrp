import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PLAN} from './kiwi-residual-arena-plan.js';
export const BUILD='.cache/residual-arena-build';
const hash=b=>createHash('sha256').update(b).digest('hex');
export const planHash=hash(JSON.stringify(PLAN));
export function verifyPreflight(s){
 assert.equal(s.sourceSha,PLAN.source.commit);assert.equal(s.complete,true);
 assert.equal(s.costGate,'not met');assert.equal(s.activationGate,'passed');
 assert.equal(s.rows.length,20);assert.equal(s.measurements.length,60);
 assert.equal(s.placements,20);assert.equal(s.holds,8);assert.equal(s.changedTop1,2);assert.equal(s.witnesses,480);
 for(const r of s.rows){assert.deepEqual(r.off.report,r.accepted.report);assert.deepEqual(r.trace.report,r.on.report);assert.ok(r.parity.actual);}
}
export async function identities(){
 const raw=await readFile(`${BUILD}/summary.json`);
 assert.equal(hash(raw),'8852250975b6b6debfec8c24e9a7495e33a224a21a2ddac95d75d9e1a91ff63a');
 verifyPreflight(JSON.parse(raw));
 for(const [file,expected] of [['snapshot-on',PLAN.source.native],['snapshot-accepted',PLAN.acceptedNative]])assert.equal(hash(await readFile(`${BUILD}/${file}`)),expected);
 const paths=['src','vendor','scripts/kiwi-arena-core.js','scripts/kiwi-native-client.js','scripts/kiwi-match-pool.js','scripts/kiwi-cc2-series-score.js','scripts/kiwi-h1-short-metrics.js'];
 assert.equal(execFileSync('git',['diff',PLAN.source.commit,'HEAD','--name-only','--',...paths],{encoding:'utf8',windowsHide:true}).trim(),'','Frozen arena environment drift');
 return {source:PLAN.source,accepted:PLAN.acceptedNative,planHash};
}
if(process.argv[2]==='prepare'&&process.argv[1]?.replaceAll('\\','/').endsWith('/kiwi-residual-arena-identity.js')){
 await copyFile('.cache/native-artifact/snapshot-accepted',`${BUILD}/snapshot-accepted`);
 await identities();await writeFile(`${BUILD}/arena-plan.json`,JSON.stringify({plan:PLAN,planHash},null,2));
}
