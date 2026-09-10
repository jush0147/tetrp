import {boardModel,drawBoard,drawPreview} from './render.js';
const $=id=>document.getElementById(id);
let worker=null,serial=0,active=0,rounds=[],state=null,total=0,frames=0,desired=0,playing=false,timer=null,scrubTimer=null;
const request=(type,data={})=>{active=++serial;worker.postMessage({id:active,type,...data});return active;};
function stop(){playing=false;clearTimeout(timer);$('play').textContent='播放';$('play').setAttribute('aria-pressed','false');}
function busy(message){stop();state=null;$('viewer').hidden=true;$('error').hidden=true;$('busy').textContent=message;$('busy').hidden=false;}
function showError(error){stop();state=null;$('viewer').hidden=true;$('busy').hidden=true;$('error').hidden=false;
  const unsupported=/UNSUPPORTED|UnknownBehavior/.test(error.code||'');
  $('error-title').textContent=unsupported?'此 stream 暫不支援':'無法開啟 replay';
  $('error-message').textContent=unsupported?'可選擇其他 round／player，或開啟另一份 replay。':'請確認檔案是完整的 .ttr 或 .ttrm，再重新開啟。';
  $('error-detail').textContent=`${error.code||'ERROR'}${error.path?` · ${error.path}`:''}\n${error.message}`;
}
function fillPlayers(){const r=rounds[Number($('round').value)];$('player').replaceChildren(...r.players.map(p=>new Option(p.name,String(p.index))));}
function select(){clearTimeout(scrubTimer);busy('正在建立逐顆時間軸…');request('select',{round:Number($('round').value),player:Number($('player').value)});}
function load(file){
  if(!file)return;stop();clearTimeout(scrubTimer);worker?.terminate();
  $('welcome').hidden=true;$('workspace').hidden=false;$('selectors').hidden=true;$('filename').textContent=file.name;
  busy('正在本機讀取 replay…');
  if(!/\.ttrm?$/i.test(file.name)){showError({message:'請選擇 .ttr 或 .ttrm 檔案。'});return;}
  try{worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});}
  catch(error){showError(error);return;}
  worker.onerror=()=>showError({message:'無法啟動 replay Worker。請重新整理或使用新版瀏覽器。'});
  worker.onmessage=({data:m})=>{
    if(m.id!==active)return;
    if(m.type==='error'){showError(m.error);return;}
    if(m.type==='progress'){$('busy').textContent=`正在建立逐顆時間軸… ${m.value}%`;return;}
    if(m.type==='catalog'){
      rounds=m.rounds;$('round').replaceChildren(...rounds.map(r=>new Option(`Round ${r.index+1}`,String(r.index))));fillPlayers();
      $('selectors').hidden=m.variant==='ttr';select();return;
    }
    if(m.type==='ready'){
      total=m.total;frames=m.frames;$('scrubber').max=String(total);$('placement-input').max=String(total);$('frame-input').max=String(frames);
      $('total').textContent=`/ ${total}`;$('frame-limit').textContent=`0 – ${frames} · 不含此 frame 內的事件`;
      showConformance(m.conformance);$('busy').hidden=true;$('viewer').hidden=false;desired=0;render(m.state);return;
    }
    if(m.type==='state'){render(m.state);if(playing){if(desired>=total)stop();else timer=setTimeout(()=>seek('placement',desired+1,false),350);}}
  };
  request('load',{file});
}
function showConformance(c){
  $('conformance').open=false;$('differences').replaceChildren();$('status-dot').classList.toggle('mismatch',Boolean(c.first));
  $('status-text').textContent=c.first?'終局比對有差異':c.fields.length?'未發現已知差異':'缺少可比對紀錄';
  $('coverage').textContent=c.boardAnchors?'已比對 replay 中可用的盤面與狀態紀錄。':'此 replay 沒有可比對的終局盤面，只比對可用計數。';
  $('uncertainty').textContent='比對點稀疏，不代表每個 frame 都已驗證。';
  if(c.first){const d=c.first;const p=document.createElement('p');p.textContent=`觀測 frame ${d.firstObservedFrame} · placement ${d.placementIndex}。無法從稀疏紀錄確定最早分歧 frame。`;$('differences').append(p);
    for(const diff of d.differences){const row=document.createElement('div');row.className='difference';const code=document.createElement('code');code.textContent=diff.field;const value=document.createElement('div');value.textContent=`Replay: ${JSON.stringify(diff.expected)} / 重建: ${JSON.stringify(diff.actual)}`;row.append(code,value);$('differences').append(row);}
  }
}
function render(nextState){state=nextState;const model=boardModel(state);drawBoard($('board'),model);drawPreview($('hold'),model.hold.piece);
  $('hold-lock').textContent=model.hold.locked?'鎖定':'';$('next').replaceChildren(...model.next.map(type=>{const c=document.createElement('canvas');c.setAttribute('role','img');drawPreview(c,type);return c;}));
  $('buffer-note').hidden=!model.above;drawPreview($('active-preview'),state.piece?.sleeping?null:model.type,model.rotation);
  $('lines').textContent=String(model.lines);$('pieces').textContent=String(model.placement);$('frame').textContent=String(model.frame);
  desired=model.placement;$('placement-input').value=String(desired);$('frame-input').value=String(model.frame);$('scrubber').value=String(desired);
  $('previous').disabled=desired===0;$('next-placement').disabled=desired>=total;$('play').disabled=total===0;
  $('position-status').textContent=`第 ${desired} / ${total} 顆，frame ${model.frame}`;
  // Detached display-only event: future consumers can observe; cannot mutate reconstruction.
  document.dispatchEvent(new CustomEvent('tetrp:position',{detail:structuredClone({state,model})}));
}
function seek(kind,value,pause=true){if(!state)return;if(pause)stop();clearTimeout(scrubTimer);
  const limit=kind==='frame'?frames:total;
  if(!Number.isSafeInteger(value)||value<0||value>limit)return;
  if(kind==='placement')desired=value;
  request('seek',{kind,value});
}
$('file').addEventListener('change',e=>{load(e.target.files[0]);e.target.value='';});
$('round').addEventListener('change',()=>{fillPlayers();select();});$('player').addEventListener('change',select);
$('previous').addEventListener('click',()=>seek('placement',Math.max(0,desired-1)));$('next-placement').addEventListener('click',()=>seek('placement',Math.min(total,desired+1)));
$('scrubber').addEventListener('input',e=>{stop();active=++serial;desired=Number(e.target.value);$('placement-input').value=String(desired);clearTimeout(scrubTimer);scrubTimer=setTimeout(()=>seek('placement',desired),45);});
$('scrubber').addEventListener('change',()=>seek('placement',desired));
$('placement-form').addEventListener('submit',e=>{e.preventDefault();seek('placement',Number($('placement-input').value));});
$('frame-form').addEventListener('submit',e=>{e.preventDefault();seek('frame',Number($('frame-input').value));});
$('play').addEventListener('click',()=>{if(playing){stop();return;}if(!state)return;playing=true;$('play').textContent='暫停';$('play').setAttribute('aria-pressed','true');seek('placement',desired>=total?0:desired+1,false);});
document.addEventListener('keydown',e=>{if(!state||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,select,button,summary'))return;
  if(e.key==='ArrowLeft'){e.preventDefault();seek('placement',Math.max(0,desired-1));}if(e.key==='ArrowRight'){e.preventDefault();seek('placement',Math.min(total,desired+1));}if(e.code==='Space'){e.preventDefault();$('play').click();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',()=>worker?.terminate());
if(!('Worker'in window)){$('welcome').hidden=true;$('compatibility').hidden=false;}
