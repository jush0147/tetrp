import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {transform} from '../scripts/kiwi-h1-off-prepare.js';
test('H1 experiment cannot transform unexpected or already changed source',()=>{
 const assignment='        config.freestyle_weights.pending_safety = 1.0;';
 const original='        config.freestyle_weights.h9_cavity_excavation = -0.5;\n'+assignment+'\nafter',changed=transform(original);
 assert.equal(changed.replace('if cfg!(h1_off) { 0.0 } else { 1.0 }','1.0'),original);
 assert.throws(()=>transform(changed));assert.throws(()=>transform(assignment+assignment));assert.throws(()=>transform(''));
});
test('H1 uses independent fixed seeds and shared runner with the right policy identity',()=>{
 const h1=JSON.parse(readFileSync('docs/audits/cc2-alignment/H1_OFF_200.json'));
 const prior=JSON.parse(readFileSync('docs/audits/cc2-alignment/VISIBLE_T_200.json'));
 assert.equal(h1.candidate,'h1-off');assert.equal(h1.legs,200);assert.equal(h1.baselineNative,prior.baselineNative);
 for(const k of ['nodeBudget','framesPerPiece','watchdogFrames','shards','maxParallel','workersPerRunner'])assert.equal(h1[k],prior[k]);
 for(const x of h1.seeds)for(const y of prior.seeds)assert.ok(Math.abs(x-y)>98);
 const h9=JSON.parse(readFileSync('docs/audits/cc2-alignment/H9_OFF_200.json'));
 for(const x of h1.seeds)for(const y of h9.seeds)assert.ok(Math.abs(x-y)>98);
 const dir=mkdtempSync(join(tmpdir(),'kiwi-h1-test-'));
 try{
  const manifest=join(dir,'manifest.json');h1.candidateNative='test-hash';writeFileSync(manifest,JSON.stringify(h1));
  const script=`import assert from 'node:assert/strict';import {config,batchName,legSettings,auditAttempt} from './scripts/kiwi-visible-t-200-config.js';
   assert.equal(config.candidate,'h1-off');assert.equal(batchName,'kiwi-h1-off-200');assert.equal(legSettings(1).seed,legSettings(0).seed);
   const s=legSettings(0),r={complete:true,batchValidated:true,leg:0,seed:s.seed,nodeBudget:200000,hashes:{accepted:{native:config.baselineNative},'h1-off':{native:'test-hash'}},runs:{parallel:{counts:{placements:[1,1],holds:[0,0],requests:[1,1]},result:{executionModel:'tl-placement-v1',framesPerPiece:24,maxFrames:null,watchdogFrames:360000,seeds:[s.seed,s.seed],holeSeeds:[s.seed+1,s.seed+2],transportStats:[0,1].map(()=>({fallbackRequests:0,rejectedCandidates:0,maxSelectedRank:0})),parity:[0,1].map(()=>({placements:1,holds:0,mismatches:0})),decisions:[1,1],reason:'topout',failures:[null,null],ko:[false,true],winner:0}}}};
   assert.equal(auditAttempt(r,0,0).seriesWinner,0);r.hashes['h1-off'].native='wrong';assert.throws(()=>auditAttempt(r,0,0));`;
  execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:resolve('.'),env:{...process.env,KIWI_BATCH_MANIFEST:manifest}});
 }finally{rmSync(join(dir,'manifest.json'),{force:true});rmdirSync(dir);}
});
