import {MAX_FILE_BYTES,parseLocalText,catalog,ViewerSession} from './session.js';
let replay=null,sessions=[],epoch=0,focus=0,roundFrames=0;
const send=(id,type,data)=>postMessage({id,type,...data});
const errorData=error=>({code:error.code||'VIEWER_ERROR',path:error.path||null,message:error.message});
function snapshot(frame){return {focus,roundFrames,frame,views:sessions.map(s=>s.error?s:{player:s.player,id:s.id,...s.session.result()})};}
self.onmessage=async({data:m})=>{
  try{
    if(m.type==='load'){
      const generation=++epoch;sessions=[];replay=null;
      if(m.file.size>MAX_FILE_BYTES)throw new Error('檔案超過 32 MB，請選擇較小的 replay。');
      const text=await m.file.text();if(generation!==epoch)return;
      replay=parseLocalText(text);send(m.id,'catalog',{rounds:catalog(replay),variant:replay.variant});
    }else if(m.type==='select'){
      const generation=++epoch;sessions=[];focus=m.player;
      if(!replay)throw new Error('請先開啟 replay。');
      const entries=catalog(replay)[m.round].players,next=[];
      if(entries.length>2)throw Object.assign(new Error('此 viewer 尚不支援超過兩位玩家的 round。'),{code:'UNSUPPORTED_VIEWER_ROUND'});
      for(const entry of entries){
        try{
          const candidate=new ViewerSession(replay,m.round,entry.index);
          const complete=await candidate.initialize({cancelled:()=>generation!==epoch,
            progress:value=>send(m.id,'progress',{value:Math.floor((next.length*100+value)/entries.length)})});
          if(!complete||generation!==epoch)return;
          next.push({player:entry.index,id:entry.name,session:candidate});
        }catch(error){next.push({player:entry.index,id:entry.name,error:errorData(error)});}
      }
      if(generation!==epoch)return;sessions=next;
      roundFrames=Math.max(0,...sessions.filter(s=>s.session).map(s=>s.session.frames));
      send(m.id,'ready',snapshot(0));
    }else if(m.type==='seek'){
      if(!sessions.length)throw new Error('Replay 尚未準備完成。');
      let frame=m.value;
      if(m.kind==='placement'){
        const primary=sessions.find(s=>s.player===focus);
        if(!primary?.session)throw new Error('請選擇支援的玩家以逐塊操作。');
        frame=primary.session.seek('placement',m.value).frame;
        for(const other of sessions)if(other.session&&other!==primary)other.session.seek('frame',Math.min(frame,other.session.frames));
      }else if(m.kind==='frame'){
        if(!Number.isSafeInteger(frame)||frame<0||frame>roundFrames)throw new RangeError('Frame 超出 round 範圍。');
        for(const s of sessions)if(s.session)s.session.seek('frame',Math.min(frame,s.session.frames));
      }else throw new Error('Unknown seek kind');
      send(m.id,'state',snapshot(frame));
    }else throw new Error('Unknown viewer command');
  }catch(error){send(m.id,'error',{error:errorData(error)});}
};
