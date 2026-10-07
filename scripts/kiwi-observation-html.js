// Pure recording viewer: renders authority snapshots, never simulates inputs.
export function observationHtml(replay,report){
 const data=JSON.stringify({replay,score:report.score,complete:report.complete}).replaceAll('<','\\u003c');
 return String.raw`<!doctype html><meta charset="utf-8"><title>Kiwi FT7 observation</title>
<style>body{background:#141820;color:#eee;font:16px system-ui;max-width:900px;margin:24px auto}button,select,input{font:inherit;margin:6px}canvas{background:#090b10}#boards{display:flex;gap:32px}h2{font-size:18px}#time{width:90%}pre{white-space:pre-wrap}</style>
<h1>Aligned Kiwi vs Tetrp Kiwi</h1><p>Authority placement recording · 24 frames/placement · not a physical-input TTRM</p>
<p id="score"></p><select id="round"></select><button id="prev">◀</button><button id="play">播放／暫停</button><button id="next">▶</button><button id="skim">下一個斷 B2B clear</button>
<label><input id="landing" type="checkbox">顯示上一手落點（消行前）</label><div id="boards"><section><h2 id="n0"></h2><canvas id="c0" width="240" height="480"></canvas><pre id="s0"></pre></section><section><h2 id="n1"></h2><canvas id="c1" width="240" height="480"></canvas><pre id="s1"></pre></section></div>
<input id="time" type="range" min="0" value="0"><p id="info"></p>
<script>const data=${data};const $=id=>document.getElementById(id);let ri=0,fi=0,timer;
const colors={i:'#4cc9dc',o:'#edca4b',t:'#ab65d5',s:'#69bf68',z:'#e86666',j:'#587acb',l:'#eaa058',gb:'#9299a6'};
data.replay.games.forEach((g,i)=>{const o=document.createElement('option');o.value=i;o.textContent='Round '+g.round;$('round').append(o)});
$('score').textContent='Aligned '+data.score[0]+' — '+data.score[1]+' Tetrp vendored'+(data.complete?'':' (partial)');
function draw(){const g=data.replay.games[ri];if(!g||!g.frames.length)return;fi=Math.min(fi,g.frames.length-1);const f=g.frames[fi];$('time').max=g.frames.length-1;$('time').value=fi;
for(let seat=0;seat<2;seat++){const s=f.seats[seat];if(!s)continue;$('n'+seat).textContent=data.replay.names[g.swapped?1-seat:seat];const c=$('c'+seat).getContext('2d');c.clearRect(0,0,240,480);const rows=($('landing').checked&&s.last?s.last.board:s.board).slice(-20);for(let y=0;y<rows.length;y++)for(let x=0;x<10;x++){const v=rows[y][x];c.fillStyle=v?(colors[String(v).toLowerCase()]||'#adb5bd'):'#171c25';c.fillRect(x*24,y*24,23,23)}if($('landing').checked&&s.last){c.fillStyle=colors[s.last.piece]||'#fff';for(const [x,y] of s.last.cells)if(y>=20)c.fillRect(x*24,(y-20)*24,23,23)}$('s'+seat).textContent='Pieces '+s.pieces+' | B2B '+s.btb+' | combo '+s.combo+'\nHold '+(s.hold.piece??'—')+' | NEXT '+s.next.join(' ').toUpperCase()+(s.playing?'':'\nKO / ended');}
const marks=g.skims.filter(s=>s.frame===f.frame-1);$('info').textContent='Frame '+f.frame+' · '+(f.frame/60).toFixed(2)+' s · '+(marks.map(s=>'Seat '+(s.seat+1)+' ordinary '+s.lines+' clear; B2B before '+s.btbBefore).join('; ')||'')+' · '+(g.result?'round score '+g.result.score.join(':'):'');}
$('landing').onchange=draw;$('round').onchange=e=>{ri=Number(e.target.value);fi=0;draw()};$('time').oninput=e=>{fi=Number(e.target.value);draw()};$('prev').onclick=()=>{fi=Math.max(0,fi-1);draw()};$('next').onclick=()=>{fi++;draw()};$('play').onclick=()=>{if(timer){clearInterval(timer);timer=null}else timer=setInterval(()=>{const g=data.replay.games[ri];if(fi>=g.frames.length-1){clearInterval(timer);timer=null;return}fi++;draw()},400)};
$('skim').onclick=()=>{const g=data.replay.games[ri],f=g.frames[fi].frame,m=g.skims.find(s=>s.frame>=f);if(m){fi=g.frames.findIndex(s=>s.frame>m.frame);draw()}};draw();</script>`;
}
