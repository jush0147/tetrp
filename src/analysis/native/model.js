import {resolveAttack} from '../../attack.js';
import {assertSupportedSnapshotRules} from '../../../vendor/kiwi-v1/kiwi-snapshot-adapter.mjs';
import * as B from './board.js';
import {rescuedSpawn} from './movegen.js';

const effects={completePacket(){},send(a,n){if(n>0){a.cumulativeSent+=n;a.totals.sent+=n;}}};
const totals=()=>({generated:0,cancelled:0,sent:0,tanked:0});
export function fromSnapshot(s){
  assertSupportedSnapshotRules(s.rules);
  if(s.rules.mode!=='tl'||!s.attack)throw new Error('NATIVE_TL_ONLY');
  if(!s.playing||s.current?.sleeping||!s.current)throw new Error('NATIVE_NOT_PLAYABLE');
  if(s.next.length!==5||[s.current.type,...s.next,s.hold.piece].some(p=>p!==null&&![...'zlosijt'].includes(p)))throw new Error('NATIVE_QUEUE_INVALID');
  if(s.attack.are.some(p=>p.amt>0))throw new Error('NATIVE_ARE_UNSUPPORTED');
  const pending=s.attack.pending.filter(p=>p.amt>0).map((p,index)=>{
    if(p.hardened||p.shielded||p.status!=='spawn')throw new Error('NATIVE_PACKET_UNSUPPORTED');
    if(!Number.isSafeInteger(p.amt)||p.amt<0||!p.active&&p.activeFrame!==null&&(!Number.isInteger(p.activeFrame)||p.activeFrame<=s.frame))throw new Error('NATIVE_PACKET_INVALID');
    return {amt:p.amt,active:Boolean(p.active),activeFrame:p.activeFrame,status:'spawn',hardened:false,shielded:false,index};
  });
  for(const v of [s.frame,s.piecesPlaced,s.attack.combo,s.attack.btb,s.attack.cumulativeSent,s.attack.multiplier])
    if(!Number.isFinite(v)||v<0)throw new Error('NATIVE_COUNTER_INVALID');
  return {board:B.pack(s.board),current:{...s.current},next:[...s.next],hold:{...s.hold},frame:s.frame,
    garbageLockedUntil:s.garbageLockedUntil,lastClear:s.attack.combo>0,dead:false,frontier:false,
    attack:{combo:s.attack.combo,btb:s.attack.btb,pieces:s.piecesPlaced,multiplier:s.attack.multiplier,
      cumulativeSent:s.attack.cumulativeSent,pending,are:[],totals:totals()}};
}
export function clone(s){return {...s,board:B.copy(s.board),current:s.current?{...s.current}:null,next:[...s.next],hold:{...s.hold},
  attack:{...s.attack,pending:s.attack.pending.map(p=>({...p})),are:[],totals:{...s.attack.totals}}};}
export function holdState(s,rules){
  if(s.hold.locked)return null;
  const n=clone(s),replacement=n.hold.piece??n.next.shift();
  n.hold={piece:n.current.type,locked:true};
  n.current=replacement?rescuedSpawn(n.board,replacement,n.lastClear,rules):null;
  n.dead=Boolean(replacement&&!n.current);n.frontier=!replacement;return n;
}
export function scenarios(s,{framesPerPiece,horizon}){
  if(!s.attack.pending.length)return [{id:0,hole:0,unknownDelay:Infinity}];
  const unknown=s.attack.pending.some(p=>!p.active&&p.activeFrame===null);
  const delays=unknown?[1,framesPerPiece+1,framesPerPiece*(horizon+1)+1]:[Infinity];
  return delays.flatMap((unknownDelay,t)=>Array.from({length:10},(_,hole)=>({id:t*10+hole,hole,unknownDelay})));
}
/** Placement-level transition, not a frame/handling simulator. All TL offence
 * and cancellation use the exact shared authority transaction. */
export function place(s,p,rules,{framesPerPiece,rootFrame,scenario}){
  const n=clone(s),beforeSent=n.attack.totals.sent,lockFrame=s.frame+framesPerPiece-1;
  for(let f=s.frame+1;f<=lockFrame;f++)if(f>rules.garbagemargin_frames+1)n.attack.multiplier+=rules.garbageincrease_per_second/60;
  let unknownObserved=false;
  for(const packet of n.attack.pending){
    const activation=packet.activeFrame??(rootFrame+scenario.unknownDelay);
    if(!packet.active&&activation<=lockFrame){packet.active=true;if(packet.activeFrame===null)unknownObserved=true;}
  }
  const clear=B.commit(n.board,p);n.lastClear=clear.lines>0;
  const resolved=resolveAttack(n.attack,{...clear,spin:p.spin},rules,null,()=>{},effects);
  let inserted=0;
  if(resolved.blocked)n.garbageLockedUntil=Math.max(n.garbageLockedUntil,lockFrame+rules.garbagearebump);
  else {
    const cap=Math.floor(Math.min(rules.garbagecap,rules.garbagecapmax));
    for(let i=0;i<n.attack.pending.length&&inserted<cap;){
      const packet=n.attack.pending[i];
      if(!packet.active){i++;continue;}
      if(!B.pushGarbage(n.board,(scenario.hole+3*packet.index)%10)){n.dead=true;break;}
      packet.amt--;inserted++;
      if(!packet.amt)n.attack.pending.splice(i,1);
    }
  }
  n.attack.totals.tanked+=inserted;
  if(clear.lockout&&!rules.nolockout&&(!clear.lines||!rules.clutch))n.dead=true;
  const type=n.next.shift();n.hold.locked=false;
  n.current=type?rescuedSpawn(n.board,type,n.lastClear,rules):null;
  if(type&&!n.current)n.dead=true;
  // Stop at the first modeled reveal. Do not optimize a different future policy
  // with advance knowledge of each assumed hole or unknown activation time.
  n.frontier=!type||inserted>0||(unknownObserved&&n.attack.pending.some(q=>q.activeFrame===null));
  n.frame=s.frame+framesPerPiece;
  if(n.frame>rules.garbagemargin_frames+1)n.attack.multiplier+=rules.garbageincrease_per_second/60;
  return {state:n,sent:n.attack.totals.sent-beforeSent,clear,inserted};
}
export function leaf(s,weights){
  if(s.dead)return {value:-1e6,features:null};
  const f=B.features(s.board,s.attack.pending.reduce((a,p)=>a+p.amt,0));
  return {value:-weights.load*f.load-weights.coveredEmpty*f.coveredEmpty-weights.height*f.height,features:f};
}
export function stateKey(s){
  return [s.board.rows.join('.'),s.board.garbage.join('.'),s.current?Object.values(s.current).join(','):'?',
    s.next.join(''),s.hold.piece,s.hold.locked,s.frame,s.lastClear,s.garbageLockedUntil,
    s.attack.combo,s.attack.btb,s.attack.pieces,s.attack.multiplier,s.attack.cumulativeSent,
    s.attack.pending.map(p=>`${p.index},${p.amt},${p.active},${p.activeFrame}`).join(';')].join('|');
}
