// Self-contained executable demonstration of the independent ROOK search
// against the real Tetrp engine. It never sees the authority's hidden bag.
import {Engine} from '../src/engine.js';
import {RookSession} from '../src/analysis/rook-session.js';

const seed=Number(process.argv[2]??99);
const pieces=Number(process.argv[3]??8);
if(!Number.isSafeInteger(seed)||!Number.isInteger(pieces)||pieces<1||pieces>100)
  throw Error('usage: node scripts/rook-demo.js [integer-seed=99] [pieces=8]');
const game=new Engine({seed,mode:'tl',rules:{g:0,b2bcharge_base:3}});
const options={
  depth:Number(process.env.ROOK_DEPTH??1),
  beamWidth:Number(process.env.ROOK_BEAM??6),
  maxNodes:Number(process.env.ROOK_NODES??600),
  maxStates:Number(process.env.ROOK_STATES??600),
};
const session=new RookSession(game,{options});
const sourceCheckpoint=game.serialize();
process.stdout.write(JSON.stringify({type:'rook-demo',seed,pieces,options,source:'tetrp-v19'})+'\n');
for(let i=0;i<pieces;i++){
  const before=session.view().visible;
  const result=session.step();
  const after=result.view.visible;
  process.stdout.write(JSON.stringify({
    type:'placement',index:result.view.index,
    current:before.current.type,hold:before.hold.piece,next:before.next,
    actions:result.actions,next_after:after.next,hold_after:after.hold.piece,
    b2b:after.attack?.btb,combo:after.attack?.combo,
  })+'\n');
  if(game.serialize()!==sourceCheckpoint)
    throw Error('original Tetrp replay authority was mutated');
  if(result.view.stopped)break;
}
process.stdout.write(JSON.stringify({type:'summary',
  completed_placements:session.view().index,source_unchanged:game.serialize()===sourceCheckpoint})+'\n');
