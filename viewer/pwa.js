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
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'})
      .catch(()=>{document.getElementById('offline-note').textContent='離線準備未完成，請連線後重新開啟。';});
  });
}
