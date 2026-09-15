export const modes=['Single Round','Continuous','Repeat All','Repeat Round'];
export function nextRound(mode,index,count){
  if(mode===3)return index;
  if(mode===1)return index+1<count?index+1:null;
  if(mode===2)return (index+1)%count;
  return null;
}
export function bindPlayModes(button,menu,toast,onChange){
  // Standard playlist/repeat silhouettes, drawn inline without a font dependency.
  const paths=['M4 5h12M4 10h12M4 15h7M16 14l5 3-5 3z',
    'M4 5h12M4 10h12M4 15h7M16 14l5 3-5 3z',
    'M17 2l4 4-4 4M21 6H7a4 4 0 0 0-4 4M7 22l-4-4 4-4M3 18h14a4 4 0 0 0 4-4',
    'M17 2l4 4-4 4M21 6H7a4 4 0 0 0-4 4M7 22l-4-4 4-4M3 18h14a4 4 0 0 0 4-4M10 10l2-1v6'];
  return bindPicker(button,menu,modes,0,i=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[i]}"/></svg>`,(i)=>{
    toast.textContent=modes[i];toast.hidden=false;clearTimeout(toast.hideTimer);toast.hideTimer=setTimeout(()=>toast.hidden=true,1500);onChange(i);
  },'Playback mode');
}
export function bindPicker(button,menu,labels,initial,markup,onChange,name){
  let mode=initial,hold,suppress=false;
  function close(){menu.hidden=true;button.setAttribute('aria-expanded','false');}
  function open(){menu.hidden=false;button.setAttribute('aria-expanded','true');}
  function render(){
    button.innerHTML=markup(mode);button.dataset.mode=String(mode);button.value=labels[mode].replace('×','');
    button.setAttribute('aria-label',name+': '+labels[mode]);button.title=labels[mode];
    for(const [i,item] of [...menu.children].entries())item.setAttribute('aria-checked',String(i===mode));
  }
  function choose(value){mode=value;render();close();onChange(mode);}
  for(const [i,label] of labels.entries()){
    const item=document.createElement('button');item.type='button';item.role='menuitemradio';item.innerHTML=markup(i);item.title=label;item.setAttribute('aria-label',label);item.dataset.mode=String(i);
    item.addEventListener('click',()=>{choose(i);button.focus();});menu.append(item);
  }
  button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-controls',menu.id);button.setAttribute('aria-expanded','false');
  button.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;suppress=false;button.setPointerCapture(e.pointerId);hold=setTimeout(()=>{suppress=true;open();},450);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>clearTimeout(hold));
  button.addEventListener('contextmenu',e=>e.preventDefault());
  button.addEventListener('click',()=>{if(suppress){suppress=false;return;}choose((mode+1)%labels.length);});
  button.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();open();menu.children[mode].focus();}});
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!button.contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){close();button.focus();}});
  render();const value=()=>mode;value.set=i=>{if(Number.isInteger(i)&&i>=0&&i<labels.length){mode=i;render();close();}};return value;
}
