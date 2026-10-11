// Standalone ROOK JSONL protocol. Each input line is a Tetrp player-visible
// snapshot (visibleState(state)), never a hidden generator/checkpoint.
// Each output line is an action and diagnostics or a structured error.
import {createInterface} from 'node:readline';
import {chooseMove} from '../src/analysis/rook.js';

const opts={
  depth:Number(process.env.ROOK_DEPTH??3),
  beamWidth:Number(process.env.ROOK_BEAM??12),
  maxNodes:Number(process.env.ROOK_NODES??8000),
};
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  if(!line.trim())continue;
  try {
    const request=JSON.parse(line);
    const snapshot=request.visible??request;
    const result=chooseMove(snapshot,{...opts,...(request.options??{})});
    process.stdout.write(JSON.stringify({ok:true,action:result})+'\n');
  } catch(error) {
    process.stdout.write(JSON.stringify({ok:false,error:error instanceof Error?error.message:String(error)})+'\n');
  }
}
