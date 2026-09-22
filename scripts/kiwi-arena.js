import {parseArgs} from 'node:util';
import {execFileSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {profile} from './kiwi-profiles.js';
import {pairedMatches} from './kiwi-arena-core.js';
const {values:v}=parseArgs({options:{a:{type:'string',default:'native'},b:{type:'string',default:'legacy'},
  pairs:{type:'string',default:'1'},seed:{type:'string',default:'1'},frames:{type:'string',default:'18000'},
  cadence:{type:'string',default:'24'},horizon:{type:'string'}}});
const integer=(s)=>{const n=Number(s);if(!Number.isSafeInteger(n)||n<1)throw new Error('Expected positive integer');return n;};
const options={framesPerPiece:integer(v.cadence),...(v.horizon?{horizon:integer(v.horizon)}:{})};
const a=await profile(v.a,options),b=await profile(v.b,options);
const describe=({decide,...p})=>p;
const files=['src/engine.js','src/attack.js','src/board.js','src/rotation.js','src/physics.js','src/rules.js','src/random.js',
  'src/analysis/visible-state.js','src/analysis/kiwi.js','src/analysis/placement-transport.js','src/analysis/placement-authority.js','scripts/kiwi-arena-core.js','scripts/kiwi-profiles.js',
  ...(await readdir('src/analysis/native')).map(f=>'src/analysis/native/'+f),
  ...(await readdir('src/data')).filter(f=>f.endsWith('.json')).map(f=>'src/data/'+f)];
const sourceHashes=Object.fromEntries(await Promise.all(files.sort().map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
const report=await pairedMatches([a.decide,b.decide],{pairs:integer(v.pairs),seed:integer(v.seed),maxFrames:integer(v.frames),framesPerPiece:integer(v.cadence)});
console.log(JSON.stringify({schema:'tetrp-native-arena/2',executionModel:'tl-placement-v1',git:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  dirty:Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),
  sourceHashes,profiles:[describe(a),describe(b)],budgetPolicy:'fixed per-profile work; identical simulated cadence; not equal wall-clock compute',
  promotionEligible:false,notice:'Smoke/ablation report; promotion requires held-out multi-opponent results and compute-matched browser measurements.',...report},null,2));
