import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';
import * as R from '../src/rotation.js';
import {createPlacementTools} from '../vendor/kiwi-v1/tetrp-placement-path.mjs';
import {createPlacementTools as referenceTools} from './fixtures/kiwi-placement-path-reference.js';
const deps={Engine,boardModule:B,rotationModule:R},fast=createPlacementTools(deps),reference=referenceTools(deps);
const fixture=JSON.parse(readFileSync(new URL('./fixtures/transport/legacy-t-spin.json',import.meta.url)));
function parity(state){
 const before=structuredClone(state);
 assert.deepEqual(fast.enumerateRootPlacements({state}),reference.enumerateRootPlacements({state}));
 assert.deepEqual(state,before,'enumeration must not mutate its input');
}
test('cached edge key preserves all root placements and exploration counts for seven pieces',()=>{
 for(const type of ['i','o','t','s','z','j','l']){
  const e=new Engine();e.state.piece.type=type;
  for(const allow180 of [true,false]){e.state.rules.allow180=allow180;parity(e.state);}
 }
});
test('cached key preserves spin fixture, fractional poses and SRS+ rotation threshold states',()=>{
 for(const totalRotations of [0,29,30,31,32]){
  const state={board:structuredClone(fixture.snapshot.board),rules:structuredClone(fixture.snapshot.rules),
   piece:{...fixture.snapshot.current,totalRotations},playing:true};
  parity(state);
 }
 const e=new Engine({rules:{lockresets:0}});parity(e.state);
});
