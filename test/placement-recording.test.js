import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleState} from '../src/analysis/visible-state.js';
import {PlacementArenaEngine,validatePlacement,commitPlacement} from '../src/analysis/placement-authority.js';
import {createHoles} from '../src/random.js';
import {PlacementRecordingSession,RECORDING_FORMAT,stateDigest} from '../viewer/placement-recording.js';

async function sample(){
 const engine=new PlacementArenaEngine({seed:42});engine.state.holes=createHoles(43);
 const s=engine.state;
 const probe=new PlacementArenaEngine({seed:42});probe.slam(true);
 const {cells}=await import('../src/board.js');
 const action={candidateIndex:0,action:{kind:'place'},move:{piece:s.piece.type,x:probe.state.piece.x,y:Math.ceil(probe.state.piece.y),rotation:0,cells:cells(probe.state.piece).map(([x,y])=>[x,Math.ceil(y)]),useHold:false},execution:{moves:['hardDrop'],spin:'none'}};
 const ops=[{type:'check',frame:0,hash:await stateDigest(s)},{type:'plan',frame:0,action}];
 const proof=validatePlacement(visibleState(s),action);
 for(let f=0;f<23;f++)engine.step([]);
 engine.beginFrame([]);engine.advanceSegment(.5);const expected=commitPlacement(engine,proof,23);engine.finishFrame();s.attack.outbox=[];
 ops.push({type:'lock',frame:23,expected},{type:'check',frame:24,hash:await stateDigest(s)},{type:'end',frame:24,hash:await stateDigest(s),reason:'winner'});
 return {gamemode:'league',stream:{frames:24,options:{seed:42,handling:s.handling},results:{gameoverreason:'winner'},tetrp:{format:RECORDING_FORMAT,cadence:24,holeSeed:43,rules:s.rules,ops}}};
}
test('authority recording reconstructs and navigates landing, clear, terminal',async()=>{
 const session=new PlacementRecordingSession(await sample());await session.initialize();
 assert.equal(session.total,1);assert.equal(session.conformance.placements,1);
 session.step(1);assert.equal(session.result().recordingPhase,'landing');assert.equal(session.state.stats.pieces,0);
 session.step(1);assert.equal(session.result().recordingPhase,'result');assert.equal(session.state.stats.pieces,1);
 session.seek('frame',24);assert.equal(session.state.reason,'winner');
 session.seek('placement',0);assert.equal(session.state.stats.pieces,0);
 await assert.rejects(session.analysisState(),/Bot Mode/);
});
test('wrong RNG, placement, hash and removed action fail closed',async()=>{
 for(const mutate of [
  p=>p.stream.tetrp.holeSeed++,
  p=>p.stream.tetrp.ops[1].action.move.x++,
  p=>p.stream.tetrp.ops[3].hash='0'.repeat(64),
  p=>p.stream.tetrp.ops.splice(1,1),
 ]){
  const p=await sample();mutate(p);await assert.rejects(new PlacementRecordingSession(p).initialize());
 }
});
test('legacy broken snapshot recording is explicitly rejected',()=>{
 assert.throws(()=>new PlacementRecordingSession({stream:{tetrp:{format:'placement-recording/1'}}}),/舊版落點檔/);
});
