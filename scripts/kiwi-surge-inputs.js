// Fixed first block; select by public charge + chronological position only.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const samples=[],sources=[];
for(const leg of [2,3]){
 const path=`.cache/b2b-surge-traces/block0/block-0/attempt-0/leg-${leg}/reports.jsonl.gz`,raw=readFileSync(path);
 const rows=gunzipSync(raw).toString().trim().split('\n').map(JSON.parse);
 const own=rows.filter(r=>r.seat===leg%2),eligible=own.filter(r=>r.snapshot.rules.b2bcharging&&r.snapshot.attack.btb>r.snapshot.rules.b2bcharge_at);
 assert.ok(eligible.length>=4);sources.push({leg,sha256:sha(raw),requests:own.length,charged:eligible.length});
 for(let i=0;i<4;i++){
  const index=Math.floor(i*(eligible.length-1)/3),r=eligible[index];
  samples.push({id:`b0-l${leg}-charged${index}`,snapshot:r.snapshot,snapshotHash:sha(JSON.stringify(r.snapshot))});
 }
}
writeFileSync('docs/audits/cc2-alignment/SURGE_PUBLIC_INPUTS.json',JSON.stringify({run:37114400655,selection:'block0 candidate seats; 4 evenly spaced charged requests per leg; no action/score/outcome filter',sources,samples})+'\n');
console.log(JSON.stringify({sources,samples:samples.map(s=>({id:s.id,frame:s.snapshot.frame,btb:s.snapshot.attack.btb}))}));
