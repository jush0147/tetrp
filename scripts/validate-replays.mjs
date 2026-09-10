// Opt-in real-file audit. Private input and report paths must be supplied explicitly.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.js';
import { parseReplay, prepareReplay, Reconstruction } from '../src/replay/index.js';
const args=process.argv.slice(2), outputIndex=args.indexOf('--output');
const output=outputIndex<0?null:args.splice(outputIndex,2)[1];
if(!args.length)throw new Error('Usage: node scripts/validate-replays.mjs <private paths...> [--output private-report.json]');
const hash=s=>createHash('sha256').update(s).digest('hex');
const report=[];
for(const path of args){
  const bytes=readFileSync(path,'utf8'), doc=parseReplay(bytes);
  const sample={variant:doc.variant,sha256:hash(bytes),rounds:doc.rounds.length,streams:[]};report.push(sample);
  for(const round of doc.rounds)for(const player of round.players){
    const result={round:round.index,player:player.index};sample.streams.push(result);
    let timeline;
    try{timeline=prepareReplay(player);}catch(e){if(e.code!=='UNSUPPORTED_PROFILE')throw e;result.unsupported={code:e.code,path:e.path,message:e.message};console.log(JSON.stringify(result));continue;}
    const baseline=new Reconstruction(timeline), placements=new Map([[0,hash(baseline.engine.serialize())]]);
    while(baseline.advance()){
      const count=baseline.engine.state.stats.pieces;
      if(!placements.has(count))placements.set(count,hash(baseline.engine.serialize()));
    }
    const final=baseline.engine.serialize(), seek=new Reconstruction(timeline);
    let forks=0;
    for(const [index,digest] of placements){
      seek.seekPlacement(index);assert.equal(hash(seek.engine.serialize()),digest);
      seek.seekPlacement(index);assert.equal(hash(seek.engine.serialize()),digest);
      const fork=seek.fork(), second=Engine.restore(fork.serialize());
      if(fork.state.phase==='inputs'){fork.finishFrame();second.finishFrame();}
      const actions=[{frame:fork.state.frame,subframe:0,type:'keyup',key:'moveLeft'},
        {frame:fork.state.frame,subframe:0.5,type:'keydown',key:'moveLeft'}];
      fork.step(actions);second.step(actions);assert.equal(fork.serialize(),second.serialize());
      assert.equal(hash(seek.engine.serialize()),digest);forks++;
    }
    const continuationPositions=[...new Set([0,Math.floor((placements.size-1)/2),placements.size-1])];
    for(const index of continuationPositions){
      seek.seekPlacement(index);const restored=Reconstruction.restore(seek.checkpoint());restored.run();
      assert.equal(restored.engine.serialize(),final);assert.deepEqual(restored.diagnostics.first,baseline.diagnostics.first);
    }
    // Checkpoint while remote/local correlation exists and before its confirm.
    const between=new Reconstruction(timeline);
    let packetCheckpoint=false;
    while(between.advance())if(Object.keys(between.packetIds).length){
      const restored=Reconstruction.restore(between.checkpoint());restored.run();assert.equal(restored.engine.serialize(),final);packetCheckpoint=true;break;
    }
    for(const frame of [...new Set([0,Math.floor(timeline.frames/2),timeline.frames])]){
      const state=seek.seekFrame(frame);seek.run();assert.deepEqual(seek.seekFrame(frame),state);
      const restored=Reconstruction.restore(seek.checkpoint());restored.run();assert.equal(restored.engine.serialize(),final);
    }
    const observations=baseline.diagnostics.observations;
    Object.assign(result,{frames:timeline.frames,placements:baseline.state.stats.pieces,lines:baseline.state.stats.lines,
      placementSeeks:placements.size*2,forks,continuationPositions,packetCheckpoint,
      anchors:observations.map(o=>({frame:o.frame,sourceIndex:o.sourceIndex,boundary:o.boundary,differences:o.differences})),
      first:baseline.diagnostics.first});
    console.log(JSON.stringify({variant:sample.variant,round:result.round,player:result.player,placements:result.placements,
      verifiedSeeks:result.placementSeeks,forks,first:result.first&&{frame:result.first.firstObservedFrame,sourceIndex:result.first.sourceIndex,
        placementIndex:result.first.placementIndex,firstDivergentFrame:result.first.firstDivergentFrame,differences:result.first.differences}}));
  }
}
if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');
