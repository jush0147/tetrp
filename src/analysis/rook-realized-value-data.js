// OFFLINE ONLY: player-visible features and authority-REALIZED future labels.
// These are behavioral-policy outcomes, NOT counterfactual move values or
// features suitable for peeking into hidden NEXT6, garbage holes, or opponent.
export const FEATURE_NAMES=[
  'heightMax','heightMean','heightRoughness','holes','covered','garbage',
  'rowTransitions','wellDepth','filled','btb','combo','publicPending'
];

export function publicBoardFeatures(visible){
  if(!visible?.board?.rows||!Array.isArray(visible.next)||
    visible.next.length!==5||!visible.current)
    throw Error('Expected player-visible board/Current/NEXT5');
  const board=visible.board,{rows,width}=board,H=rows.length;
  if(!Number.isInteger(width)||width<=0||rows.some(r=>r.length!==width))
    throw Error('Invalid player-visible board');
  const heights=[],holes=[],covers=[];let filled=0,garbage=0,transitions=0;
  for(let x=0;x<width;x++){
    let top=H,seen=false,voids=0,buried=0;
    for(let y=0;y<H;y++){
      const cell=rows[y][x];
      if(cell!==null){
        if(!seen)top=y;
        seen=true;filled++;
        if(cell==='gb'||cell==='gbd')garbage++;
      }else if(seen){voids++;buried+=Math.min(8,H-y);}
    }
    heights.push(H-top);holes.push(voids);covers.push(buried);
  }
  for(const row of rows){
    let last=true;
    for(let x=0;x<width;x++){
      const now=row[x]!==null;
      if(last!==now)transitions++;
      last=now;
    }
    if(!last)transitions++;
  }
  const heightRoughness=heights.slice(1).reduce((n,h,i)=>
    n+Math.abs(h-heights[i]),0);
  const wellDepth=heights.reduce((best,h,i)=>
    Math.max(best,Math.min(i===0?H:heights[i-1],
      i===width-1?H:heights[i+1])-h),0);
  const pending=[...(visible.attack?.pending??[]),
    ...(visible.attack?.are??[])].reduce((n,p)=>n+(p.amt??0),0);
  const features={
    heightMax:Math.max(...heights),
    heightMean:heights.reduce((a,b)=>a+b,0)/width,
    heightRoughness,holes:holes.reduce((a,b)=>a+b,0),
    covered:covers.reduce((a,b)=>a+b,0),
    garbage,rowTransitions:transitions,wellDepth,filled,
    btb:visible.attack?.btb??0,combo:visible.attack?.combo??0,
    publicPending:pending
  };
  if(Object.values(features).some(v=>!Number.isFinite(v)||v<0))
    throw Error('Invalid public value feature');
  return features;
}

const COMBAT=['generated','sent','cancelled','tanked','received'];
const checkedTotals=x=>{
  if(!x||COMBAT.some(k=>!Number.isFinite(x[k])||x[k]<0))
    throw Error('Missing positive authority combat totals');
  return x;
};

// Each trace row has public input PLUS post-commit outcome *offline label*.
// Grouping is by whole original seed and side: windows in a match are
// correlated, and no split may place the same seed in training and testing.
export function buildRealizedWindows(traces,{horizon=8,matchCaps=new Map()}={}){
  if(!Number.isInteger(horizon)||horizon<1||horizon>40)
    throw RangeError('Invalid complete future window');
  const games=new Map();
  for(const row of traces){
    if(!Number.isSafeInteger(row.seed)||!Number.isInteger(row.turn)||
      row.turn<0||!Number.isInteger(row.slot)||![0,1].includes(row.slot)||
      !['rook','kiwi'].includes(row.kind))
      throw Error('Invalid source match/turn identity');
    const key=row.seed+':'+row.slot;
    if(!games.has(key))games.set(key,[]);
    games.get(key).push(row);
  }
  const examples=[],censored=[];
  for(const [game,rows]of games){
    rows.sort((a,b)=>a.turn-b.turn);
    if(rows.some((r,i)=>i&&r.turn!==rows[i-1].turn+1)||
      new Set(rows.map(r=>r.turn)).size!==rows.length)
      throw Error('Non-contiguous or duplicated authority lock trace '+game);
    const final=rows.at(-1),lastFinished=final?.outcome?.alive===false;
    const cap=matchCaps.get(final?.seed);
    for(let i=0;i<rows.length;i++){
      const start=rows[i],features=publicBoardFeatures(start.visible);
      checkedTotals(start.authorityBeforeTotals);
      const finish=rows[i+horizon-1];
      if(!finish){
        // Do NOT call a capped/truncated game a KO or impute its attack.
        censored.push({seed:start.seed,slot:start.slot,
          turn:start.turn,reason:lastFinished?'KO-before-horizon':
            cap==='capped'?'capped':'incomplete-window'});
        continue;
      }
      const after=checkedTotals(finish.outcome?.combatTotals);
      const delta=Object.fromEntries(COMBAT.map(k=>
        [k,after[k]-start.authorityBeforeTotals[k]]));
      if(Object.values(delta).some(x=>x<0))
        throw Error('Authority cumulative combat counters went backward');
      examples.push({seed:start.seed,slot:start.slot,kind:start.kind,
        turn:start.turn,features,
        targets:{sent:delta.sent,cancelled:delta.cancelled,
          tanked:delta.tanked,generated:delta.generated,
          received:delta.received},
        futureLocks:horizon,finalAlive:finish.outcome.alive===true});
    }
  }
  return {format:'rook-realized-future-windows/1',horizon,
    rawLocks:traces.length,independentSeeds:new Set(traces.map(r=>r.seed)).size,
    windows:examples,censored,
    caution:'Future labels are realized under the behavioral ROOK/Kiwi policy, not an action counterfactual. Adjacent windows and mirrored games are correlated.'};
}
