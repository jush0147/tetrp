import test from 'node:test';
import assert from 'node:assert/strict';
import {runMatchPool} from '../scripts/kiwi-match-pool.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('pool fills two lanes, assigns once and retains task order despite completion order',async()=>{
 let active=0,peak=0;const seen=[];
 const result=await runMatchPool([0,1,2,3,4],2,async n=>{seen.push(n);active++;peak=Math.max(peak,active);await delay(n===0?20:1);active--;return n*2;});
 assert.equal(peak,2);assert.equal(active,0);assert.deepEqual(seen,[0,1,2,3,4]);assert.deepEqual(result,[0,2,4,6,8]);
});
test('pool stops assigning after failure and waits for the other active task',async()=>{
 const seen=[];let finished=false;
 await assert.rejects(runMatchPool([0,1,2,3],2,async n=>{seen.push(n);if(n===0){await delay(1);throw Error('technical failure');}await delay(10);finished=true;}),/technical failure/);
 assert.deepEqual(seen,[0,1]);assert.equal(finished,true);
});
