// Counterfactual garbage boards from player-visible packets only.
// Never claims which hole is real: each enumerated outcome is conditional.
import * as B from '../board.js';
import {createAttack,tank} from '../attack.js';
import {createHoles} from '../random.js';

const cloneBoard=b=>({...b,rows:b.rows.map(row=>row.slice())});
const clonePackets=p=>(p??[]).map(({column,...packet})=>({...packet}));

export function enumeratePublicTankOutcomes(board,combat,rules,{blocked=false,maxOutcomes=100}={}){
  if(!Number.isInteger(maxOutcomes)||maxOutcomes<1||maxOutcomes>10000)
    throw new RangeError('invalid garbage scenario limit');
  const base={...combat,pending:clonePackets(combat.pending),are:clonePackets(combat.are)};
  const cap=Math.floor(Math.min(rules.garbagecap,rules.garbagecapmax));
  let room=(!combat.live||blocked)?0:cap;
  const affected=[];
  for(let i=0;i<base.pending.length&&room>0;i++){
    const packet=base.pending[i];
    if(!packet.active||packet.status!=='spawn'||packet.shielded)continue;
    const portion=Math.min(packet.amt,room);
    if(portion>0){affected.push(i);room-=portion;}
  }
  if(!affected.length)return [{board:cloneBoard(board),combat:base,
    holes:[],tanked:0,topout:false,weight:1}];

  const width=board.width,possible=width**affected.length;
  if(possible>maxOutcomes)throw new RangeError(
    'cannot exhaust all public garbage holes under scenario limit');
  const outcomes=[];
  for(let number=0;number<possible;number++){
    let value=number;
    const holes=[];
    const packets=clonePackets(base.pending);
    for(const index of affected){
      const column=value%width;value=Math.floor(value/width);
      packets[index].column=column;holes.push(column);
    }
    const predictedBoard=cloneBoard(board);
    const state={...createAttack(),pieces:combat.pieces,combo:combat.combo,
      btb:combat.btb,multiplier:combat.multiplier,
      cumulativeSent:combat.cumulativeSent,
      pending:packets,are:clonePackets(base.are)};
    let topout=false;
    const tanked=tank(state,rules,createHoles(1),hole=>{
      const ok=B.pushLine(predictedBoard,hole);
      if(!ok)topout=true;
      return ok;
    });
    outcomes.push({board:predictedBoard,
      combat:{...base,pending:clonePackets(state.pending),are:clonePackets(state.are)},
      holes,tanked,topout,weight:1/possible});
  }
  return outcomes;
}
