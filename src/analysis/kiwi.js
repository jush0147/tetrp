import {Engine} from '../engine.js';
import * as B from '../board.js';
import * as R from '../rotation.js';
import {ruleset} from '../rules.js';
import {SevenBagObserver,captureVisibleState,buildAnalysisRequest,inferredUseHold} from '../../vendor/kiwi-v1/tetrp-authority-adapter.mjs';
import {createPlacementTools} from '../../vendor/kiwi-v1/tetrp-placement-path.mjs';
export const NODE_BUDGET=200000;
const placementTools=createPlacementTools({Engine,boardModule:B,rotationModule:R});
const fail=message=>{throw new Error(message);};

export function prepareKiwi(snapshot) {
  const s=snapshot,r=s.rules;
  if(!s.playing||s.current.sleeping)fail('此位置沒有可分析的活動方塊。');
  if(s.board.width!==10||s.board.height!==20||s.board.buffer!==20||s.board.rows.some(row=>row.includes('gbd')))
    fail('Kiwi v1 僅支援 10 × 40 棋盤與一般垃圾。');
  if(r.nextcount!==5||r.bagtype!=='7-bag'||r.kickset!=='SRS+'||!r.allow180||!r.hold||r.infinite_hold)
    fail('此 replay 的 Next／Hold／旋轉規則不支援 Kiwi v1。');
  if(s.hold.locked)fail('此位置已使用 Hold；Kiwi v1 無法限制根節點 Hold，請移至下一顆。');
  if(r.mode==='blitz')fail('Kiwi v1 尚不支援 Blitz。');
  const supported=ruleset('tl');
  for(const key of ['spinbonuses','b2bchaining','b2bcharging','b2bcharge_at',
    'combotable','allclears','allclear_garbage','allclear_b2b','garbagespecialbonus','garbageattackcap','openerphase_pieces'])
    if(r[key]!==supported[key])fail(`Kiwi v1 不支援此規則：${key}`);
  const incoming=[...(s.attack?.are??[]),...(s.attack?.pending??[])].filter(p=>p.amt>0);
  if(incoming.some(p=>p.hardened||p.shielded||p.status!=='spawn'))fail('Kiwi v1 不支援此垃圾封包狀態。');
  if(incoming.length&&(Math.min(r.garbagecap,r.garbagecapmax)!==8||r.garbageblocking!=='combo blocking'||r.garbageentry!=='instant'))
    fail('Kiwi v1 pending approximation 不支援此垃圾規則。');
  const warnings=[];
  warnings.push('Kiwi 為堆疊建議；完整規則等價未驗證，包含 opener double-cancel 與 clutch clear 限制。');
  if(s.attack&&r.b2bcharge_base!==0)warnings.push(`Replay surge base=${r.b2bcharge_base}；Kiwi 固定以 base=0 評估，surge 攻擊量可能低估。`);
  if(s.attack&&!incoming.length&&s.attack.multiplier!==1)warnings.push('此位置攻擊倍率不是 1；Kiwi persistent 搜尋固定以倍率 1 評估。');
  if(incoming.length&&(r.garbageare||r.garbagearebump||s.attack.are.length))warnings.push('垃圾 ARE／bump 與逐行入盤時序僅作 snapshot 近似，未逐 frame 模擬。');
  if(!s.attack)warnings.push('40L 的 combo／B2B 未知；Kiwi 使用中性起始值與對戰堆疊評估，並非 40L 最速解。');
  // captureVisibleState's ready check was written for a frame-paced harness.
  // Our detached projection is the exact atomic replay position: no finishFrame,
  // input replay, time advance, or mutation of canonical state is performed.
  const visible=captureVisibleState({state:{
    phase:'ready',frame:s.frame,board:s.board,piece:s.current,bag:{queue:s.next},hold:s.hold,rules:r,
    stats:{pieces:s.piecesPlaced},attack:s.attack??{combo:0,btb:0,are:[],pending:[],cumulativeSent:0,multiplier:1},
  }});
  const observer=new SevenBagObserver(s.observedDraws,s.observedDraws.slice(-6));
  const bag=observer.snapshot();
  if(JSON.stringify(bag.visible.slice(1))!==JSON.stringify(visible.queue.slice(1)))fail('Observed SevenBag preview is not aligned');
  // A held piece is not a bag draw. Preserve the observer's frontier, but bind
  // buildAnalysisRequest to the actual current + NEXT5 decision window.
  const request=buildAnalysisRequest(visible,{snapshot:()=>({...bag,visible:visible.queue})},{nodeBudget:NODE_BUDGET,framesPerPiece:24});
  if(incoming.length)warnings.push('待接收垃圾以 24 frames／顆、10 種假設洞位評估；不是 replay 未來預測。');
  return {visible,request,warnings,path:incoming.length?'pending-snapshot':'persistent'};
}

export function normalizePlacement(snapshot, visible, placement) {
  if(!placement)fail('Kiwi 找不到可用建議。');
  // Geometry sandbox contains only the visible projection and a fixed dummy RNG.
  // It never receives replay RNG, events, future queue, or opponent information.
  const engine=new Engine({mode:snapshot.rules.mode,seed:1,rules:snapshot.rules});
  Object.assign(engine.state,{board:structuredClone(snapshot.board),piece:structuredClone(snapshot.current),
    hold:structuredClone(snapshot.hold)});
  engine.state.bag.queue=[...snapshot.next];
  const path=placementTools.findPath(engine,placement);
  for(const move of path.moves){
    if(move==='hold')engine.hold();
    else if(move==='moveLeft'||move==='moveRight')engine.move(move==='moveLeft'?-1:1);
    else if(move==='down')engine.descend(1);
    else if(move==='hardDrop')engine.slam(true);
    else engine.rotate({rotateCW:1,rotateCCW:3,rotate180:2}[move]);
  }
  const p=engine.state.piece,cells=B.cells(p).map(([x,y])=>[x,Math.ceil(y)]);
  const key=v=>v.map(c=>c.join(',')).sort().join(';');
  if(!B.legal(engine.state.board,p)||key(cells)!==key(path.target.cells)||R.classifySpin(engine.state.board,p,snapshot.rules.spinbonuses)!==path.target.spin)
    fail('Kiwi placement 未通過 Tetrp 座標／可達性／spin 檢查。');
  return {piece:p.type,x:p.x,y:Math.ceil(p.y),rotation:p.r,useHold:inferredUseHold(visible,placement),cells};
}
