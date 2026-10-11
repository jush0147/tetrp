// TSD construction candidates are geometry hints, never granted attack.
// Only a later SRS+ forward reachability proof can yield a Full TSD.
import * as B from '../board.js';
import * as R from '../rotation.js';

export function tsdScaffolds(board,rules,{maxMissing=5}={}){
  const allowed=['all','all+','all-mini','all-mini+','mini-only','stupid','handheld','T-spins','T-spins+'];
  if(!allowed.includes(rules.spinbonuses))return [];
  const H=board.rows.length,W=board.width,out=[];
  // A TSD is a two-row commitment. Ignore empty air and unsupported stacks.
  for(let y=Math.max(board.buffer,H-13);y<H;y++){
    for(const r of [0,2]){
      const touched=r===0?[y-1,y]:[y,y+1];
      if(touched.some(row=>row<board.buffer-2||row>=H))continue;
      if(touched.some(row=>board.rows[row].filter(c=>c!==null).length<3))continue;
      // Permanent garbage cannot form a clearable Full TSD pair. Never give
      // tactical construction credit to a physically impossible target.
      if(touched.some(row=>board.rows[row].includes('gbd')))continue;
      for(let x=1;x<W-1;x++){
        const piece={type:'t',x,y:y-.04,r,kick:0,rotated:true};
        if(!B.legal(board,piece))continue;
        const cells=B.cells(piece).map(([cx,cy])=>[cx,Math.ceil(cy)]);
        const targets=new Set(cells.map(([cx,cy])=>cy*W+cx));
        let missing=0;
        for(const row of touched)for(let col=0;col<W;col++)
          if(!targets.has(row*W+col)&&board.rows[row][col]===null)missing++;
        if(missing>maxMissing)continue;
        const full=missing===0&&R.classifySpin(board,piece,rules.spinbonuses)==='full';
        out.push({x,y,rotation:r,missing,fullSpinGeometry:full,rows:touched});
      }
    }
  }
  return out.sort((a,b)=>a.missing-b.missing||Number(b.fullSpinGeometry)-Number(a.fullSpinGeometry));
}

// Only a small scaffold heuristic. A ready-looking slot is NOT counted as a
// TSD until a forward-reachable rotation and its clear are proved by Tetrp.
export function tsdScaffoldPotential(board,rules){
  const options=tsdScaffolds(board,rules,{maxMissing:4});
  if(!options.length)return 0;
  const best=options[0];
  return Math.max(0,5-best.missing)+(best.fullSpinGeometry?2:0);
}
