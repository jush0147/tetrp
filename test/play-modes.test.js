import test from 'node:test';
import assert from 'node:assert/strict';
import {nextRound} from '../viewer/play-modes.js';
test('round playback modes have distinct terminal and wrap behavior',()=>{
  assert.equal(nextRound(0,0,3),null);assert.equal(nextRound(1,0,3),1);assert.equal(nextRound(1,2,3),null);
  assert.equal(nextRound(2,0,3),1);assert.equal(nextRound(2,2,3),0);assert.equal(nextRound(3,1,3),1);
  assert.equal(nextRound(1,0,1),null);assert.equal(nextRound(2,0,1),0);assert.equal(nextRound(3,0,1),0);
});
