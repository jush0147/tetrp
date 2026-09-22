import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {analyze,recommendation,VERSION,DEFAULTS} from '../src/analysis/native/search.js';
import {prepareKiwi,normalizeTopRecommendation,NODE_BUDGET} from '../src/analysis/kiwi.js';
import init,{analyze_snapshot_json} from '../vendor/kiwi-v1/pkg/cold_clear_2.js';
let ready;
export async function profile(name,options={}){
  if(name==='native'||name.startsWith('native-no-')){
    const omitted=name.slice('native-no-'.length),weights={...options.weights};
    if(name!=='native'){
      if(!Object.hasOwn(DEFAULTS.weights,omitted))throw new Error('Unknown ablation '+name);
      weights[omitted]=0;
    }
    const config={...options,weights};
    return {name,version:VERSION,config:{...DEFAULTS,...config,weights:{...DEFAULTS.weights,...weights}},
      decide:s=>{const r=analyze(s,config);return {candidates:r.candidates.map((_,i)=>recommendation(r,i))};}};
  }
  if(name==='legacy'||name==='champion'){
    ready??=init({module_or_path:await readFile(new URL('../vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm',import.meta.url))});await ready;
    const lock=JSON.parse(await readFile(new URL('../vendor/kiwi-v1/artifact-lock.json',import.meta.url),'utf8'));
    return {name,version:lock,config:{nodeBudget:NODE_BUDGET},decide:s=>{
      const p=prepareKiwi(s),r=JSON.parse(analyze_snapshot_json(JSON.stringify(p.request)));
      return normalizeTopRecommendation(s,p,r);
    }};
  }
  // Historical / original CC2 artifacts must implement the same snapshot-only
  // normalized-action contract. Missing baselines fail closed, never relabel Kiwi.
  if(name.startsWith('module:')){
    const m=await import(pathToFileURL(resolve(name.slice(7))).href);
    if(typeof m.decide!=='function'||!m.manifest?.version)throw new Error('External profile needs decide(snapshot) and manifest.version');
    return {name,...m.manifest,decide:m.decide};
  }
  throw new Error('Unavailable baseline: '+name);
}
