import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('service worker sends coordinated reload messages and only cleans its own asset caches',async()=>{
  const events={},deleted=[],cached=[],notified=[],scope='https://example.com/tetrp/';let claimed=false,skipped=false;
  const source=readFileSync(new URL('../viewer/sw.js',import.meta.url),'utf8')
    .replace('__VERSION__','"new"').replace('__ASSETS__','["index.html","worker.js"]');
  runInNewContext(source,{URL,Set,Request,self:{registration:{scope},skipWaiting:async()=>{skipped=true;},addEventListener:(name,fn)=>events[name]=fn,
    clients:{claim:async()=>{claimed=true;},matchAll:async()=>[scope, 'https://example.com/another/'].map(url=>({url,postMessage:message=>notified.push([url,message.type])}))}},caches:{open:async()=>({addAll:async requests=>{for(const r of requests){assert.equal(r.cache,'reload');cached.push(r.url);}},match:async key=>key}),
    keys:async()=>[`tetrp:${scope}:old`,`tetrp:${scope}:new`,'another-app'],delete:async key=>deleted.push(key)}});
  let work;events.install({waitUntil:p=>work=p});await work;
  assert.deepEqual(cached,[scope+'index.html',scope+'worker.js']);assert.equal(claimed,false);assert.equal(skipped,true);
  events.activate({waitUntil:p=>work=p});await work;
  assert.deepEqual(deleted,[`tetrp:${scope}:old`]);assert.equal(claimed,true);
  assert.deepEqual(notified,[[scope,'RELOAD_UPDATE']]);
  for(const request of [{method:'POST',url:scope+'index.html'},{method:'GET',url:scope+'private.ttr'},
    {method:'GET',url:'https://elsewhere.test/worker.js'}]){
    events.fetch({request,respondWith:()=>assert.fail('Unlisted data must not be intercepted')});
  }
  events.fetch({request:{method:'GET',mode:'navigate',url:scope+'?launch=1'},respondWith:p=>work=p});
  assert.equal(await work,scope+'index.html');
});


test('active update waits for every scoped client to commit and cancels on a refusal',async()=>{
  for(const ready of [false,true]){
    const events={},sent=[];let skipped=false;
    class Channel{constructor(){this.port1={close(){}};this.port2={postMessage:data=>this.port1.onmessage({data})};}}
    const source=readFileSync(new URL('../viewer/sw.js',import.meta.url),'utf8').replace('__VERSION__','"new"').replace('__ASSETS__','[]');
    runInNewContext(source,{URL,Request,Set,MessageChannel:Channel,setTimeout,clearTimeout,self:{registration:{scope:'https://example.com/',active:{}},addEventListener:(name,fn)=>events[name]=fn,skipWaiting:async()=>{skipped=true;},clients:{matchAll:async()=>[true,ready].map(result=>({url:'https://example.com/',postMessage:(message,ports)=>{sent.push(message.type);ports?.[0].postMessage({ready:result});}}))}},caches:{open:async()=>({addAll:async()=>{}})}});
    let work;events.install({waitUntil:p=>work=p});await work;assert.equal(skipped,false);
    events.message({data:{type:'REQUEST_UPDATE'},waitUntil:p=>work=p});await work;
    assert.equal(skipped,ready);assert.equal(sent.filter(type=>type==='PREPARE_UPDATE').length,2);
    assert.equal(sent.filter(type=>type==='CANCEL_UPDATE').length,ready?0:2);
  }
});
