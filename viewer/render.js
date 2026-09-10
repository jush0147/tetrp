import { cells } from '../src/board.js';
import pieces from '../src/data/pieces.json' with {type:'json'};

// Original palette and drawing, using the existing engine's geometry.
export const palette={i:'#82daca',o:'#e8cc83',t:'#b9a3df',s:'#a9c884',z:'#e99391',j:'#91b4dc',l:'#dea67a',gb:'#7c8892',gbd:'#535d68'};
export function boardModel(state) {
  const {board,piece}=state;
  const active=piece&&!piece.sleeping ? cells(piece).map(([x,y])=>[x,Math.ceil(y)-board.buffer])
    .filter(([x,y])=>x>=0&&x<board.width&&y>=0&&y<board.height) : [];
  return {width:board.width,height:board.height,rows:board.rows.slice(board.buffer).map(row=>[...row]),
    active,type:piece?.type??null,rotation:piece?.r??0,above:piece&&!piece.sleeping&&cells(piece).some(([,y])=>Math.ceil(y)<board.buffer),
    hold:structuredClone(state.hold),next:state.bag.queue.slice(0,state.rules.nextcount),
    frame:state.frame,placement:state.stats.pieces,lines:state.stats.lines};
}
function tile(ctx,x,y,size,type,active=false) {
  ctx.fillStyle=palette[type]||'#7c8892';ctx.fillRect(x+1.5,y+1.5,size-3,size-3);
  ctx.fillStyle=active?'#ffffffaa':'#ffffff35';ctx.fillRect(x+3,y+3,size-6,2);
  if(active){ctx.strokeStyle='#eefcf8';ctx.lineWidth=1;ctx.strokeRect(x+1.5,y+1.5,size-3,size-3);}
}
export function drawBoard(canvas,model) {
  const unit=30;canvas.width=model.width*unit;canvas.height=model.height*unit;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#10191f';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#ffffff09';ctx.lineWidth=1;
  for(let x=0;x<=model.width;x++){ctx.beginPath();ctx.moveTo(x*unit+.5,0);ctx.lineTo(x*unit+.5,canvas.height);ctx.stroke();}
  for(let y=0;y<=model.height;y++){ctx.beginPath();ctx.moveTo(0,y*unit+.5);ctx.lineTo(canvas.width,y*unit+.5);ctx.stroke();}
  model.rows.forEach((row,y)=>row.forEach((type,x)=>{if(type)tile(ctx,x*unit,y*unit,unit,type);}));
  model.active.forEach(([x,y])=>tile(ctx,x*unit,y*unit,unit,model.type,true));
  canvas.setAttribute('aria-label',`棋盤 ${model.width} × ${model.height}，第 ${model.placement} 顆，${model.lines} 行。${model.above?'目前方塊位於上方緩衝區。':''}`);
}
export function drawPreview(canvas,type,rotation=0) {
  canvas.width=80;canvas.height=40;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,80,40);
  if(!type){canvas.setAttribute('aria-label','空');return;}
  const geometry=pieces[type].rotations[rotation],xs=geometry.map(p=>p[0]),ys=geometry.map(p=>p[1]);
  const left=Math.min(...xs),top=Math.min(...ys),w=Math.max(...xs)-left+1,h=Math.max(...ys)-top+1;
  const unit=Math.min(16,76/w,36/h);
  for(const [x,y] of geometry)tile(ctx,(80-w*unit)/2+(x-left)*unit,(40-h*unit)/2+(y-top)*unit,unit,type);
  canvas.setAttribute('aria-label',type.toUpperCase());
}
