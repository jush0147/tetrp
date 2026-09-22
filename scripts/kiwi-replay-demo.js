import {mkdir,writeFile} from 'node:fs/promises';
import {profile} from './kiwi-profiles.js';
import {match} from './kiwi-arena-core.js';
import {replayRecorder} from './kiwi-replay.js';

const directory=process.argv[2]??'.cache/native-replay-demo';await mkdir(directory,{recursive:true});
const profiles=[await profile('native'),await profile('legacy')],recorder=replayRecorder();
const result=await match(profiles.map(p=>p.decide),{seeds:[20260922,20260923],holeSeeds:[20260922,20260923],maxFrames:null,
  executionModel:'physical-input-v1',
  record:recorder.record,onProgress:p=>console.log(JSON.stringify(p))});
if(result.reason!=='topout'||result.failures.some(Boolean))throw new Error('Demonstration did not finish with a valid KO');
const {document,verification}=recorder.finish();
await writeFile(directory+'/native-vs-legacy.ttrm',JSON.stringify(document));
await writeFile(directory+'/result.json',JSON.stringify({result,verification,note:'New demonstration match with replay-compatible seeds, not the earlier FT7 recording.'},null,2));
console.log(JSON.stringify({directory,winner:profiles[result.winner]?.name,frames:result.frames,transportStats:result.transportStats,verification}));
