import {Engine} from '../engine.js';
import * as B from '../board.js';
import * as R from '../rotation.js';
import {captureSnapshot,captureSnapshotFromEngine,buildSnapshotRequest,validateSnapshotAction,normalizeSnapshotError,assertSupportedSnapshotRules} from '../../vendor/kiwi-v1/kiwi-snapshot-adapter.mjs';
import {createPlacementTools} from '../../vendor/kiwi-v1/tetrp-placement-path.mjs';
export const NODE_BUDGET=200000;
const placementTools=createPlacementTools({Engine,boardModule:B,rotationModule:R});
export {normalizeSnapshotError};
// The facade contains only the allowlisted visible projection, never a checkpoint.
export function snapshotAuthority(s){return {state:{board:s.board,piece:s.current,hold:s.hold,
  bag:{queue:s.next},rules:s.rules,frame:s.frame,subframe:s.subframe,playing:s.playing,
  stats:{pieces:s.piecesPlaced},attack:s.attack,garbageLockedUntil:s.garbageLockedUntil}};}
export function prepareKiwi(snapshot){
  const authority=snapshotAuthority(snapshot);
  // Reject unsupported packets/rules before the expensive enumeration.
  assertSupportedSnapshotRules(snapshot.rules);
  captureSnapshot(authority.state,{rootGeometry:{placements:[]}});
  const visible=captureSnapshotFromEngine(authority,placementTools);
  const request=buildSnapshotRequest(visible,{nodeBudget:NODE_BUDGET,framesPerPiece:24});
  const warnings=['有限可見序列搜尋；完整規則等價未驗證。落點已驗證幾何可達性，未保證實際操作時序。'];
  if(!snapshot.attack)warnings.push('40L 使用中性 combo／B2B 與競技堆疊評估，不是最速解。');
  if(request.incoming.length)warnings.push('待接收垃圾以 24 frames／顆、10 種假設洞位評估；不是 replay 未來預測。');
  if(request.incoming.some(p=>p.ready_in_frames===null))warnings.push('部分垃圾的到達時間未知，已納入不同到達時機的估算。');
  if(snapshot.rules.garbageare||snapshot.rules.garbagearebump)warnings.push('垃圾 ARE／bump 保留原規則值，但時序仍為近似。');
  return {authority,request,warnings,path:'snapshot'};
}
export function normalizeRecommendation(snapshot,prepared,report){
  if(report.schema!=='kiwi-snapshot-result/3'||!report.action)throw new Error('Unexpected Kiwi result');
  const action=report.action;
  if(action.kind==='place'&&!prepared.request.root_legal_placements.some(p=>JSON.stringify(p)===JSON.stringify(action.placement)))
    throw new Error('Kiwi placement is outside the authority allowlist');
  const checked=validateSnapshotAction(prepared.authority,action,{Engine,placementTools});
  if(action.kind==='hold')return {action:{kind:'hold',mode:action.mode,samePiece:action.same_piece,requiresReanalysis:true},move:null};
  const engine=new Engine({mode:snapshot.rules.mode,seed:1,rules:snapshot.rules});
  Object.assign(engine.state,{board:structuredClone(snapshot.board),piece:structuredClone(snapshot.current),hold:structuredClone(snapshot.hold)});
  engine.state.bag.queue=[...snapshot.next];
  for(const move of checked.path.moves){
    if(move==='moveLeft'||move==='moveRight')engine.move(move==='moveLeft'?-1:1);
    else if(move==='down')engine.descend(1);
    else if(move==='hardDrop')engine.slam(true);
    else engine.rotate({rotateCW:1,rotateCCW:3,rotate180:2}[move]);
  }
  const p=engine.state.piece,cells=B.cells(p).map(([x,y])=>[x,Math.ceil(y)]);
  const key=v=>v.map(c=>c.join(',')).sort().join(';');
  // Hard drop preserves the spin earned by the actual input path. Reclassifying
  // at the landing can invent a spin that was never earned by a rotation there.
  if(!B.legal(engine.state.board,p)||key(cells)!==key(checked.path.target.cells)||p.spin!==checked.path.target.spin)
    throw new Error('Kiwi placement failed authority geometry validation');
  return {action:{kind:'place'},move:{piece:p.type,x:p.x,y:Math.ceil(p.y),rotation:p.r,useHold:false,cells},
    execution:{moves:checked.path.moves,spin:checked.path.target.spin}};
}

export function normalizeRankedRecommendation(snapshot,prepared,report,startIndex=0){
  if(!Number.isInteger(startIndex)||startIndex<0||!Array.isArray(report.candidates)||!report.candidates[startIndex])
    throw new Error('No more Kiwi candidates');
  let lastError;
  for(let candidateIndex=startIndex;candidateIndex<report.candidates.length;candidateIndex++){
    try{return {...normalizeRecommendation(snapshot,prepared,{...report,action:report.candidates[candidateIndex].action}),
      candidateIndex,candidateCount:report.candidates.length};}
    catch(error){lastError=error;}
  }
  throw new Error('No Kiwi candidate passed authority validation',{cause:lastError});
}
