import {mkdir,writeFile,appendFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {profile} from './kiwi-profiles.js';
import {firstTo} from './kiwi-arena-core.js';

const directory=process.argv[2]??'.cache/native-ft7-'+new Date().toISOString().replaceAll(':','-');
const seed=Number(process.argv[3]??20260923);
if(!Number.isSafeInteger(seed)||seed<1||seed>1e12)throw new Error('Invalid FT7 seed');
const geometryBudget=Number(process.argv[4]??100000);
if(!Number.isSafeInteger(geometryBudget)||geometryBudget<1||geometryBudget>10000000)throw new Error('Invalid geometry budget');
const frontierMode=process.argv[5]??'off';
if(!['off','on'].includes(frontierMode))throw new Error('Invalid frontier mode');
await mkdir(directory,{recursive:true});
const profiles=[await profile('native',{geometryBudget,frontierExtension:frontierMode==='on'}),await profile('legacy')];
const files=['scripts/kiwi-arena-core.js','scripts/kiwi-profiles.js','scripts/kiwi-ft7.js',
  'src/analysis/visible-state.js','src/analysis/kiwi.js','src/analysis/placement-transport.js','src/analysis/placement-authority.js',
  ...(await readdir('src')).filter(f=>f.endsWith('.js')).map(f=>'src/'+f),
  ...(await readdir('src/analysis/native')).map(f=>'src/analysis/native/'+f),
  ...(await readdir('src/data')).filter(f=>f.endsWith('.json')).map(f=>'src/data/'+f)];
const sourceHashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
const manifest={schema:'tetrp-ko-ft7/2',executionModel:'tl-placement-v1',started:new Date().toISOString(),git:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  profiles:profiles.map(({decide,...p})=>p),sourceHashes,seed,target:7,framesPerPiece:24,
  maxFrames:null,watchdogFrames:360000,scoring:'authority KO only; simultaneous KO and technical failures unscored',games:[],score:[0,0],complete:false};
await writeFile(directory+'/result.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({type:'started',directory,profiles:profiles.map(p=>p.name)}));
try{
const report=await firstTo(profiles.map(p=>p.decide),{seed,stopOnTechnical:true,onEvent:async event=>{
  await appendFile(directory+'/events.jsonl',JSON.stringify({...event,time:new Date().toISOString()})+'\n');
  if(event.type==='game-end'){
    manifest.games.push(event.game);manifest.score=event.score;
    await writeFile(directory+'/result.json',JSON.stringify(manifest,null,2));
    const {latencies,...game}=event.game;console.log(JSON.stringify({type:'game-end',game}));
  }else console.log(JSON.stringify(event));
}});
await writeFile(directory+'/result.json',JSON.stringify({...manifest,...report,finished:new Date().toISOString()},null,2));
console.log(JSON.stringify({type:'series-end',directory,complete:report.complete,score:report.score,reason:report.reason}));
if(!report.complete)process.exitCode=1;
}catch(error){
  await writeFile(directory+'/result.json',JSON.stringify({...manifest,complete:false,reason:'runner-exception',
    error:{message:error.message,stack:error.stack,details:error.details},finished:new Date().toISOString()},null,2));
  throw error;
}
