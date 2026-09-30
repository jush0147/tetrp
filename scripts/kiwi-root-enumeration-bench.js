import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';
import * as R from '../src/rotation.js';
import {snapshotAuthority,prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
import {captureSnapshotFromEngine,buildSnapshotRequest} from '../vendor/kiwi-v1/kiwi-snapshot-adapter.mjs';
import {createPlacementTools} from '../vendor/kiwi-v1/tetrp-placement-path.mjs';
import {createPlacementTools as originalTools} from '../test/fixtures/kiwi-placement-path-reference.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
import init,{analyze_snapshot_json} from '../.cache/tslot-wasm-run-36702845823/pkg/cold_clear_2.js';
const deps={Engine,boardModule:B,rotationModule:R},tools={original:originalTools(deps),optimized:createPlacementTools(deps)};
const samples=[];
for(let leg=0;leg<8;leg++){
 const rows=readFileSync(`.cache/visible-t-pilot-36707273929/legs/cc2-visible-t-integration-leg-${leg}/game-1.jsonl`,'utf8').trim().split('\n').map(JSON.parse).filter(r=>r.type==='decision');
 for(const fraction of [.15,.5,.85]){const index=Math.floor(rows.length*fraction);samples.push({id:`leg${leg}/${index}`,snapshot:rows[index].snapshot});}
}
// Warm both traversals, then alternate order to reduce order/JIT bias.
for(const tool of Object.values(tools))tool.enumerateRootPlacements(snapshotAuthority(samples[0].snapshot));
const measurements=[];
for(let pass=0;pass<2;pass++)for(const [i,s] of samples.entries()){
 const authority=snapshotAuthority(s.snapshot),result={},ms={};
 for(const name of (pass+i)%2?['optimized','original']:['original','optimized']){
  const t=performance.now();result[name]=tools[name].enumerateRootPlacements(authority);ms[name]=performance.now()-t;
 }
 assert.deepEqual(result.optimized,result.original,s.id);
 measurements.push({id:s.id,pass,states:result.original.states_explored,placements:result.original.placements.length,...ms});
}
await init({module_or_path:readFileSync('.cache/tslot-wasm-run-36702845823/pkg/cold_clear_2_bg.wasm')});
const decisions=[];
for(const s of samples.filter((_,i)=>i%4===0)){
 const prepared=prepareKiwi(s.snapshot),originalRequest=buildSnapshotRequest(captureSnapshotFromEngine(snapshotAuthority(s.snapshot),tools.original),{nodeBudget:200000,framesPerPiece:24});
 assert.deepEqual(prepared.request,originalRequest);
 const before=JSON.parse(analyze_snapshot_json(JSON.stringify(originalRequest))),after=JSON.parse(analyze_snapshot_json(JSON.stringify(prepared.request)));
 assert.deepEqual(after,before);
 const a=normalizeTopRecommendation(s.snapshot,prepared,after);
 if(a.action.kind==='place')validatePlacement(s.snapshot,a);
 decisions.push({id:s.id,kind:a.action.kind,nodes:after.nodes,fullReportParity:true});
}
const totals=measurements.reduce((a,r)=>({original:a.original+r.original,optimized:a.optimized+r.optimized}),{original:0,optimized:0});
const provenance={node:process.version,platform:process.platform,arch:process.arch,pilotRun:36707273929,candidateRun:36702845823,files:Object.fromEntries(['vendor/kiwi-v1/tetrp-placement-path.mjs','test/fixtures/kiwi-placement-path-reference.js','.cache/tslot-wasm-run-36702845823/pkg/cold_clear_2_bg.wasm'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))};
const out={provenance,schema:'kiwi-root-enumeration-efficiency/1',samples:samples.length,passes:2,geometryParityChecks:measurements.length,fullReportChecks:decisions.length,totals,speedup:totals.original/totals.optimized,measurements,decisions,scope:'Local paired root geometry benchmark; unchanged traversal/results. Not whole arena speedup or strength evidence.'};
writeFileSync('docs/audits/cc2-alignment/ROOT_ENUMERATION_PERFORMANCE.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({...out,measurements:undefined,decisions:undefined}));
