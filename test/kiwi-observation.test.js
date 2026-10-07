import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {observationHtml} from '../scripts/kiwi-observation-html.js';
test('offline viewer renders all rounds, swapped seats and skims without input simulation',()=>{
 const draw=[],elements={};
 const el=id=>elements[id]??={value:0,append(){},getContext(){return {clearRect(){},set fillStyle(v){},fillRect(...v){draw.push(v)}}}};
 const s={board:Array.from({length:40},()=>Array(10).fill(null)),hold:{piece:'t'},next:['i','o','s','z','j'],pieces:1,btb:2,combo:1,playing:true};
 const replay={names:['Aligned','Vendored'],games:[false,true].map((swapped,i)=>({round:i+1,swapped,
  frames:[{frame:0,seats:[s,s]},{frame:24,seats:[s,s]}],skims:[{frame:23,seat:0,lines:1,btbBefore:2}],result:{score:[1,0]}}))};
 const html=observationHtml(replay,{score:[1,0],complete:true});
 const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
 vm.runInNewContext(script,{document:{getElementById:el,createElement:()=>({})},setInterval(){},clearInterval(){}});
 assert.equal(el('n0').textContent,'Aligned');assert.equal(draw.length,400);
 el('round').onchange({target:{value:'1'}});assert.equal(el('n0').textContent,'Vendored');
 el('skim').onclick();assert.match(el('info').textContent,/Frame 24.*ordinary 1 clear/);
});
