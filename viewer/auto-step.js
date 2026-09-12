// Latched stepping: releasing a long press keeps it running until explicitly stopped.
export function bindAutoStep(previous,next,step,ready){
  let direction=0,interval=null,hold=null;
  const buttons=new Map([[-1,previous],[1,next]]);
  function cancelHold(){clearTimeout(hold);hold=null;}
  function stop(){cancelHold();clearInterval(interval);interval=null;direction=0;for(const b of buttons.values())b.setAttribute('aria-pressed','false');}
  function check(){if(direction&&buttons.get(direction).disabled)stop();}
  function advance(){check();if(direction&&ready())step(direction);}
  function start(value){stop();direction=value;buttons.get(value).setAttribute('aria-pressed','true');advance();if(direction)interval=setInterval(advance,1000);}
  for(const [value,button] of buttons){
    let suppressClick=false;
    button.setAttribute('aria-pressed','false');
    button.title=`${value<0?'上一顆':'下一顆'}；長按自動步進`;
    button.addEventListener('pointerdown',e=>{
      if(e.button!==0||!e.isPrimary)return;
      cancelHold();suppressClick=false;button.setPointerCapture(e.pointerId);
      hold=setTimeout(()=>{suppressClick=true;start(value);},450);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,cancelHold);
    button.addEventListener('contextmenu',e=>e.preventDefault());
    button.addEventListener('click',()=>{
      cancelHold();if(suppressClick){suppressClick=false;return;}
      if(direction===value)stop();else if(direction)start(value);else if(ready())step(value);
    });
  }
  return {stop,check};
}
