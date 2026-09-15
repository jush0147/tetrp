let recoveryHooks;
export function setRecoveryHooks(hooks){recoveryHooks=hooks;}
let reloading=false,prepared=false,preparation=0;
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',async event=>{
  const message=event.data;
  if(message?.type==='PREPARE_UPDATE'){
    const attempt=++preparation;
    try{if(!recoveryHooks)throw new Error('Viewer not ready');await recoveryHooks.prepare();if(attempt!==preparation){recoveryHooks.cancel();event.ports[0]?.postMessage({ready:false});return;}prepared=true;event.ports[0]?.postMessage({ready:true});}
    catch{event.ports[0]?.postMessage({ready:false});}
  }else if(message?.type==='CANCEL_UPDATE'){preparation++;prepared=false;recoveryHooks?.cancel();}
  else if(message?.type==='RELOAD_UPDATE'&&prepared&&!reloading){
    try{
      if(sessionStorage.getItem('tetrp-update')===message.version){recoveryHooks?.cancel();return;}
      await recoveryHooks.prepare();sessionStorage.setItem('tetrp-update',message.version);reloading=true;location.reload();
    }catch{recoveryHooks?.cancel();}
  }
});
// Installation is optional; replay data never enters Cache Storage.
let promptEvent;
const install=document.getElementById('install-app');
const help=document.getElementById('install-help');
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
install.hidden=standalone();
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;});
window.addEventListener('appinstalled',()=>{promptEvent=null;install.hidden=true;help.close();});
install.addEventListener('click',async()=>{
  document.querySelector('.file-menu').open=false;
  if(promptEvent){const event=promptEvent;promptEvent=null;await event.prompt();await event.userChoice;}
  else help.showModal();
});
document.getElementById('close-install-help').addEventListener('click',()=>help.close());
if('serviceWorker' in navigator){
  let registration,checking=false;
  async function update(){
    if(!registration||checking||!navigator.onLine)return;
    checking=true;try{await registration.update();if(navigator.serviceWorker.controller&&registration.active?.state==='activated')registration.waiting?.postMessage({type:'REQUEST_UPDATE'});}catch{/* Offline: keep the complete cached version. */}finally{checking=false;}
  }
  window.addEventListener('online',update);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'})
      .then(value=>{
        registration=value;
        const activate=()=>{if(navigator.serviceWorker.controller&&registration.active?.state==='activated')registration.waiting?.postMessage({type:'REQUEST_UPDATE'});};
        registration.addEventListener('updatefound',()=>{const next=registration.installing;next?.addEventListener('statechange',()=>{if(next.state==='installed')activate();});});
        activate();return update();
      })
      .catch(()=>{document.getElementById('offline-note').textContent='離線準備未完成，請連線後重新開啟。';});
  });
}
