import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {parseReplay,selectPlayer,prepareReplay,Reconstruction} from '../src/replay/index.js';
import {boardModel,palette} from '../viewer/render.js';
const synthetic=()=>({version:1,gamemode:'40l',replay:{frames:90,options:{version:15,seed:42,handling:{safelock:false}},events:[
  {frame:0,type:'start',data:{}},...Array.from({length:6},(_,i)=>[{frame:i*12+1,type:'keydown',data:{key:'hardDrop',subframe:.2}},
    {frame:i*12+2,type:'keyup',data:{key:'hardDrop',subframe:.4}}]).flat(),{frame:90,type:'end',data:{reason:'clear'}}]}});
test.beforeEach(async({page})=>{await page.addInitScript(()=>document.addEventListener('tetrp:position',e=>{window.observedPosition=e.detail;}));await page.goto('./');});
async function upload(page,object){
  await page.locator('#file').setInputFiles({name:'synthetic.ttr',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(object))});
  await expect(page.locator('#viewer')).toBeVisible();
  if(await page.locator('#play').getAttribute('aria-pressed')==='true')await page.locator('#play').click();
  if(await page.locator('#scrubber').isEnabled())await placement(page,0);
}
test('portrait cold reload fits a visual viewport smaller than the initial layout viewport',async({page})=>{
  await page.setViewportSize({width:384,height:832});
  await page.addInitScript(()=>{
    window.visibleTestHeight=740;
    Object.defineProperty(window.visualViewport,'height',{get:()=>window.visibleTestHeight});
  });
  await page.reload();
  async function fits(){
    await expect.poll(()=>page.locator('body').evaluate(el=>el.getBoundingClientRect().height)).toBe(740);
    for(const id of ['board','playback-tools','previous','play','next-placement','speed','play-mode']){
      const box=await page.locator('#'+id).boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(740);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  }
  await fits();await page.reload();await fits();
  await upload(page,synthetic());await fits();
  await page.evaluate(()=>{window.visibleTestHeight=700;visualViewport.dispatchEvent(new Event('resize'));});
  await expect.poll(()=>page.locator('body').evaluate(el=>el.getBoundingClientRect().height)).toBe(700);
  const controls=await page.locator('#playback-tools').boundingBox();expect(controls.y+controls.height).toBeLessThanOrEqual(700);
  await page.evaluate(()=>{window.visibleTestHeight=740;window.dispatchEvent(new Event('pageshow'));});await fits();
});
test('empty viewer is responsive and file selection starts playback',async({page})=>{
  await expect(page.locator('#board')).toBeVisible();await expect(page.locator('#open-empty')).toBeVisible();
  await expect(page.locator('#pieces')).toHaveText('—');await expect(page.locator('#play')).toBeDisabled();
  await expect(page.locator('#speed')).toBeDisabled();await expect(page.locator('#round')).toBeDisabled();
  for(const size of [{width:390,height:664},{width:844,height:390}]){
    await page.setViewportSize(size);expect(await page.locator('#peer-lane').isVisible()).toBe(size.width>size.height);
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  }
  const chooser=page.waitForEvent('filechooser');await page.locator('#open-empty').click();
  const replay=synthetic();replay.replay.frames=600;replay.replay.events.at(-1).frame=600;
  await (await chooser).setFiles({name:'demo.ttr',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replay))});
  await expect(page.locator('#welcome')).toBeHidden();await expect(page.locator('#play')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#boards')).not.toHaveClass(/dual/);
  await expect.poll(()=>page.evaluate(()=>window.observedPosition?.roundFrame??0)).toBeGreaterThan(0);
  const player=name=>({id:name,username:name,replay:{...replay.replay,options:{version:19,seed:42,handling:{safelock:false}}}});
  await page.locator('#file').setInputFiles({name:'demo.ttrm',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,gamemode:'league',replay:{rounds:[[player('a'),player('b')]]}}))});
  await expect(page.locator('#boards')).toHaveClass(/dual/);await expect(page.locator('#play')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#round')).toHaveValue('0');
});
test('scrubbing preserves playback, compact pickers and outside menu dismissal',async({page})=>{
  const replay=synthetic();replay.replay.frames=600;replay.replay.events.at(-1).frame=600;
  await upload(page,replay);await expect(page.locator('#viewer')).toBeVisible();
  const scrub=page.locator('#scrubber'),play=page.locator('#play');
  async function drag(){const b=await scrub.boundingBox();await page.mouse.move(b.x+b.width*.3,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width*.6,b.y+b.height/2,{steps:4});await page.mouse.up();}
  await drag();await expect(play).toHaveAttribute('aria-pressed','false');
  await play.click();await drag();await expect(play).toHaveAttribute('aria-pressed','true');
  const frame=await page.evaluate(()=>window.observedPosition.roundFrame);await expect.poll(()=>page.evaluate(()=>window.observedPosition.roundFrame)).toBeGreaterThan(frame);
  await play.click();await drag();await expect(play).toHaveAttribute('aria-pressed','false');
  async function hold(id){const b=await page.locator(id).boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(500);await page.mouse.up();}
  await page.locator('#speed').click();await expect(page.locator('#speed')).toHaveText('1.5×');
  await hold('#speed');await expect(page.locator('#speed-menu')).toBeVisible();await expect(page.locator('#speed')).toHaveText('1.5×');
  await page.getByRole('menuitemradio',{name:'0.5×',exact:true}).click();await expect(page.locator('#speed')).toHaveText('0.5×');
  await hold('#play-mode');await expect(page.locator('#mode-menu svg')).toHaveCount(4);
  expect(await page.locator('#mode-menu').textContent()).toBe('');
  await page.getByRole('menuitemradio',{name:'Repeat Round',exact:true}).click();await expect(page.locator('#play-mode')).toHaveAttribute('data-mode','3');
  await page.locator('.file-menu summary').click();await expect(page.locator('.file-menu')).toHaveAttribute('open','');
  await page.locator('#board').click();await expect(page.locator('.file-menu')).not.toHaveAttribute('open','');
});
test('round transition aligns WIN LOSE and score changes with swapped sides',async({page})=>{
  const player=(id,reason)=>({id,username:id,replay:{...synthetic().replay,options:{version:19,seed:42,handling:{safelock:false}},results:{gameoverreason:reason}}});
  await upload(page,{version:1,gamemode:'league',replay:{rounds:[
    [player('Alpha','winner'),player('Beta','topout')],[player('Alpha','topout'),player('Beta','winner')],
  ]}});await expect(page.locator('#viewer')).toBeVisible();
  await page.locator('#player-swap').click();await page.locator('#play-mode').click();await page.locator('#play').click();
  await expect(page.locator('#round-result')).toBeVisible();
  await expect(page.locator('.result-name')).toHaveText(['Beta','Alpha']);
  await expect(page.locator('.result-outcome')).toHaveText(['LOSE','WIN']);
  await expect(page.locator('.result-score')).toHaveText(['0 → 0','0 → 1']);
  await expect(page.locator('#round')).toHaveValue('1');await expect(page.locator('.player-name')).toHaveText(['Beta','Alpha']);
  await page.locator('#play').click();await page.locator('#play-mode').click();await page.locator('#play').click();
  await expect(page.locator('#round-result')).toBeVisible();await expect(page.locator('.result-outcome')).toHaveText(['WIN','LOSE']);
  await expect(page.locator('.result-score')).toHaveText(['0 → 1','1 → 1']);
  await page.locator('#play').click();await expect(page.locator('#round-result')).toBeHidden();
  await page.waitForTimeout(1300);await expect(page.locator('#round')).toHaveValue('1');
});
test('playback modes cycle, select by hold, transition and retain speed',async({page})=>{
  const player=name=>{const replay=synthetic().replay;replay.options.version=19;return {id:name,username:name,replay};};
  await upload(page,{version:1,gamemode:'league',replay:{rounds:[[player('a'),player('b')],[player('a'),player('b')]]}});
  await expect(page.locator('#viewer')).toBeVisible();const mode=page.locator('#play-mode'),play=page.locator('#play');
  await expect(mode).toHaveAttribute('data-mode','0');
  await page.locator('#speed').click();
  await play.click();await expect(play).toHaveAttribute('aria-pressed','false');await expect(page.locator('#round')).toHaveValue('0');
  await mode.click();await expect(page.locator('#mode-toast')).toHaveText('Continuous');
  await play.click();await expect(page.locator('#boards')).toHaveClass(/round-transition/);
  await expect(page.locator('#round')).toHaveValue('1');await expect(page.locator('#speed')).toHaveText('1.5×');
  await expect(play).toHaveAttribute('aria-pressed','false');await expect(mode).toHaveAttribute('data-mode','1');
  await mode.click();await play.click();await expect(page.locator('#round')).toHaveValue('0');
  await expect(play).toHaveAttribute('aria-pressed','true');await play.click();await expect(mode).toHaveAttribute('data-mode','2');
  await mode.click();await expect(page.locator('#mode-toast')).toHaveText('Repeat Round');
  await page.locator('#round').selectOption('1');await expect(page.locator('#viewer')).toBeVisible();await placement(page,3);
  await expect(mode).toHaveAttribute('data-mode','3');await play.click();
  await expect(page.locator('#boards')).toHaveClass(/round-transition/);await expect(page.locator('#boards')).not.toHaveClass(/round-transition/);
  await expect(page.locator('#round')).toHaveValue('1');await expect(play).toHaveAttribute('aria-pressed','true');await play.click();
  await mode.click();await expect(mode).toHaveAttribute('data-mode','0');
  const box=await mode.boundingBox();await page.mouse.move(box.x+22,box.y+22);await page.mouse.down();await page.waitForTimeout(500);await page.mouse.up();
  await expect(page.locator('#mode-menu')).toBeVisible();await expect(mode).toHaveAttribute('data-mode','0');
  await page.getByRole('menuitemradio',{name:'Repeat All',exact:true}).click();await expect(mode).toHaveAttribute('data-mode','2');
  await placement(page,6);await expect(play).toHaveAttribute('aria-pressed','false');await expect(page.locator('#round')).toHaveValue('1');
  await page.setViewportSize({width:667,height:280});expect((await page.locator('#playback-tools').boundingBox()).height).toBe(50);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('long press latches one-second steps, direction switching and cancellation',async({page})=>{
  await upload(page,synthetic());await expect(page.locator('#viewer')).toBeVisible();
  const next=page.locator('#next-placement'),previous=page.locator('#previous');
  async function hold(button){const box=await button.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(500);await page.mouse.up();}
  await next.click();await expect(page.locator('#pieces')).toHaveText('1');await expect(next).toHaveAttribute('aria-pressed','false');
  await hold(next);await expect(next).toHaveAttribute('aria-pressed','true');await expect(page.locator('#pieces')).toHaveText('2');
  await expect(page.locator('#pieces')).toHaveText('3');
  await next.click();await expect(next).toHaveAttribute('aria-pressed','false');await page.waitForTimeout(1100);await expect(page.locator('#pieces')).toHaveText('3');
  await hold(next);await expect(page.locator('#pieces')).toHaveText('4');await previous.click();
  await expect(previous).toHaveAttribute('aria-pressed','true');await expect(next).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#pieces')).toHaveText('3');
  await page.locator('#scrubber').dispatchEvent('pointerdown');await expect(previous).toHaveAttribute('aria-pressed','false');
  await placement(page,5);await hold(next);await expect(page.locator('#pieces')).toHaveText('6');await expect(next).toHaveAttribute('aria-pressed','false');
  await placement(page,1);await hold(previous);await expect(page.locator('#pieces')).toHaveText('0');await expect(previous).toHaveAttribute('aria-pressed','false');
  await hold(next);await page.locator('#play').click();await expect(next).toHaveAttribute('aria-pressed','false');
  const player=name=>{const replay=synthetic().replay;replay.options.version=19;return {id:name,username:name,replay};};
  await upload(page,{version:1,gamemode:'league',replay:{rounds:[[player('a'),player('b')],[player('a'),player('b')]]}});
  await expect(page.locator('#viewer')).toBeVisible();await hold(next);await page.locator('#player-swap').click();
  await expect(next).toHaveAttribute('aria-pressed','false');await expect(page.locator('#player-id')).toHaveText('b');
  await hold(next);await page.locator('#round').selectOption('1');await expect(next).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#viewer')).toBeVisible();const stopped=await page.locator('#pieces').textContent();
  await page.waitForTimeout(1100);await expect(page.locator('#pieces')).toHaveText(stopped);
});
async function choosePlayer(page,index){if(await page.locator('#player').inputValue()!==String(index))await page.locator('#player-swap').evaluate(el=>el.click());}
async function placement(page,n){await page.locator('#scrubber').evaluate((el,n)=>{el.value=String(n);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},n);await expect(page.locator('#pieces')).toHaveText(String(n));}
async function consistent(page,reference,n){await placement(page,n);const expected=reference.seekPlacement(n);
  await expect.poll(()=>page.evaluate(()=>window.observedPosition?.state)).toEqual(expected);
  expect(await page.evaluate(()=>window.observedPosition.model)).toEqual(boardModel(expected));
  await expect(page.locator('#next canvas')).toHaveCount(expected.rules.nextcount);
  await expect(page.locator('#hold')).toHaveAttribute('aria-label',expected.hold.piece?.toUpperCase()||'空');
  expect(await page.locator('#next canvas').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')))).toEqual(expected.bag.queue.slice(0,expected.rules.nextcount).map(t=>t.toUpperCase()));
  const model=boardModel(expected),active=new Set(model.displayActive.map(([x,y])=>`${x},${y}`));
  const colors=model.rows.flatMap((row,y)=>row.map((type,x)=>palette[active.has(`${x},${y}`)?model.type:type]||'#10191f'));
  const pixels=await page.locator('#board').evaluate(c=>{const ctx=c.getContext('2d'),out=[];for(let y=0;y<20;y++)for(let x=0;x<10;x++){
    const p=ctx.getImageData(x*30+15,y*30+15,1,1).data;out.push('#'+[...p].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join(''));}return out;});
  expect(pixels).toEqual(colors);
}
test('local open, scrubber navigation, playback and refresh',async({page})=>{
  const external=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&(r.method()!=='GET'||!r.url().startsWith('http://127.0.0.1:4173/')))external.push(r.url());});
  const x=synthetic();await upload(page,x);await expect(page.locator('#viewer')).toBeVisible();
  const reference=new Reconstruction(prepareReplay(selectPlayer(parseReplay(JSON.stringify(x)))));
  for(const n of [0,3,6,3,0])await consistent(page,reference,n);
  await page.locator('#next-placement').click();await expect(page.locator('#pieces')).toHaveText('1');
  await page.locator('#previous').click();await expect(page.locator('#pieces')).toHaveText('0');
  await expect(page.locator('#frame-form')).toHaveCount(0);await expect(page.locator('#placement-form')).toHaveCount(0);
  await page.locator('#play').click();await expect(page.locator('#pieces')).toHaveText('6');await expect(page.locator('#play')).toHaveAttribute('aria-pressed','false');
  expect(external).toEqual([]);await page.reload();await expect(page.locator('#welcome')).toBeVisible();await upload(page,x);await expect(page.locator('#pieces')).toHaveText('0');
});

test('orientation preserves both timelines, player IDs and frame-clock speeds',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const make=id=>{const s=synthetic().replay;s.options.version=19;s.frames=600;s.events.at(-1).frame=600;return {id:`opaque-${id}`,username:id,replay:s};};
  const x={version:1,gamemode:'league',replay:{rounds:[[make('player-alpha'),make('player-beta')]]}};
  await upload(page,x);await expect(page.locator('#viewer')).toBeVisible();
  await page.setViewportSize({width:390,height:844});await expect(page.locator('#peer-lane')).toBeHidden();
  await placement(page,3);const before=await page.evaluate(()=>window.observedPosition);
  await choosePlayer(page,'1');await expect(page.locator('#player-id')).toHaveText('player-beta');
  expect(await page.evaluate(()=>window.observedPosition.roundFrame)).toBe(before.roundFrame);
  expect(await page.evaluate(()=>window.observedPosition.state)).toEqual(before.views[1].state);
  await choosePlayer(page,'0');await expect(page.locator('#player-id')).toHaveText('player-alpha');
  expect(await page.evaluate(()=>window.observedPosition.state)).toEqual(before.state);
  await page.setViewportSize({width:844,height:390});await expect(page.locator('#peer-board')).toBeVisible();
  await expect(page.locator('#player-id')).toHaveText('player-alpha');await expect(page.locator('#peer-player-id')).toHaveText('player-beta');
  for(const prefix of ['', 'peer-']){
    const b=await page.locator(`#${prefix}board`).boundingBox(),h=await page.locator(`#${prefix}hold`).boundingBox(),n=await page.locator(`#${prefix}next`).boundingBox();
    expect(h.x+h.width).toBeLessThan(b.x);expect(n.x).toBeGreaterThan(b.x+b.width);
    expect(Math.abs(b.height/b.width-2)).toBeLessThan(.03);
    expect((await page.locator(`#${prefix}garbage-packets`).boundingBox()).height).toBeGreaterThanOrEqual(24);
    await expect(page.locator(`#${prefix}lines`)).toBeHidden();
    const stats=await page.locator(`#${prefix}apm`).boundingBox();expect(stats.y).toBeGreaterThanOrEqual(b.y+b.height);
  }
  const ref=new Reconstruction(prepareReplay(selectPlayer(parseReplay(JSON.stringify(x)),0,1)));
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  for(const speed of ['0.5','1','1.5']){
    await placement(page,0);await expect.poll(()=>page.evaluate(()=>window.observedPosition?.roundFrame)).toBe(0);
    while(await page.locator('#speed').textContent()!==speed+'×')await page.locator('#speed').click();
    // Browser clock controls rAF/performance without relying on CI wall-clock speed.
    await page.evaluate(()=>document.getElementById('play').click());await page.clock.runFor(500);
    await choosePlayer(page,'1');await expect(page.locator('#player-id')).toHaveText('player-beta');
    await expect(page.locator('#play')).toHaveAttribute('aria-pressed','true');await page.clock.runFor(500);
    await page.evaluate(()=>document.getElementById('play').click());
    const pos=await page.evaluate(()=>window.observedPosition);
    expect(pos.roundFrame).toBeGreaterThanOrEqual(Number(speed)*60-5);
    expect(pos.roundFrame).toBeLessThanOrEqual(Number(speed)*60+5);
    expect(pos.views[1].state).toEqual(ref.seekFrame(pos.roundFrame));
    expect(pos.views[0].state.frame).toBe(pos.views[1].state.frame);
  }
  const stateBeforeCollapse=await page.evaluate(()=>window.observedPosition.state),oldBoard=await page.locator('#board').boundingBox();
  await page.locator('#toggle-selectors').click();await page.locator('#toggle-playback').click();
  await expect(page.locator('#player-tabs')).toBeHidden();await expect(page.locator('#scrubber')).toBeHidden();
  expect((await page.locator('#board').boundingBox()).height).toBeGreaterThan(oldBoard.height);
  expect(await page.evaluate(()=>window.observedPosition.state)).toEqual(stateBeforeCollapse);
  await page.locator('#toggle-selectors').click();await page.locator('#toggle-playback').click();
  await expect(page.locator('#player-tabs')).toBeVisible();await expect(page.locator('#scrubber')).toBeVisible();
  expect(errors).toEqual([]);
});
test('manual next pauses once before unseen garbage intake; scrubber remains placement based',async({page})=>{
  const stream={frames:80,options:{version:19,seed:42,handling:{safelock:false}},events:[
    {frame:0,type:'start',data:{}},
    {frame:0,type:'ige',data:{id:10,frame:0,type:'target',data:{targets:[101]}}},
    {frame:1,type:'keydown',data:{key:'hardDrop',subframe:.2}},{frame:2,type:'keyup',data:{key:'hardDrop',subframe:.2}},
    ...['interaction','interaction_confirm'].map((type,i)=>({frame:5,type:'ige',data:{id:i,frame:5,type,data:{type:'garbage',amt:3,gameid:101,frame:5,cid:1,iid:1,ackiid:0}}})),
    {frame:40,type:'keydown',data:{key:'hardDrop',subframe:.2}},{frame:41,type:'keyup',data:{key:'hardDrop',subframe:.2}},
    {frame:80,type:'end',data:{reason:'clear'}}]};
  await upload(page,{version:1,gamemode:'league',replay:{rounds:[[{id:'alpha',username:'Alpha',replay:stream}]]}});
  await expect(page.locator('#viewer')).toBeVisible();await placement(page,1);
  await page.locator('#next-placement').click();
  await expect(page.locator('#playback-position')).toContainText('垃圾入盤前');
  await expect(page.locator('#pieces')).toHaveText('1');await expect(page.locator('#garbage-total')).toHaveText('3');
  const paused=await page.evaluate(()=>window.observedPosition.state);
  await page.locator('#next-placement').click();await expect(page.locator('#pieces')).toHaveText('2');
  await expect(page.locator('#garbage-total')).toHaveText('0');
  const completed=await page.evaluate(()=>window.observedPosition.state);
  await page.locator('#previous').click();await expect(page.locator('#playback-position')).toContainText('垃圾入盤前');
  expect(await page.evaluate(()=>window.observedPosition.state)).toEqual(paused);
  await page.locator('#previous').click();await expect(page.locator('#playback-position')).not.toContainText('垃圾入盤前');
  await placement(page,2);expect(await page.evaluate(()=>window.observedPosition.state)).toEqual(completed);
});

test('swap aligns IDs and boards across rounds, FT follows progress, and header collapses completely',async({page})=>{
  const player=(id,reason)=>({id,username:id,replay:{...synthetic().replay,options:{version:19,seed:42,handling:{safelock:false}},results:{gameoverreason:reason}}});
  await page.setViewportSize({width:844,height:390});
  await upload(page,{version:1,gamemode:'league',replay:{rounds:[
    [player('Alpha','winner'),player('Beta','topout')],[player('Alpha','topout'),player('Beta','winner')],
  ]}});await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('.player-name')).toHaveText(['Alpha','Beta']);
  await expect(page.locator('.player-score')).toHaveText(['0','0']);
  await page.locator('#player-swap').click();await expect(page.locator('#player-swap')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.player-name')).toHaveText(['Beta','Alpha']);await expect(page.locator('#player-id')).toHaveText('Beta');
  await expect(page.locator('.player-tab[aria-pressed]')).toHaveCount(0);
  await page.locator('#round').selectOption('1');await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#player-id')).toHaveText('Beta');await expect(page.locator('.player-name')).toHaveText(['Beta','Alpha']);
  await expect(page.locator('.player-score')).toHaveText(['0','1']);await expect(page.locator('#player-swap')).toHaveAttribute('aria-pressed','true');
  await page.locator('#play').click();await expect(page.locator('#play')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.player-score')).toHaveText(['1','1']);
  await placement(page,0);await expect(page.locator('.player-score')).toHaveText(['0','1']);
  const before=await page.locator('#board').boundingBox();await page.locator('#toggle-selectors').click();
  await expect(page.locator('#toggle-selectors')).toHaveText('⌄');
  await expect(page.locator('.brand')).toBeHidden();await expect(page.locator('.file-menu')).toBeHidden();
  expect((await page.locator('#topbar').boundingBox()).height).toBe(0);
  expect((await page.locator('#board').boundingBox()).height).toBeGreaterThanOrEqual(before.height+40);
  await page.setViewportSize({width:390,height:664});
  await expect(page.locator('.brand')).toBeVisible();await expect(page.locator('.file-menu')).toBeVisible();
  await expect(page.locator('#selectors')).toBeHidden();
  expect((await page.locator('#topbar').boundingBox()).height).toBe(44);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await page.setViewportSize({width:844,height:390});
  await expect(page.locator('.brand')).toBeHidden();expect((await page.locator('#topbar').boundingBox()).height).toBe(0);
  await page.locator('#toggle-selectors').click();await expect(page.locator('.brand')).toBeVisible();
  await expect(page.locator('#toggle-selectors')).toHaveText('⌃');
  await expect(page.locator('.player-name')).toHaveText(['Beta','Alpha']);
});

test('malformed file and responsive touch targets',async({page})=>{
  await page.locator('#file').setInputFiles({name:'broken.ttr',mimeType:'text/plain',buffer:Buffer.from('{')});
  await expect(page.locator('#error')).toBeVisible();await expect(page.locator('#error-detail')).toContainText('MALFORMED_JSON');
  await upload(page,synthetic());await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#lines')).toBeVisible();await expect(page.locator('#conformance')).toBeHidden();
  expect((await page.locator('.transport').boundingBox()).height).toBeLessThanOrEqual(140);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const id of ['previous','next-placement','play']){const b=await page.locator(`#${id}`).boundingBox();expect(b.height).toBeGreaterThanOrEqual(44);expect(b.width).toBeGreaterThanOrEqual(44);}
  const board=await page.locator('#board').boundingBox();expect(Math.abs(board.height/board.width-2)).toBeLessThan(.03);
});
test('selection races preserve the latest stream and unsupported retry is visible',async({page})=>{
  const make=(retry=false)=>{const s=synthetic().replay;s.options.version=19;if(retry)s.events.splice(1,0,{frame:0,type:'keydown',data:{key:'retry',subframe:0}});return {replay:s};};
  const x={version:1,gamemode:'league',replay:{rounds:[[make(),make(true)],[make()]]}};
  await upload(page,x);await expect(page.locator('#viewer')).toBeVisible();await placement(page,3);
  await choosePlayer(page,'1');await expect(page.locator('#lane-error')).toContainText('此 stream 暫不支援');await expect(page.locator('#lane-error')).toContainText('retry');
  await page.locator('#round').selectOption('1');await expect(page.locator('#pieces')).toHaveText('0');await expect(page.locator('#viewer')).toBeVisible();
  await page.locator('#round').selectOption('0');await choosePlayer(page,'1');await choosePlayer(page,'0');
  await expect(page.locator('#viewer')).toBeVisible();await expect(page.locator('#pieces')).toHaveText('0');
});
test('native scrubber interaction and compact portrait controls',async({page},testInfo)=>{
  await page.setViewportSize({width:360,height:640});await upload(page,synthetic());await expect(page.locator('#viewer')).toBeVisible();
  const next=page.locator('#next-placement');
  if(testInfo.project.use.hasTouch)await next.tap();else await next.click();
  await expect(page.locator('#pieces')).toHaveText('1');
  const range=await page.locator('#scrubber').boundingBox();
  if(testInfo.project.use.hasTouch)await page.touchscreen.tap(range.x+range.width/2,range.y+range.height/2);
  else await page.mouse.click(range.x+range.width/2,range.y+range.height/2);
  await expect(page.locator('#pieces')).toHaveText('3');
  expect(await page.evaluate(()=>window.observedPosition.model.displayActive.length)).toBe(4);
  await page.evaluate(()=>scrollTo(0,0));const controls=await page.locator('.transport').boundingBox();expect(controls.y+controls.height).toBeLessThanOrEqual(641);
});
test('phone viewport contains both layouts and Hold never changes rail position',async({page})=>{
  const stream=synthetic().replay;stream.options.version=19;
  stream.events.splice(3,0,{frame:3,type:'keydown',data:{key:'hold',subframe:.2}},{frame:4,type:'keyup',data:{key:'hold',subframe:.2}});
  await upload(page,{version:1,gamemode:'league',replay:{rounds:[[{id:'a',username:'Alpha',replay:stream},{id:'b',username:'Beta',replay:stream}]]}});
  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#hold-lock')).toHaveCount(0);
  for(const size of [{width:360,height:640},{width:390,height:664},{width:430,height:740},{width:667,height:280},{width:667,height:320},{width:844,height:390},{width:915,height:412},{width:900,height:500},{width:1280,height:720}]){
    await page.setViewportSize(size);await placement(page,1);
    const before=await page.locator('#focus-lane .chain').boundingBox();
    await placement(page,2);expect(await page.locator('#focus-lane .chain').boundingBox()).toEqual(before);
    const bounds=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,x:scrollX,y:scrollY}));
    expect(bounds.width).toBeLessThanOrEqual(size.width);expect(bounds.height).toBeLessThanOrEqual(size.height+1);
    expect(bounds.x).toBe(0);expect(bounds.y).toBe(0);
    for(const selector of ['#board','#hold','#next','#garbage-total','#placement-sent','.rail-stats','#playback-tools']){
      const r=await page.locator(selector).first().boundingBox();expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(size.height);
    }
    if(size.width>size.height){
      const r=await page.locator('#peer-board').boundingBox();expect(r.x+r.width).toBeLessThanOrEqual(size.width);
      const header=await page.locator('.topbar').boundingBox();expect(header.height).toBeLessThanOrEqual(48);
      // Stress layout with the combined label also covered by private real replays.
      await page.locator('#spin').evaluate(el=>{el.hidden=false;el.textContent='ALL CLEAR · TRIPLE';});
      const chain=await page.locator('#focus-lane .chain').boundingBox(),sent=await page.locator('#placement-sent').boundingBox(),spin=await page.locator('#spin').boundingBox();
      expect(sent.y+sent.height).toBeLessThanOrEqual(chain.y+chain.height);
      expect(spin.y+spin.height).toBeLessThanOrEqual(sent.y);
      if(size.height<=500){
        for(const prefix of ['', 'peer-']){
          await expect(page.locator(`#${prefix}pieces`)).toBeHidden();await expect(page.locator(`#${prefix}attack`)).toBeHidden();
          await expect(page.locator(`#${prefix}app`)).toBeVisible();
          const values=await page.locator(`#${prefix}lane-display .rail-stats dt:visible`).allTextContents();
          expect(values).toEqual(['PPS','APM','APP']);
        }
        const board=await page.locator('#board').boundingBox(),area=await page.locator('#boards').boundingBox();
        expect(board.height).toBeGreaterThanOrEqual(area.height-24);
        for(const id of ['previous','play','next-placement','speed']){
          const hit=await page.locator(`#${id}`).boundingBox();expect(hit.height).toBeGreaterThanOrEqual(44);expect(hit.width).toBeGreaterThanOrEqual(44);
        }
        const controls=await page.locator('#playback-tools').boundingBox();expect(controls.height).toBeLessThanOrEqual(50);
        const s=await page.evaluate(()=>window.observedPosition.state);
        await expect(page.locator('#app')).toHaveText((s.attack.totals.generated/s.stats.pieces).toFixed(2));
      }
    }
  }
});

test('real private files, all TL streams and known conformance states',async({page})=>{
  test.skip(!process.env.TETRP_TTR||!process.env.TETRP_TTRM,'Private samples are opt-in; never CI artifacts.');test.setTimeout(180000);
  const solo=parseReplay(readFileSync(process.env.TETRP_TTR,'utf8'));
  await page.locator('#file').setInputFiles(process.env.TETRP_TTR);await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed','true');await page.locator('#play').click();
  const reference=new Reconstruction(prepareReplay(selectPlayer(solo)));reference.run();const total=reference.state.stats.pieces;
  for(const n of [0,Math.floor(total/2),total,Math.floor(total/2)])await consistent(page,reference,n);
  await expect(page.locator('#conformance')).toBeHidden();
  const multi=parseReplay(readFileSync(process.env.TETRP_TTRM,'utf8'));
  let checkedSpins=0,checkedGarbage=0,checkedAllClears=0;
  await page.locator('#file').setInputFiles(process.env.TETRP_TTRM);
  for(const r of multi.rounds){await expect(page.locator('#round')).toBeVisible();await page.locator('#round').selectOption(String(r.index));
    for(const p of r.players){await choosePlayer(page,String(p.index));
      let ref;try{ref=new Reconstruction(prepareReplay(selectPlayer(multi,r.index,p.index)));}catch(e){expect(e.code).toBe('UNSUPPORTED_PROFILE');await expect(page.locator('#lane-error')).toBeVisible();await expect(page.locator('#lane-error')).toContainText('retry');continue;}
      let spin=null,garbagePlacement=null,quad=null;const allClears=new Set();
      while(ref.advance()){
        for(const t of ref.transitions)if(!spin&&t.type==='lock'&&t.spin!=='none')spin=t;
        for(const t of ref.transitions)if(t.type==='remove-lines'&&t.allClear)allClears.add(ref.state.stats.pieces);
        if(quad===null&&ref.transitions.some(t=>t.type==='lock'&&t.spin==='none')&&ref.transitions.some(t=>t.type==='remove-lines'&&t.rows.length===4&&!t.allClear))quad=ref.state.stats.pieces;
        if(garbagePlacement===null&&ref.state.attack.pending.length>=2)garbagePlacement=ref.state.stats.pieces+1;
      }
      const count=ref.state.stats.pieces,first=ref.diagnostics.first;await expect(page.locator('#viewer')).toBeVisible();await expect(page.locator('#scrubber')).toHaveAttribute('max',String(count));
      for(const n of [0,Math.floor(count/2),count,Math.floor(count/2)])await consistent(page,ref,n);
      const stats=ref.state;
      const sentHere=stats.attack.totals.sent-ref.seekPlacement(Math.max(0,stats.stats.pieces-1)).attack.totals.sent;
      await expect(page.locator('#placement-sent')).toHaveText(String(sentHere));
      await expect(page.locator('#b2b')).toHaveText(String(Math.max(0,stats.attack.btb-1)));
      await expect(page.locator('#attack')).toHaveText(String(stats.attack.totals.generated));
      await expect(page.locator('#garbage-total')).toHaveText(String([...stats.attack.are,...stats.attack.pending].reduce((sum,p)=>sum+p.amt,0)));
      if(spin){await placement(page,spin.placementIndex);await expect(page.locator('.left-rail .chain #spin')).toContainText(`${spin.piece.toUpperCase()}-SPIN${spin.spin==='mini'?' MINI':''}`);
        const rgb=(allClears.has(spin.placementIndex)?'#42f58a':palette[spin.piece]).slice(1).match(/../g).map(x=>parseInt(x,16)).join(', ');
        await expect(page.locator('#spin')).toHaveCSS('color',`rgb(${rgb})`);checkedSpins++;}
      await expect(page.locator('#player-id')).toHaveText(p.username);
      if(quad!==null){await placement(page,quad);await expect(page.locator('#spin')).toHaveText('QUAD');await expect(page.locator('#spin')).toHaveCSS('color','rgb(130, 218, 202)');}
      if(allClears.size){
        const ac=[...allClears][0];
        for(const n of [ac,ac-1,ac,Math.min(ac+1,count)]){
          await placement(page,n);
          await expect.poll(()=>page.locator('#spin').textContent()).toMatch(allClears.has(n)?/ALL CLEAR/:/^(?!.*ALL CLEAR)/);
          if(allClears.has(n))await expect(page.locator('#spin')).toHaveCSS('color','rgb(66, 245, 138)');
        }
        if(checkedAllClears===0){
          const original=page.viewportSize();await placement(page,ac);
          for(const size of [{width:667,height:320},{width:844,height:390}]){
            await page.setViewportSize(size);
            const chain=await page.locator('#focus-lane .chain').boundingBox(),sent=await page.locator('#placement-sent').boundingBox();
            expect(sent.y+sent.height).toBeLessThanOrEqual(chain.y+chain.height);
            const spin=await page.locator('#spin').boundingBox();expect(spin.y+spin.height).toBeLessThanOrEqual(sent.y);
          }
          await page.setViewportSize(original);
        }
        checkedAllClears++;
      }
      if(garbagePlacement!==null&&garbagePlacement<=count){
        const totalBefore=await page.locator('#garbage-total').boundingBox(),nextBefore=await page.locator('#next').boundingBox();
        await placement(page,garbagePlacement);
        const expected=ref.seekPlacement(garbagePlacement),packets=[...expected.attack.are,...expected.attack.pending].filter(p=>p.amt>0);
        await expect(page.locator('#garbage-total')).toHaveText(String(packets.reduce((sum,p)=>sum+p.amt,0)));
        const totalAfter=await page.locator('#garbage-total').boundingBox(),nextAfter=await page.locator('#next').boundingBox();
        expect(Math.abs((totalAfter.y-nextAfter.y-nextAfter.height)-(totalBefore.y-nextBefore.y-nextBefore.height))).toBeLessThan(1);
        const rows=await page.locator('#garbage-packets .garbage-packet').evaluateAll(nodes=>nodes.map(n=>({amount:Number(n.textContent),top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom})));
        if(packets.length)expect(rows.length).toBeGreaterThan(0);
        expect(rows.map(r=>r.amount)).toEqual(packets.slice(0,rows.length).map(p=>p.amt));
        for(let i=1;i<rows.length;i++)expect(rows[i].bottom).toBeLessThanOrEqual(rows[i-1].top);
        const panel=await page.locator('#garbage-panel').boundingBox();for(const row of rows){expect(row.top).toBeGreaterThanOrEqual(panel.y);expect(row.bottom).toBeLessThanOrEqual(panel.y+panel.height+.1);}
        if(packets.length&&checkedGarbage===0){
          const original=page.viewportSize();
          for(const size of [{width:844,height:390},{width:800,height:600},{width:360,height:640}]){
            await page.setViewportSize(size);
            await expect(page.locator('#garbage-packets .garbage-packet').first()).toHaveText(String(packets[0].amt));
            const list=await page.locator('#garbage-packets').boundingBox();
            expect(list.height).toBeGreaterThanOrEqual(24);
          }
          await page.setViewportSize(original);
        }
        checkedGarbage++;
      }
      if(first)await expect(page.locator('#status-text')).toHaveText('終局比對有差異');else await expect(page.locator('#conformance')).toBeHidden();
    }
  }
  expect(checkedSpins).toBeGreaterThan(0);
  expect(checkedGarbage).toBeGreaterThan(0);
  expect(checkedAllClears).toBeGreaterThan(0);
});
