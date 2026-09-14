// Android standalone startup can settle its visual viewport after the first layout.
// Keep the app tied to the visible area, including reload and file-picker return.
export function bindViewport(window,root){
  let pending=false;
  function measure(){
    const visual=window.visualViewport;
    // Preserve intentional pinch zoom; do not resize the application around it.
    if(visual&&Math.abs(visual.scale-1)>.01)return;
    const height=Math.floor(Math.min(window.innerHeight,visual?.height??window.innerHeight));
    if(height>0)root.style.setProperty('--app-height',`${height}px`);
  }
  function schedule(){
    measure();
    if(!pending){pending=true;window.requestAnimationFrame(()=>{pending=false;measure();});}
  }
  measure();schedule();
  for(const name of ['resize','pageshow','load','focus','orientationchange'])window.addEventListener(name,schedule);
  window.visualViewport?.addEventListener('resize',schedule);
  window.document.addEventListener('visibilitychange',()=>{if(!window.document.hidden)schedule();});
}
