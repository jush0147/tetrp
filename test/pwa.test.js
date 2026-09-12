import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('service worker updates retain live clients and only clean their own caches',async()=>{
  const events={},deleted=[],cached=[],scope='https://example.com/tetrp/';let claimed=false;
  const source=readFileSync(new URL('../viewer/sw.js',import.meta.url),'utf8')
    .replace('__VERSION__','"new"').replace('__ASSETS__','["index.html","worker.js"]');
  runInNewContext(source,{URL,Set,self:{registration:{scope},addEventListener:(name,fn)=>events[name]=fn,
    clients:{claim:async()=>{claimed=true;}}},caches:{open:async()=>({addAll:async urls=>cached.push(...urls),match:async key=>key}),
    keys:async()=>[`tetrp:${scope}:old`,`tetrp:${scope}:new`,'another-app'],delete:async key=>deleted.push(key)}});
  let work;events.install({waitUntil:p=>work=p});await work;
  assert.deepEqual(cached,[scope+'index.html',scope+'worker.js']);assert.equal(claimed,false);
  events.activate({waitUntil:p=>work=p});await work;
  assert.deepEqual(deleted,[`tetrp:${scope}:old`]);assert.equal(claimed,true);
  for(const request of [{method:'POST',url:scope+'index.html'},{method:'GET',url:scope+'private.ttr'},
    {method:'GET',url:'https://elsewhere.test/worker.js'}]){
    events.fetch({request,respondWith:()=>assert.fail('Unlisted data must not be intercepted')});
  }
  events.fetch({request:{method:'GET',mode:'navigate',url:scope+'?launch=1'},respondWith:p=>work=p});
  assert.equal(await work,scope+'index.html');
});
