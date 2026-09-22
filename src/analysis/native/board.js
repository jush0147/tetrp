import pieces from '../../data/pieces.json' with {type:'json'};

export const FULL=1023, ROWS=40;
export const popcount=new Uint8Array(1024);
for(let i=1;i<1024;i++)popcount[i]=popcount[i>>1]+(i&1);
export function pack(board){
  if(board.width!==10||board.height!==20||board.buffer!==20||board.rows.length!==40)
    throw new Error('NATIVE_BOARD_UNSUPPORTED');
  const rows=new Uint16Array(40),garbage=new Uint16Array(40);
  board.rows.forEach((row,y)=>{
    if(row.length!==10)throw new Error('NATIVE_BOARD_UNSUPPORTED');
    row.forEach((cell,x)=>{
      if(cell===null)return;
      if(cell!=='gb'&&!Object.hasOwn(pieces,cell))throw new Error('NATIVE_MATERIAL_UNSUPPORTED');
      rows[y]|=1<<x;if(cell==='gb')garbage[y]|=1<<x;
    });
  });
  return {rows,garbage,lastWasAttack:Boolean(board.lastWasAttack)};
}
export const copy=b=>({rows:b.rows.slice(),garbage:b.garbage.slice(),lastWasAttack:b.lastWasAttack});
export function cells(p){
  const d=pieces[p.type];
  return d.rotations[p.r].map(([x,y])=>[p.x+x-d.pivot[0],Math.ceil(p.y+y-d.pivot[1])]);
}
export function occupied(b,x,y){return x<0||x>=10||y<0||Math.ceil(y)>=40||Boolean(b.rows[Math.ceil(y)]&(1<<x));}
export function legal(b,p){
  const d=pieces[p.type];
  if(!d||!Number.isInteger(p.r)||p.r<0||p.r>3)return false;
  for(const [x,y] of d.rotations[p.r])if(occupied(b,p.x+x-d.pivot[0],p.y+y-d.pivot[1]))return false;
  return true;
}
export const geometry={occupied,legal};
export function commit(b,p){
  if(!legal(b,p))throw new Error('NATIVE_ILLEGAL_PLACEMENT');
  const pos=cells(p),lockout=pos.every(([,y])=>y<20);
  for(const [x,y] of pos)b.rows[y]|=1<<x;
  let lines=0,garbageRows=0,write=39;
  for(let y=39;y>=0;y--){
    if(b.rows[y]===FULL){lines++;if(b.garbage[y])garbageRows++;}
    else {b.rows[write]=b.rows[y];b.garbage[write--]=b.garbage[y];}
  }
  while(write>=0){b.rows[write]=0;b.garbage[write--]=0;}
  b.lastWasAttack=false;
  return {lines,garbageRows,lockout,allClear:lines>0&&b.rows.every(r=>r===0)};
}
export function pushGarbage(b,hole){
  if(b.rows[0]===FULL)return false;
  b.rows.copyWithin(0,1);b.garbage.copyWithin(0,1);
  b.rows[39]=FULL^(1<<hole);b.garbage[39]=b.rows[39];b.lastWasAttack=true;return true;
}
// No handcrafted spin cutouts: features always describe the actual board.
export function features(b,pending){
  let n=0,u=0,h=0,seen=0;
  for(let y=0;y<40;y++){
    const row=b.rows[y];n+=popcount[row];
    if(row&&!h)h=40-y;
    u+=popcount[seen&~row&FULL];seen|=row;
  }
  return {load:(n+9*pending)/10,coveredEmpty:u,height:h*h/20,cells:n,maxHeight:h};
}
