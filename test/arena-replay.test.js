import test from 'node:test';
import assert from 'node:assert/strict';
import {match} from '../scripts/kiwi-arena-core.js';
import {replayRecorder} from '../scripts/kiwi-replay.js';
import {analyze,recommendation} from '../src/analysis/native/search.js';

const bot=s=>{const r=analyze(s,{horizon:1});return {candidates:r.candidates.map((_,i)=>recommendation(r,i))};};
test('arena export reconstructs both streams through the unchanged ttrm pipeline',async()=>{
  const recorder=replayRecorder();
  const result=await match([bot,bot],{seeds:[1,42],holeSeeds:[1,42],maxFrames:960,record:recorder.record,executionModel:'physical-input-v1'});
  assert.ok(result.holds.some(n=>n>0));assert.ok(result.sent.some(n=>n>0),'fixture must exercise garbage transactions');
  const {document,verification}=recorder.finish();
  assert.equal(document.replay.rounds[0].length,2);
  assert.ok(verification.every(v=>v.divergences===0&&v.anchors>2));
});
test('export refuses independent hidden-hole seeds instead of silently changing the replay',async()=>{
  await assert.rejects(match([bot,bot],{record:replayRecorder().record,maxFrames:24,executionModel:'physical-input-v1'}),/matching piece\/hole seeds/);
});
test('placement model cannot masquerade as a physical-input TTRM',async()=>{
  await assert.rejects(match([bot,bot],{record:replayRecorder().record,maxFrames:24}),/separate action replay/);
});
