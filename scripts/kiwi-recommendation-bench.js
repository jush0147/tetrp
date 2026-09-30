import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as optimized from '../src/analysis/kiwi.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
import pilot from '../docs/audits/cc2-alignment/VISIBLE_T_PILOT.json' with {type:'json'};
const sha=b=>createHash('sha256').update(b).digest('hex');
// Execute the same production facade twice. Only replace the placement-tools
// import with the frozen original; make other relative imports absolute.
const facadeURL=new URL('../src/analysis/kiwi.js',import.meta.url);
const source=readFileSync(facadeURL,'utf8');let replacements=0;
const originalSource=source.replace(/from (['"])(\.[^'"]+)\1/g,(match,quote,spec)=>{
 let url=new URL(spec,facadeURL);
 if(spec.endsWith('/tetrp-placement-path.mjs')){url=new URL('../test/fixtures/kiwi-placement-path-reference.js',import.meta.url);replacements++;}
 return `from ${quote}${url.href}${quote}`;
});assert.equal(replacements,1);
const original=await import('data:text/javascript;base64,'+Buffer.from(originalSource).toString('base64'));
const facades={original,optimized},kernels={},hashes={};
const paths={candidate:'.cache/tslot-wasm-run-36702845823/pkg',baseline:'.cache/cc2-landing-run-36387270053/cc2-wasm-results/pkg'};
for(const [name,path] of Object.entries(paths)){
 const wasm=readFileSync(`${path}/cold_clear_2_bg.wasm`);
 assert.equal(sha(wasm),pilot[name==='candidate'?'candidateWasm':'baselineWasm']);
 assert.equal(sha(readFileSync(`${path}/cold_clear_2.js`)),pilot.js);
 const m=await import(pathToFileURL(resolve(path,'cold_clear_2.js')).href);await m.default({module_or_path:wasm});kernels[name]=m.analyze_snapshot_json;hashes[name]=sha(wasm);
}
const samples=[];
for(let leg=0;leg<8;leg++){
 const rows=readFileSync(`.cache/visible-t-pilot-36707273929/legs/cc2-visible-t-integration-leg-${leg}/game-1.jsonl`,'utf8').trim().split('\n').map(JSON.parse).filter(r=>r.type==='decision');
 for(const fraction of [.15,.5,.85]){const index=Math.floor(rows.length*fraction);samples.push({id:`leg${leg}/${index}`,snapshot:rows[index].snapshot});}
}
function run(facade,kernel,snapshot){
 const t=performance.now(),prepared=facade.prepareKiwi(snapshot),t1=performance.now();
 const report=JSON.parse(kernel(JSON.stringify(prepared.request))),t2=performance.now();
 const action=facade.normalizeTopRecommendation(snapshot,prepared,report),t3=performance.now();
 const proof=action.action.kind==='place'?validatePlacement(snapshot,action):null,t4=performance.now();
 return {request:prepared.request,warnings:prepared.warnings,report,action,proof,ms:{prepare:t1-t,search:t2-t1,normalize:t3-t2,certificate:t4-t3,total:t4-t}};
}
for(const facade of Object.values(facades))for(const kernel of Object.values(kernels))run(facade,kernel,samples[0].snapshot);
const measurements=[],coverage={place:0,hold:0};
for(let pass=0;pass<2;pass++){
 for(const [i,s] of samples.entries())for(const name of (pass+i)%2?['baseline','candidate']:['candidate','baseline']){
  const before=JSON.stringify(s.snapshot),r={};
  for(const version of (pass+i)%2?['optimized','original']:['original','optimized'])r[version]=run(facades[version],kernels[name],s.snapshot);
  for(const key of ['request','warnings','report','action','proof'])assert.deepEqual(r.original[key],r.optimized[key],`${s.id}/${name}/${key}`);
  assert.equal(JSON.stringify(s.snapshot),before);coverage[r.optimized.action.action.kind]++;
  measurements.push({id:s.id,pass,kernel:name,kind:r.optimized.action.action.kind,nodes:r.optimized.report.nodes,original:r.original.ms,optimized:r.optimized.ms});
 }
 console.log(JSON.stringify({pass:pass+1,pairs:measurements.length,parity:'passed'}));
}
const totals={};for(const name of Object.keys(kernels)){
 const rows=measurements.filter(r=>r.kernel===name),t={};
 for(const version of Object.keys(facades))t[version]=Object.fromEntries(['prepare','search','normalize','certificate','total'].map(k=>[k,rows.reduce((n,r)=>n+r[version][k],0)]));
 totals[name]={...t,speedup:t.original.total/t.optimized.total,reduction:1-t.optimized.total/t.original.total};
}
const out={schema:'kiwi-recommendation-efficiency/1',node:process.version,platform:process.platform,hashes,facadeSha256:sha(source),originalToolsSha256:sha(readFileSync(new URL('../test/fixtures/kiwi-placement-path-reference.js',import.meta.url))),optimizedToolsSha256:sha(readFileSync(new URL('../vendor/kiwi-v1/tetrp-placement-path.mjs',import.meta.url))),samples:24,passes:2,parityPairs:measurements.length,coverage,totals,measurements,scope:'Fixed recorded PublicSnapshots, complete prepare/search/normalize/certificate pipeline. Excludes match engine advancement, I/O and post-Hold continuation. Local timing, not Actions SLA or strength evidence.'};
writeFileSync('docs/audits/cc2-alignment/RECOMMENDATION_PERFORMANCE.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({...out,measurements:undefined}));
