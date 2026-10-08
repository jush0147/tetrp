// Experimental ROOK Worker. Same detached player-visible input as Kiwi Worker;
// no checkpoint, source replay, RNG, original future or other-player state.
import {chooseMove} from '../src/analysis/rook.js';

const budget={depth:4,beamWidth:24,maxNodes:6000,maxStates:1200,maxSteps:42};
let lastKey=null,lastChoices=null,lastMeta=null;
self.onmessage=({data:{id,state,candidateIndex=0}})=>{
  try{
    if(!Number.isSafeInteger(candidateIndex)||candidateIndex<0)
      throw new Error('Invalid ROOK candidate index');
    const key=JSON.stringify(state);
    const cached=key===lastKey&&lastChoices!==null;
    if(!cached){
      const start=performance.now();
      const result=chooseMove(state,{...budget,includeRanked:true});
      lastChoices=result.ranked;
      lastMeta={nodes:result.diagnostics.evaluated,
        elapsedMs:Math.round(performance.now()-start)};
      lastKey=key;
    }
    const choice=lastChoices[candidateIndex];
    if(!choice)throw new Error('No more ROOK candidates after Tetrp validation');
    const action=choice.kind==='hold'
      ?{kind:'hold',mode:choice.mode,samePiece:choice.samePiece,requiresReanalysis:true}
      :{kind:'place'};
    postMessage({id,result:{
      action,move:choice.kind==='place'?choice.move:null,
      execution:choice.kind==='place'?choice.execution:null,
      candidateIndex,candidateCount:lastChoices.length,
      nodes:lastMeta.nodes,nodeBudget:budget.maxNodes,completion:'bounded-beam-search',
      warnings:['ROOK 獨立搜尋實驗版；只讀玩家當下可見快照與 NEXT 5。',
        'SRS+ 合法路徑由 Tetrp 驗證後直接鎖定；24 frames 只維持每顆的對戰時間，不限制按鍵數。',
        '未提供對戰勝率證據，不能視為比 Kiwi 或 CC2 強。'],
      path:'rook-finite-visible',searchMs:lastMeta.elapsedMs,cached,
    }});
  }catch(error){
    lastKey=null;lastChoices=null;lastMeta=null;
    postMessage({id,error:'ROOK_SEARCH_REJECTED: '+(error instanceof Error?error.message:String(error))});
  }
};
