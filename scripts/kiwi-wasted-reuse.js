import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {summarize} from './kiwi-h1-common-plan.js';
export const CONTROL={run:37026070707,commit:'8ddce9287e61d5126e076f40346e6887dfb02c08',sha256:'9048e891641b0eac202d8a242d1efca25f795a15cff79d9c275ed76133aba992'};
export async function verifyReuse(){
 const raw=await readFile('.cache/wasted-control/result.json');
 assert.equal(createHash('sha256').update(raw).digest('hex'),CONTROL.sha256);
 const r=JSON.parse(raw);assert.equal(r.complete,true);assert.deepEqual(summarize(r.blocks),r.statistics);
 assert.equal(r.statistics.retriedBlocks,0,'This fixed reuse protocol requires original seeds');
 const paths=['src','vendor','scripts/kiwi-arena-core.js','scripts/kiwi-native-client.js','scripts/kiwi-match-pool.js','scripts/kiwi-h1-common.js','scripts/kiwi-h1-common-plan.js','scripts/kiwi-cc2-series-score.js'];
 assert.equal(execFileSync('git',['diff',CONTROL.commit,'HEAD','--name-only','--',...paths],{encoding:'utf8',windowsHide:true}).trim(),'','Control environment drift');
 for(const b of r.blocks){assert.equal(b.commit,CONTROL.commit);assert.equal(b.attempt,0);}
 return r;
}
