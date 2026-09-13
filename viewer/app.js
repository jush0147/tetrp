import './pwa.js';
import {bindAutoStep} from './auto-step.js';
import {bindPlayModes,nextRound} from './play-modes.js';
import {boardModel,drawBoard,drawPreview} from './render.js';
import {PlaybackClock,displayStats,placementLabel,incomingGarbage,visibleGarbage} from './playback.js';
const $=id=>document.getElementById(id);
const playbackMode=bindPlayModes($('play-mode'),$('mode-menu'),$('mode-toast'),()=>{if(transitionTimer)finishRound();});
let transitionTimer=null,resumeRound=false;
const autoStep=bindAutoStep($('previous'),$('next-placement'),direction=>step(direction),()=>!!state&&!inflight);
const peer=$('focus-lane').cloneNode(true);peer.id='peer-lane';peer.setAttribute('aria-label','另一位玩家');
for(const node of peer.querySelectorAll('[id]'))node.id=`peer-${node.id}`;
$('boards').append(peer);
const garbageViews=new Map();
function fitGarbage(prefix){
  const g=garbageViews.get(prefix);if(!g)return;
  const panel=$(prefix+'garbage-panel'),list=$(prefix+'garbage-packets');
  const height=list.clientHeight;
  const visible=visibleGarbage(g.packets,height);
  list.replaceChildren(...visible.map(p=>{const row=document.createElement('div');row.className='garbage-packet';
    row.textContent=String(p.amount);row.classList.toggle('waiting',!p.active);
    row.title=p.active?'待入盤':'等待確認／抵達';return row;}));
  list.setAttribute('aria-label',`最早收到的在下方，另有 ${g.packets.length-visible.length} 筆未顯示`);
}
const garbageResize=new ResizeObserver(()=>{for(const prefix of garbageViews.keys())fitGarbage(prefix);});
for(const prefix of ['', 'peer-'])garbageResize.observe($(prefix+'garbage-panel'));
const clock=new PlaybackClock();
let worker=null,serial=0,active=0,rounds=[],state=null,total=0,frames=0,desired=0,roundFrame=0,playing=false,raf=null,inflight=false,scrubTimer=null,available=false,variant=null;
const request=(type,data={})=>{active=++serial;worker.postMessage({id:active,type,...data});return active;};
function stop(cancelAuto=true){clearTimeout(transitionTimer);transitionTimer=null;resumeRound=false;$('boards').classList.remove('round-transition');if(cancelAuto)autoStep.stop();if(playing)clock.pause(performance.now());playing=false;cancelAnimationFrame(raf);$('play').textContent='▶';$('play').setAttribute('aria-label','播放');$('play').title='播放';$('play').setAttribute('aria-pressed','false');}
function busy(message){stop();inflight=false;state=null;available=false;$('viewer').hidden=true;$('error').hidden=true;$('busy').textContent=message;$('busy').hidden=false;}
function showError(error){stop();inflight=false;state=null;$('viewer').hidden=true;$('busy').hidden=true;$('error').hidden=false;
  $('error-title').textContent=/UNSUPPORTED/.test(error.code||'')?'此 replay 暫不支援':'無法開啟 replay';
  $('error-message').textContent='請選擇其他 replay，或確認檔案是否完整。';
  $('error-detail').textContent=`${error.code||'ERROR'}${error.path?` · ${error.path}`:''}\n${error.message}`;
}
let swapped=false;
function renderPlayers(focus=Number($('player').value),frame=0){
  const round=rounds[Number($('round').value)];if(!round)return;
  const order=[...round.players].sort((a,b)=>Number(b.index===focus)-Number(a.index===focus));
  const host=$('player-tabs');
  if(host.dataset.left!==String(focus)||host.dataset.round!==String(round.index)){
    host.dataset.left=String(focus);host.dataset.round=String(round.index);
    const nodes=order.map(p=>{const label=document.createElement('span');label.className='player-tab';label.dataset.player=String(p.index);
      const name=document.createElement('span');name.className='player-name';name.textContent=p.name;
      const score=document.createElement('b');score.className='player-score';label.append(name,score);return label;});
    if(nodes.length===2){const swap=document.createElement('button');swap.type='button';swap.id='player-swap';swap.textContent='⇄';swap.setAttribute('aria-label','交換雙方位置');
      swap.addEventListener('click',()=>{swapped=!swapped;$('player').value=String(round.players[swapped?1:0].index);$('player').dispatchEvent(new Event('change'));});nodes.splice(1,0,swap);}
    host.replaceChildren(...nodes);
  }
  $('player-swap')?.setAttribute('aria-pressed',String(swapped));
  for(const label of host.querySelectorAll('.player-tab')){
    const p=round.players.find(p=>String(p.index)===label.dataset.player),score=frame>=round.scoreFrame?p.scoreAfter:p.scoreBefore;
    const badge=label.querySelector('.player-score');badge.hidden=variant!=='ttrm';badge.textContent=score==null?'—':String(score);
    badge.setAttribute('aria-label',`比分 ${score==null?'未確認':score}`);label.title=`${p.name} · ${score==null?'比分未確認':score}`;
  }
}
function fillPlayers(){const r=rounds[Number($('round').value)];$('player').replaceChildren(...r.players.map(p=>new Option(p.name,String(p.index))));
  $('player').value=String(r.players[swapped&&r.players.length>1?1:0].index);
  $('player-tabs').dataset.round='';renderPlayers();
}
function select(autoplay=false){clearTimeout(scrubTimer);busy('正在建立雙方時間軸…');resumeRound=autoplay;request('select',{round:Number($('round').value),player:Number($('player').value)});}
function load(file){
  if(!file)return;swapped=false;stop();clearTimeout(scrubTimer);worker?.terminate();
  $('welcome').hidden=true;$('workspace').hidden=false;$('selectors').hidden=true;busy('正在本機讀取 replay…');
  if(!/\.ttrm?$/i.test(file.name)){showError({message:'請選擇 .ttr 或 .ttrm 檔案。'});return;}
  try{worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});}catch(error){showError(error);return;}
  worker.onerror=()=>showError({message:'無法啟動 replay Worker，請使用新版瀏覽器。'});
  worker.onmessage=({data:m})=>{
    if(m.id!==active)return;
    if(m.type==='error'){showError(m.error);return;}
    if(m.type==='progress'){$('busy').textContent=`正在建立時間軸… ${m.value}%`;return;}
    if(m.type==='catalog'){
      variant=m.variant;document.body.dataset.variant=variant;
      rounds=m.rounds;$('round').replaceChildren(...rounds.map(r=>new Option(`Round ${r.index+1}`,String(r.index))));fillPlayers();$('stream-tools').hidden=false;$('stream-tools').classList.toggle('solo',variant==='ttr');$('selectors').hidden=variant==='ttr'||$('toggle-selectors').getAttribute('aria-expanded')==='false';select();return;
    }
    if(m.type==='ready'||m.type==='state'||m.type==='focused'){
      inflight=false;frames=m.roundFrames;available=m.views.some(v=>!v.error);
      $('busy').hidden=true;$('viewer').hidden=false;renderRound(m,m.type!=='state');
      if(m.type==='ready'&&resumeRound){resumeRound=false;if(available&&frames>0)startPlayback(0);}
      else if(playing&&m.frame>=frames)finishRound();
    }
  };
  request('load',{file});
}
function conformance(prefix,c){
  const el=id=>$(prefix+id);el('conformance').open=false;el('differences').replaceChildren();el('status-dot').classList.toggle('mismatch',Boolean(c.first));
  el('conformance').hidden=!c.first;
  el('status-text').textContent='終局比對有差異';
  el('coverage').textContent=c.boardAnchors?'已比對 replay 中可用的盤面與狀態紀錄。':'此 replay 沒有可比對的終局盤面，只比對可用計數。';
  if(c.first){const d=c.first,p=document.createElement('p');p.textContent=`觀測 frame ${d.firstObservedFrame} · placement ${d.placementIndex}。無法確定最早分歧 frame。`;el('differences').append(p);
    for(const diff of d.differences){const row=document.createElement('div');row.className='difference';const code=document.createElement('code');code.textContent=diff.field;const value=document.createElement('div');value.textContent=`Replay: ${JSON.stringify(diff.expected)} / 重建: ${JSON.stringify(diff.actual)}`;row.append(code,value);el('differences').append(row);}
  }
}
const number=(value,digits=0)=>value===null?'—':value.toFixed(digits);
function timeLabel(seconds){const ms=Math.floor(seconds*1000);return `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
function renderLane(prefix,view,initial){
  const el=id=>$(prefix+id);el('player-id').textContent=view.id;el('player-id').title=view.id;el('full-id').textContent=view.id;
  el('lane-display').hidden=Boolean(view.error);el('lane-error').hidden=!view.error;el('conformance').hidden=Boolean(view.error)||!view.conformance?.first;
  if(view.error){el('lane-error').textContent=`此 stream 暫不支援 · ${view.error.code}\n${view.error.message}`;return null;}
  const s=view.state,model=boardModel(s),stats=displayStats(s);
  drawBoard(el('board'),model);drawPreview(el('hold'),model.hold.piece);
  el('next').replaceChildren(...model.next.map(type=>{const c=document.createElement('canvas');c.setAttribute('role','img');drawPreview(c,type);return c;}));
  for(const key of ['pieces','lines','b2b','combo','attack'])el(key).textContent=number(stats[key]);
  el('lines').hidden=variant!=='ttr';el('lines-label').hidden=variant!=='ttr';
  const garbage=incomingGarbage(s);garbageViews.set(prefix,garbage);
  el('garbage-total').textContent=number(garbage.total);el('garbage-cap').textContent=garbage.cap===null?'':`入盤上限 ${garbage.cap}`;
  el('pps').textContent=number(stats.pps,2);el('apm').textContent=number(stats.apm,1);el('time').textContent=timeLabel(stats.time);el('frame').textContent=String(s.frame);
  el('app').textContent=number(stats.app,2);
  const label=placementLabel(view.lastPlacement);el('spin').textContent=label;el('spin').classList.toggle('is-spin',label.includes('SPIN'));
  el('spin').classList.toggle('is-quad',view.lastPlacement?.lines===4&&view.lastPlacement?.spin==='none');
  el('spin').hidden=label==='—';
  el('spin').classList.toggle('is-all-clear',Boolean(view.lastPlacement?.allClear));
  el('spin').dataset.piece=label.includes('SPIN')?view.lastPlacement.piece:'';
  const sent=s.attack?(view.lastPlacement?.sent??0):null;
  el('placement-sent').textContent=number(sent);
  el('placement-sent').setAttribute('aria-label',sent===null?'本次送出：未定義':`本次送出 ${sent} 行`);
  fitGarbage(prefix);
  if(initial)conformance(prefix,view.conformance);
  return model;
}
function renderRound(m,initial){
  roundFrame=m.frame;const primary=m.views.find(v=>v.player===m.focus),other=m.views.find(v=>v.player!==m.focus);
  renderPlayers(m.focus,m.frame);
  $('boards').classList.toggle('dual',Boolean(other));$('peer-lane').hidden=!other;
  const model=renderLane('',primary,initial);if(other)renderLane('peer-',other,initial);
  state=primary.state??null;total=primary.total??0;desired=state?.stats.pieces??0;
  $('scrubber').max=String(total);$('scrubber').value=String(desired);$('scrubber').disabled=!state;
  $('scrubber').setAttribute('aria-valuetext',state?`${desired} / ${total}`:'此玩家不支援');
  $('previous').disabled=!state||(desired===0&&!primary.navigationStop);$('next-placement').disabled=!state||desired>=total;$('play').disabled=!available;
  autoStep.check();
  $('position-status').textContent=`Frame ${roundFrame}${state?`，第 ${desired} / ${total} 顆`:''}`;
  $('playback-position').textContent=`${timeLabel(roundFrame/60)} / Piece ${desired}${primary.navigationStop?' · 垃圾入盤前':''}`;
  $('playback-position').title=`Frame ${roundFrame}`;
  document.dispatchEvent(new CustomEvent('tetrp:position',{detail:structuredClone({state,model,views:m.views,roundFrame})}));
}
function seek(kind,value,pause=true){
  if(!available||(kind==='placement'&&!state))return;if(pause)stop();clearTimeout(scrubTimer);
  if(!Number.isSafeInteger(value)||value<0||value>(kind==='frame'?frames:total))return;
  if(kind==='placement')desired=value;inflight=true;request('seek',{kind,value});
}
function step(direction){if(!state||inflight)return;stop(false);clearTimeout(scrubTimer);inflight=true;request('seek',{kind:'step',value:direction});}
function tick(now){
  if(!playing)return;
  const target=clock.target(now,frames);if(!inflight&&target>roundFrame)seek('frame',target,false);
  raf=requestAnimationFrame(tick);
}
function startPlayback(at){playing=true;clock.start(at,performance.now());$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','暫停');$('play').title='暫停';$('play').setAttribute('aria-pressed','true');raf=requestAnimationFrame(tick);}
function finishRound(){
  const next=nextRound(playbackMode(),Number($('round').value),rounds.length);stop();
  if(next===null)return;
  playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','暫停');$('play').setAttribute('aria-pressed','true');
  $('boards').dataset.transition=`Round ${next+1}`;$('boards').classList.add('round-transition');
  transitionTimer=setTimeout(()=>{$('round').value=String(next);fillPlayers();select(true);},500);
}
$('file').addEventListener('change',e=>{load(e.target.files[0]);e.target.value='';});
$('round').addEventListener('change',()=>{fillPlayers();select();});$('player').addEventListener('change',()=>{
  autoStep.stop();
  if(transitionTimer||resumeRound)stop();
  swapped=Number($('player').value)===rounds[Number($('round').value)].players[1]?.index;
  renderPlayers(Number($('player').value),roundFrame);
  if($('viewer').hidden){select();return;}
  clearTimeout(scrubTimer);inflight=true;request('focus',{player:Number($('player').value)});
});
$('scrubber').addEventListener('pointerdown',()=>{autoStep.stop();if(transitionTimer)stop();});
$('scrubber').addEventListener('input',e=>{stop();active=++serial;inflight=false;desired=Number(e.target.value);clearTimeout(scrubTimer);scrubTimer=setTimeout(()=>seek('placement',desired),45);});
$('scrubber').addEventListener('change',()=>seek('placement',desired));
$('play').addEventListener('click',()=>{autoStep.stop();if(playing){stop();return;}if(!available)return;
  const at=roundFrame>=frames?0:state?Math.max(roundFrame,state.frame+state.subframe):roundFrame;
  if(roundFrame>=frames)seek('frame',0);
  startPlayback(at);
});
for(const [buttonId,targetId,containerId,label] of [['toggle-selectors','selectors','topbar','頂欄'],['toggle-playback',null,'playback-tools','播放列']]){
  $(buttonId).addEventListener('click',()=>{
    const expanded=$(buttonId).getAttribute('aria-expanded')!=='true';
    $(buttonId).setAttribute('aria-expanded',String(expanded));$(buttonId).setAttribute('aria-label',`${expanded?'收合':'展開'}${label}`);
    $(buttonId).textContent=buttonId==='toggle-selectors'?(expanded?'⌃':'⌄'):(expanded?'⌄':'⌃');$(containerId).classList.toggle('collapsed',!expanded);
    (targetId?$(targetId):document.querySelector('.transport-body')).hidden=!expanded||(targetId==='selectors'&&variant==='ttr');
  });
}
$('speed').addEventListener('change',()=>clock.setSpeed(Number($('speed').value),performance.now()));
 document.addEventListener('keydown',e=>{if(!available||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,select,button,summary'))return;
  if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}if(e.code==='Space'){e.preventDefault();$('play').click();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',()=>worker?.terminate());
if(!('Worker'in window)){$('welcome').hidden=true;$('compatibility').hidden=false;}
