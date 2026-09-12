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
    checking=true;try{await registration.update();}catch{/* Offline: keep the complete cached version. */}finally{checking=false;}
  }
  window.addEventListener('online',update);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'})
      .then(value=>{registration=value;return update();})
      .catch(()=>{document.getElementById('offline-note').textContent='離線準備未完成，請連線後重新開啟。';});
  });
}
