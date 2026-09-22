import {Engine} from '../engine.js';
import * as B from '../board.js';

const key=cells=>cells.map(([x,y])=>`${x},${Math.ceil(y)}`).sort().join(';');
const dirs={rotateCW:1,rotateCCW:3,rotate180:2};

/** Compile geometry into real Engine input events. Never interpret a soft-drop
 * tap as a cell: use authority feedback to reach each geometric row waypoint.
 * Callers supply a public probe in arena; this module never returns state.
 */
export function schedulePlacement(engine,action,endFrame){
  const path=action.execution.moves,start=engine.state.frame,lockTick=endFrame*10+5;
  const bytes=engine.serialize();
  const geometry=Engine.restore(bytes),waypoints=[];
  for(const move of path){
    if(move==='hardDrop')break;
    if(move==='down')geometry.descend(1);
    else if(move in dirs)geometry.rotate(dirs[move]);
    else geometry.move(move==='moveLeft'?-1:1);
    waypoints.push({move,row:Math.ceil(geometry.state.piece.y)});
  }
  const firstTick=start*10+Math.ceil(engine.state.subframe*10);
  // Try early first; later starts preserve rotation state/reset budget where
  // waiting on the ground would cause an early auto-lock.
  const starts=[firstTick];
  const down=path.filter(m=>m==='down').length;
  for(const padding of [down*4+10,down*2+10,down+10,10])
    starts.push(Math.max(firstTick,lockTick-padding));
  if(down===0)starts.push(lockTick);
  for(const initial of new Set(starts)){
    try{
      const probe=Engine.restore(bytes),s=probe.state,inputs=[],locks=[];
      probe.emit=function(type){if(type==='lock')locks.push({frame:s.frame,subframe:s.subframe,cells:B.cells(s.piece),spin:s.piece.spin});};
      let tick=initial;
      function emit(type,k,at=tick){
        if(at>lockTick)throw new Error('Placement exceeds cadence');
        const frame=Math.floor(at/10),subframe=(at%10)/10;
        while(s.frame<frame){if(s.phase==='ready')probe.beginFrame([]);probe.finishFrame();}
        if(s.phase==='ready')probe.beginFrame([]);
        const event={frame,type,key:k,subframe};inputs.push(event);probe.input(event);
      }
      for(const {move,row} of waypoints){
        if(move==='down'){
          // Pulses end with actual key-up events: the same segment boundaries
          // are replayed later, including Engine's minimum soft-drop budget.
          while(Math.ceil(s.piece.y)<row){
            const before=s.piece.y;
            emit('keydown','softDrop');emit('keyup','softDrop',++tick);
            if(s.piece.y<=before||locks.length||!s.playing)throw new Error('Unreachable descent');
          }
        }else{emit('keydown',move);emit('keyup',move);}
        if(locks.length||!s.playing)throw new Error('Early lock');
      }
      emit('keydown','hardDrop',lockTick);emit('keyup','hardDrop',lockTick);
      probe.finishFrame();
      const lock=locks[0];
      if(locks.length===1&&lock.frame===endFrame&&lock.subframe===.5&&
        key(lock.cells)===key(action.move.cells)&&lock.spin===action.execution.spin)return inputs;
    }catch{ /* A different start can avoid gravity or reset-limit interference. */ }
  }
  throw new Error('No authority-verified timed path for placement');
}
