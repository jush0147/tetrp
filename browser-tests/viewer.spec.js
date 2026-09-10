import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {parseReplay,selectPlayer,prepareReplay,Reconstruction} from '../src/replay/index.js';
import {boardModel,palette} from '../viewer/render.js';
const synthetic=()=>({version:1,gamemode:'40l',replay:{frames:90,options:{version:15,seed:42,handling:{safelock:false}},events:[
  {frame:0,type:'start',data:{}},...Array.from({length:6},(_,i)=>[{frame:i*12+1,type:'keydown',data:{key:'hardDrop',subframe:.2}},
    {frame:i*12+2,type:'keyup',data:{key:'hardDrop',subframe:.4}}]).flat(),{frame:90,type:'end',data:{reason:'clear'}}]}});
test.beforeEach(async({page})=>{await page.addInitScript(()=>document.addEventListener('tetrp:position',e=>{window.observedPosition=e.detail;}));await page.goto('./');});
async function upload(page,object){await page.locator('#file').setInputFiles({name:'synthetic.ttr',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(object))});}
async function placement(page,n){await page.locator('#placement-input').fill(String(n));await page.locator('#placement-form button').click();await expect(page.locator('#pieces')).toHaveText(String(n));}
async function consistent(page,reference,n){await placement(page,n);const expected=reference.seekPlacement(n);
  await expect.poll(()=>page.evaluate(()=>window.observedPosition.state)).toEqual(expected);
  expect(await page.evaluate(()=>window.observedPosition.model)).toEqual(boardModel(expected));
  await expect(page.locator('#next canvas')).toHaveCount(expected.rules.nextcount);
  await expect(page.locator('#hold')).toHaveAttribute('aria-label',expected.hold.piece?.toUpperCase()||'空');
  expect(await page.locator('#next canvas').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')))).toEqual(expected.bag.queue.slice(0,expected.rules.nextcount).map(t=>t.toUpperCase()));
  const model=boardModel(expected),active=new Set(model.active.map(([x,y])=>`${x},${y}`));
  const colors=model.rows.flatMap((row,y)=>row.map((type,x)=>palette[active.has(`${x},${y}`)?model.type:type]||'#10191f'));
  const pixels=await page.locator('#board').evaluate(c=>{const ctx=c.getContext('2d'),out=[];for(let y=0;y<20;y++)for(let x=0;x<10;x++){
    const p=ctx.getImageData(x*30+15,y*30+15,1,1).data;out.push('#'+[...p].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join(''));}return out;});
  expect(pixels).toEqual(colors);
}
test('local open, placement navigation, frame seek, playback and refresh',async({page})=>{
  const external=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&(r.method()!=='GET'||!r.url().startsWith('http://127.0.0.1:4173/')))external.push(r.url());});
  const x=synthetic();await upload(page,x);await expect(page.locator('#viewer')).toBeVisible();
  const reference=new Reconstruction(prepareReplay(selectPlayer(parseReplay(JSON.stringify(x)))));
  for(const n of [0,3,6,3,0])await consistent(page,reference,n);
  await page.locator('#next-placement').click();await expect(page.locator('#pieces')).toHaveText('1');
  await page.locator('#previous').click();await expect(page.locator('#pieces')).toHaveText('0');
  await page.locator('.frame-tools summary').click();await page.locator('#frame-input').fill('42');await page.locator('#frame-form button').click();await expect(page.locator('#frame')).toHaveText('42');
  expect(await page.evaluate(()=>window.observedPosition.state)).toEqual(reference.seekFrame(42));
  await page.locator('#play').click();await expect(page.locator('#pieces')).toHaveText('6');await expect(page.locator('#play')).toHaveAttribute('aria-pressed','false');
  expect(external).toEqual([]);await page.reload();await expect(page.locator('#welcome')).toBeVisible();await upload(page,x);await expect(page.locator('#pieces')).toHaveText('0');
});
test('malformed file and responsive touch targets',async({page})=>{
  await page.locator('#file').setInputFiles({name:'broken.ttr',mimeType:'text/plain',buffer:Buffer.from('{')});
  await expect(page.locator('#error')).toBeVisible();await expect(page.locator('#error-detail')).toContainText('MALFORMED_JSON');
  await upload(page,synthetic());await expect(page.locator('#viewer')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const id of ['previous','next-placement','play']){const b=await page.locator(`#${id}`).boundingBox();expect(b.height).toBeGreaterThanOrEqual(44);expect(b.width).toBeGreaterThanOrEqual(44);}
  const board=await page.locator('#board').boundingBox();expect(Math.abs(board.height/board.width-2)).toBeLessThan(.03);
});
test('selection races preserve the latest stream and unsupported retry is visible',async({page})=>{
  const make=(retry=false)=>{const s=synthetic().replay;s.options.version=19;if(retry)s.events.splice(1,0,{frame:0,type:'keydown',data:{key:'retry',subframe:0}});return {replay:s};};
  const x={version:1,gamemode:'league',replay:{rounds:[[make(),make(true)],[make()]]}};
  await upload(page,x);await expect(page.locator('#viewer')).toBeVisible();await placement(page,3);
  await page.locator('#player').selectOption('1');await expect(page.locator('#error-title')).toHaveText('此 stream 暫不支援');await expect(page.locator('#error-detail')).toContainText('retry');
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
  expect(await page.locator('#active-preview').getAttribute('aria-label')).not.toBe('空');
  await page.evaluate(()=>scrollTo(0,0));const controls=await page.locator('.transport').boundingBox();expect(controls.y+controls.height).toBeLessThanOrEqual(641);
});
test('real private files, all TL streams and known conformance states',async({page})=>{
  test.skip(!process.env.TETRP_TTR||!process.env.TETRP_TTRM,'Private samples are opt-in; never CI artifacts.');test.setTimeout(180000);
  const solo=parseReplay(readFileSync(process.env.TETRP_TTR,'utf8'));
  await page.locator('#file').setInputFiles(process.env.TETRP_TTR);await expect(page.locator('#viewer')).toBeVisible();
  const reference=new Reconstruction(prepareReplay(selectPlayer(solo)));reference.run();const total=reference.state.stats.pieces;
  for(const n of [0,Math.floor(total/2),total,Math.floor(total/2)])await consistent(page,reference,n);
  await expect(page.locator('#status-text')).toHaveText('未發現已知差異');
  const multi=parseReplay(readFileSync(process.env.TETRP_TTRM,'utf8'));
  await page.locator('#file').setInputFiles(process.env.TETRP_TTRM);
  for(const r of multi.rounds){await expect(page.locator('#round')).toBeVisible();await page.locator('#round').selectOption(String(r.index));
    for(const p of r.players){await page.locator('#player').selectOption(String(p.index));
      let ref;try{ref=new Reconstruction(prepareReplay(selectPlayer(multi,r.index,p.index)));}catch(e){expect(e.code).toBe('UNSUPPORTED_PROFILE');await expect(page.locator('#error')).toBeVisible();await expect(page.locator('#error-detail')).toContainText('retry');continue;}
      ref.run();const count=ref.state.stats.pieces,first=ref.diagnostics.first;await expect(page.locator('#viewer')).toBeVisible();await expect(page.locator('#total')).toHaveText(`/ ${count}`);
      for(const n of [0,Math.floor(count/2),count,Math.floor(count/2)])await consistent(page,ref,n);
      await expect(page.locator('#status-text')).toHaveText(first?'終局比對有差異':'未發現已知差異');
    }
  }
});
