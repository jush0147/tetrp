export const modes=['Single Round','Continuous','Repeat All','Repeat Round'];
export function nextRound(mode,index,count){
  if(mode===3)return index;
  if(mode===1)return index+1<count?index+1:null;
  if(mode===2)return (index+1)%count;
  return null;
}
export function bindPlayModes(button,menu,toast,onChange){
  let mode=0,hold,timer,suppress=false;
  // Standard playlist/repeat silhouettes, drawn inline without a font dependency.
  const paths=['M4 5h12M4 10h12M4 15h7M16 14l5 3-5 3z',
    'M4 5h12M4 10h12M4 15h7M16 14l5 3-5 3z',
    'M17 2l4 4-4 4M21 6H7a4 4 0 0 0-4 4M7 22l-4-4 4-4M3 18h14a4 4 0 0 0 4-4',
    'M17 2l4 4-4 4M21 6H7a4 4 0 0 0-4 4M7 22l-4-4 4-4M3 18h14a4 4 0 0 0 4-4M10 10l2-1v6'];
  function close(){menu.hidden=true;button.setAttribute('aria-expanded','false');}
  function render(){
    button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[mode]}"/></svg>`;
    button.dataset.mode=String(mode);button.setAttribute('aria-label',`Playback mode: ${modes[mode]}`);button.title=modes[mode];
    for(const [i,item] of [...menu.children].entries())item.setAttribute('aria-checked',String(i===mode));
  }
  function choose(value){mode=value;render();close();toast.textContent=modes[mode];toast.hidden=false;clearTimeout(timer);timer=setTimeout(()=>toast.hidden=true,1500);onChange(mode);}
  for(const [i,label] of modes.entries()){const item=document.createElement('button');item.type='button';item.role='menuitemradio';item.textContent=label;item.addEventListener('click',()=>{choose(i);button.focus();});menu.append(item);}
  button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
  button.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;suppress=false;button.setPointerCapture(e.pointerId);hold=setTimeout(()=>{suppress=true;menu.hidden=false;button.setAttribute('aria-expanded','true');},450);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>clearTimeout(hold));
  button.addEventListener('contextmenu',e=>e.preventDefault());
  button.addEventListener('click',()=>{if(suppress){suppress=false;return;}choose((mode+1)%4);});
  button.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();menu.hidden=false;button.setAttribute('aria-expanded','true');menu.children[mode].focus();}});
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!button.contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){close();button.focus();}});
  render();return ()=>mode;
}
