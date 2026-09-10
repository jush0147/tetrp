import {MAX_FILE_BYTES,parseLocalText,catalog,ViewerSession} from './session.js';
let replay=null,session=null,epoch=0;
const send=(id,type,data)=>postMessage({id,type,...data});
self.onmessage=async ({data:m})=>{
  try {
    if(m.type==='load') {
      const generation=++epoch;session=null;replay=null;
      if(m.file.size>MAX_FILE_BYTES)throw new Error('檔案超過 32 MB，請選擇較小的 replay。');
      const text=await m.file.text();if(generation!==epoch)return;
      replay=parseLocalText(text);send(m.id,'catalog',{rounds:catalog(replay),variant:replay.variant});
    } else if(m.type==='select') {
      const generation=++epoch;session=null;
      if(!replay)throw new Error('請先開啟 replay。');
      const candidate=new ViewerSession(replay,m.round,m.player);
      const complete=await candidate.initialize({cancelled:()=>generation!==epoch,
        progress:value=>send(m.id,'progress',{value})});
      if(!complete||generation!==epoch)return;
      session=candidate;send(m.id,'ready',session.result());
    } else if(m.type==='seek') {
      if(!session)throw new Error('Replay 尚未準備完成。');
      const state=session.seek(m.kind,m.value);send(m.id,'state',{state});
    } else throw new Error('Unknown viewer command');
  } catch(error) {
    send(m.id,'error',{error:{code:error.code||'VIEWER_ERROR',path:error.path||null,message:error.message}});
  }
};
