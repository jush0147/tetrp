import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {parseReplay,selectPlayer,prepareReplay,Reconstruction} from '../src/replay/index.js';
import {boardModel,palette} from '../viewer/render.js';
const synthetic=()=>({version:1,gamemode:'40l',replay:{frames:90,options:{version:15,seed:42,handling:{safelock:false}},events:[
  {frame:0,type:'start',data:{}},...Array.from({length:6},(_,i)=>[{frame:i*12+1,type:'keydown',data:{key:'hardDrop',subframe:.2}},
    {frame:i*12+2,type:'keyup',data:{key:'hardDrop',subframe:.4}}]).flat(),{frame:90,type:'end',data:{reason:'clear'}}]}});
test.beforeEach(async({page})=>{await page.addInitScript(()=>document.addEventListener('tetrp:position',e=>{window.observedPosition=e.detail;}));await page.goto('./');});
async function upload(page,object){await page.locator('#file').setInputFiles({name:'synthetic.ttr',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(object))});}
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
  await page.locator('#player').selectOption('1');await expect(page.locator('#player-id')).toHaveText('player-beta');
  expect(await page.evaluate(()=>window.observedPosition.roundFrame)).toBe(before.roundFrame);
  expect(await page.evaluate(()=>window.observedPosition.state)).toEqual(before.views[1].state);
  await page.locator('#player').selectOption('0');await expect(page.locator('#player-id')).toHaveText('player-alpha');
  expect(await page.evaluate(()=>window.observedPosition.state)).toEqual(before.state);
  await page.setViewportSize({width:844,height:390});await expect(page.locator('#peer-board')).toBeVisible();
  await expect(page.locator('#player-id')).toHaveText('player-alpha');await expect(page.locator('#peer-player-id')).toHaveText('player-beta');
  for(const prefix of ['', 'peer-']){
    const b=await page.locator(`#${prefix}board`).boundingBox(),h=await page.locator(`#${prefix}hold`).boundingBox(),n=await page.locator(`#${prefix}next`).boundingBox();
    expect(h.x+h.width).toBeLessThan(b.x);expect(n.x).toBeGreaterThan(b.x+b.width);
    expect(Math.abs(b.height/b.width-2)).toBeLessThan(.03);
    await expect(page.locator(`#${prefix}lines`)).toBeHidden();
    const stats=await page.locator(`#${prefix}apm`).boundingBox();expect(stats.y+stats.height).toBeLessThanOrEqual(b.y+b.height+1);
  }
  const ref=new Reconstruction(prepareReplay(selectPlayer(parseReplay(JSON.stringify(x)),0,1)));
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  for(const speed of ['0.5','1','1.5']){
    await placement(page,0);await expect.poll(()=>page.evaluate(()=>window.observedPosition?.roundFrame)).toBe(0);
    await page.locator('#speed').selectOption(speed);
    // Browser clock controls rAF/performance without relying on CI wall-clock speed.
    await page.evaluate(()=>document.getElementById('play').click());await page.clock.runFor(500);
    await page.locator('#player').selectOption('1');await expect(page.locator('#player-id')).toHaveText('player-beta');
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
  await expect(page.locator('#player')).toBeHidden();await expect(page.locator('#scrubber')).toBeHidden();
  expect((await page.locator('#board').boundingBox()).height).toBeGreaterThan(oldBoard.height);
  expect(await page.evaluate(()=>window.observedPosition.state)).toEqual(stateBeforeCollapse);
  await page.locator('#toggle-selectors').click();await page.locator('#toggle-playback').click();
  await expect(page.locator('#player')).toBeVisible();await expect(page.locator('#scrubber')).toBeVisible();
  expect(errors).toEqual([]);
});
test('malformed file and responsive touch targets',async({page})=>{
  await page.locator('#file').setInputFiles({name:'broken.ttr',mimeType:'text/plain',buffer:Buffer.from('{')});
  await expect(page.locator('#error')).toBeVisible();await expect(page.locator('#error-detail')).toContainText('MALFORMED_JSON');
  await upload(page,synthetic());await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#lines')).toBeVisible();await expect(page.locator('#conformance')).toBeHidden();
  expect((await page.locator('.transport').boundingBox()).height).toBeLessThanOrEqual(48);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const id of ['previous','next-placement','play']){const b=await page.locator(`#${id}`).boundingBox();expect(b.height).toBeGreaterThanOrEqual(44);expect(b.width).toBeGreaterThanOrEqual(44);}
  const board=await page.locator('#board').boundingBox();expect(Math.abs(board.height/board.width-2)).toBeLessThan(.03);
});
test('selection races preserve the latest stream and unsupported retry is visible',async({page})=>{
  const make=(retry=false)=>{const s=synthetic().replay;s.options.version=19;if(retry)s.events.splice(1,0,{frame:0,type:'keydown',data:{key:'retry',subframe:0}});return {replay:s};};
  const x={version:1,gamemode:'league',replay:{rounds:[[make(),make(true)],[make()]]}};
  await upload(page,x);await expect(page.locator('#viewer')).toBeVisible();await placement(page,3);
  await page.locator('#player').selectOption('1');await expect(page.locator('#lane-error')).toContainText('此 stream 暫不支援');await expect(page.locator('#lane-error')).toContainText('retry');
  await page.locator('#round').selectOption('1');await expect(page.locator('#pieces')).toHaveText('0');await expect(page.locator('#viewer')).toBeVisible();
  await page.locator('#round').selectOption('0');await page.locator('#player').selectOption('1');await page.locator('#player').selectOption('0');
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
test('real private files, all TL streams and known conformance states',async({page})=>{
  test.skip(!process.env.TETRP_TTR||!process.env.TETRP_TTRM,'Private samples are opt-in; never CI artifacts.');test.setTimeout(180000);
  const solo=parseReplay(readFileSync(process.env.TETRP_TTR,'utf8'));
  await page.locator('#file').setInputFiles(process.env.TETRP_TTR);await expect(page.locator('#viewer')).toBeVisible();
  const reference=new Reconstruction(prepareReplay(selectPlayer(solo)));reference.run();const total=reference.state.stats.pieces;
  for(const n of [0,Math.floor(total/2),total,Math.floor(total/2)])await consistent(page,reference,n);
  await expect(page.locator('#conformance')).toBeHidden();
  const multi=parseReplay(readFileSync(process.env.TETRP_TTRM,'utf8'));
  let checkedSpins=0,checkedGarbage=0,checkedAllClears=0;
  await page.locator('#file').setInputFiles(process.env.TETRP_TTRM);
  for(const r of multi.rounds){await expect(page.locator('#round')).toBeVisible();await page.locator('#round').selectOption(String(r.index));
    for(const p of r.players){await page.locator('#player').selectOption(String(p.index));
      let ref;try{ref=new Reconstruction(prepareReplay(selectPlayer(multi,r.index,p.index)));}catch(e){expect(e.code).toBe('UNSUPPORTED_PROFILE');await expect(page.locator('#lane-error')).toBeVisible();await expect(page.locator('#lane-error')).toContainText('retry');continue;}
      let spin=null,garbagePlacement=null;const allClears=new Set();
      while(ref.advance()){
        for(const t of ref.transitions)if(!spin&&t.type==='lock'&&t.spin!=='none')spin=t;
        for(const t of ref.transitions)if(t.type==='remove-lines'&&t.allClear)allClears.add(ref.state.stats.pieces);
        if(garbagePlacement===null&&ref.state.attack.pending.length>=2)garbagePlacement=ref.state.stats.pieces+1;
      }
      const count=ref.state.stats.pieces,first=ref.diagnostics.first;await expect(page.locator('#viewer')).toBeVisible();await expect(page.locator('#scrubber')).toHaveAttribute('max',String(count));
      for(const n of [0,Math.floor(count/2),count,Math.floor(count/2)])await consistent(page,ref,n);
      const stats=ref.state;
      await expect(page.locator('#b2b')).toHaveText(String(Math.max(0,stats.attack.btb-1)));
      await expect(page.locator('#attack')).toHaveText(String(stats.attack.totals.generated));
      await expect(page.locator('#garbage-total')).toHaveText(String([...stats.attack.are,...stats.attack.pending].reduce((sum,p)=>sum+p.amt,0)));
      if(spin){await placement(page,spin.placementIndex);await expect(page.locator('.left-rail .chain #spin')).toContainText(`${spin.piece.toUpperCase()}-SPIN${spin.spin==='mini'?' MINI':''}`);
        const rgb=palette[spin.piece].slice(1).match(/../g).map(x=>parseInt(x,16)).join(', ');
        await expect(page.locator('#spin')).toHaveCSS('color',`rgb(${rgb})`);checkedSpins++;}
      await expect(page.locator('#player-id')).toHaveText(p.username);
      if(allClears.size){
        const ac=[...allClears][0];
        for(const n of [ac,ac-1,ac,Math.min(ac+1,count)]){
          await placement(page,n);
          await expect.poll(()=>page.locator('#spin').textContent()).toMatch(allClears.has(n)?/ALL CLEAR/:/^(?!.*ALL CLEAR)/);
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
        expect(rows.map(r=>r.amount)).toEqual(packets.slice(0,rows.length).map(p=>p.amt));
        for(let i=1;i<rows.length;i++)expect(rows[i].bottom).toBeLessThanOrEqual(rows[i-1].top);
        const panel=await page.locator('#garbage-panel').boundingBox();for(const row of rows){expect(row.top).toBeGreaterThanOrEqual(panel.y);expect(row.bottom).toBeLessThanOrEqual(panel.y+panel.height+.1);}
        checkedGarbage++;
      }
      if(first)await expect(page.locator('#status-text')).toHaveText('終局比對有差異');else await expect(page.locator('#conformance')).toBeHidden();
    }
  }
  expect(checkedSpins).toBeGreaterThan(0);
  expect(checkedGarbage).toBeGreaterThan(0);
  expect(checkedAllClears).toBeGreaterThan(0);
});
