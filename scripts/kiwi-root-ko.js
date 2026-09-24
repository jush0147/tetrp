import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {match} from './kiwi-arena-core.js';
import {profile} from './kiwi-profiles.js';
import {syntheticTail,actionKey} from './kiwi-resource-rollout.js';
import {createHoles} from '../src/random.js';
import {visibleState} from '../src/analysis/visible-state.js';
export const KO_PROTOCOL={scenarioSeeds:[51001,51002],cadence:24,watchdogFrames:360000,tail:'IID uniform robustness',continuation:'legacy-200k',maxFrames:null};
export function branchCheckpoint(input,seed,mirrored=false){
  const c=structuredClone(input.checkpoint);
  for(let seat=0;seat<2;seat++){
    const s=c.states[seat],before=visibleState(s);assert.deepEqual(before,input.public[seat]);
    assert.equal(s.bag.queue.length,5);
    s.bag={queue:[...before.next,...syntheticTail(seed+seat*100000,30032)],rng:{seed:1},bagId:0};
    s.holes=createHoles(seed+200000+seat*100000);
    assert.deepEqual(visibleState(s),before);
  }
  if(mirrored)c.states.reverse();return c;
}
export async function playRoot(input,{seed,mirrored=false,root,decide,record=null,maxFrames=null}){
  const focal=mirrored?1-input.focalSeat:input.focalSeat,c=branchCheckpoint(input,seed,mirrored);let first=true;
  const bots=[0,1].map(seat=>snapshot=>{
    if(seat===focal&&first){first=false;assert.deepEqual(snapshot,input.public[input.focalSeat]);return structuredClone(input.roots[root]);}
    return decide(snapshot);
  });
  const seeds=[seed,seed+100000],holeSeeds=[seed+200000,seed+300000];
  if(mirrored){seeds.reverse();holeSeeds.reverse();}
  const game=await match(bots,{startCheckpoint:c,seeds,holeSeeds,maxFrames,watchdogFrames:KO_PROTOCOL.watchdogFrames,record});
  for(let seat=0;seat<2;seat++){
    assert.equal(game.parity[seat].placements,game.pieces[seat]-game.initialPieces[seat]);
    assert.equal(game.parity[seat].holds,game.holds[seat]);
  }
  return {seed,mirrored,root,focal,game};
}
export function normalized(record){
  const g=record.game,order=[record.focal,1-record.focal];
  return {reason:g.reason,frames:g.frames,startFrame:g.startFrame,
    winner:g.winner===null?null:g.winner===record.focal?'focal':'opponent',
    ko:order.map(i=>g.ko[i]),deathReasons:order.map(i=>g.deathReasons[i]),
    pieces:order.map(i=>g.pieces[i]),totals:order.map(i=>g.totals[i]),parity:order.map(i=>g.parity[i])};
}
export function summarizeCase(input,records){
  assert.equal(records.length,8);const pairs=[];let placements=0,holds=0;
  for(const r of records){
    assert.equal(r.game.reason,'topout');assert.ok(r.game.failures.every(f=>!f));
    for(let i=0;i<2;i++){
      assert.equal(r.game.parity[i].mismatches,0);assert.deepEqual(r.game.transportStats[i],{fallbackRequests:0,rejectedCandidates:0,maxSelectedRank:0});
      placements+=r.game.parity[i].placements;holds+=r.game.parity[i].holds;
    }
  }
  for(const seed of KO_PROTOCOL.scenarioSeeds){
    const roots={};for(const root of ['A','B']){
      const normal=records.filter(r=>r.seed===seed&&r.root===root&&!r.mirrored),mirror=records.filter(r=>r.seed===seed&&r.root===root&&r.mirrored);
      assert.equal(normal.length,1);assert.equal(mirror.length,1);
      assert.deepEqual(normalized(normal[0]),normalized(mirror[0]),'Seat mirror gameplay mismatch');
      roots[root]=normalized(normal[0]);
    }
    const scored=roots.A.winner!==null&&roots.B.winner!==null;
    pairs.push({seed,scored,A:roots.A,B:roots.B,comparison:!scored?'unscored-simultaneous-KO':
      roots.A.winner===roots.B.winner?'concordant':roots.A.winner==='focal'?'A-only-win':'B-only-win'});
  }
  return {complete:true,id:input.id,sameRoot:actionKey(input.roots.A)===actionKey(input.roots.B),
    seatParity:true,technicalFailures:0,silentFallback:0,parity:{placements,holds,mismatches:0},
    independentScenarios:2,mirroredMatches:4,pairs,
    AOnlyWins:pairs.filter(p=>p.comparison==='A-only-win').length,BOnlyWins:pairs.filter(p=>p.comparison==='B-only-win').length,
    note:'Conditional on Legacy continuation and synthetic scenarios; not an FT7 or strength promotion.'};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const id=process.argv[2],directory=process.argv[3]??`.cache/root-ko-${id}`;
  const inputs=JSON.parse(await readFile('docs/audits/kiwi-root-ko/inputs.json','utf8')),input=inputs.find(x=>x.id===id);assert.ok(input,'Unknown frozen case');
  await mkdir(directory,{recursive:true});const legacy=await profile('legacy'),records=[];
  const sourceFiles=['scripts/kiwi-root-ko.js','scripts/kiwi-arena-core.js','scripts/kiwi-resource-rollout.js','scripts/kiwi-profiles.js',
    'src/engine.js','src/attack.js','src/random.js','src/analysis/placement-authority.js','src/analysis/visible-state.js','docs/audits/kiwi-root-ko/inputs.json'];
  const hashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
  await writeFile(`${directory}/manifest.json`,JSON.stringify({id,git:process.env.GITHUB_SHA??null,protocol:KO_PROTOCOL,hashes,legacy:{version:legacy.version,config:legacy.config},started:new Date().toISOString()},null,2));
  try{
    for(const seed of KO_PROTOCOL.scenarioSeeds)for(const mirrored of [false,true])for(const root of ['A','B']){
      const name=`${seed}-${mirrored?'mirror':'normal'}-${root}`;
      console.log(JSON.stringify({type:'match-start',id,seed,mirrored,root}));
      const result=await playRoot(input,{seed,mirrored,root,decide:legacy.decide,record:event=>{
        if(event.type==='parity')appendFileSync(`${directory}/${name}-parity.jsonl`,JSON.stringify({kind:event.kind,seat:event.seat,frame:event.frame,intent:event.intent,actual:event.actual})+'\n');
        if(event.type==='technical-failure')appendFileSync(`${directory}/${name}-failure.jsonl`,JSON.stringify(event)+'\n');
      }});
      records.push(result);await writeFile(`${directory}/${name}.json`,JSON.stringify(result));
      assert.equal(result.game.reason,'topout','Technical stop, no score');assert.ok(result.game.failures.every(f=>!f));
      console.log(JSON.stringify({type:'match-end',id,seed,mirrored,root,outcome:normalized(result)}));
    }
    const summary=summarizeCase(input,records);await writeFile(`${directory}/result.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
  }catch(error){await writeFile(`${directory}/result.json`,JSON.stringify({complete:false,id,error:error.stack,completedMatches:records.length},null,2));throw error;}
}
