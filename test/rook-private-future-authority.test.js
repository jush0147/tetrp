import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {sampleConditionalPrivateFuture} from
  '../src/analysis/rook-private-future-authority.js';
import {pullBag} from '../src/random.js';

const demo=()=>new BotDemo(new Engine({seed:67720,mode:'tl',
  rules:{g:0}}),{placementMode:'atomic'});
const bagGroups=(bag)=>{
  const used=bag.bagId*7-bag.queue.length;
  const groups=[];
  for(let b=0;b<bag.queue.length;){
    const take=Math.min(7-((used+b)%7),bag.queue.length-b);
    groups.push(bag.queue.slice(b,b+take).sort().join(''));
    b+=take;
  }
  return groups;
};

test('identity private scenario preserves whole authority state, not just public view',()=>{
  const d=demo(),old=d.engine.serialize(),v=d.view().visible;
  const r=sampleConditionalPrivateFuture(d.engine,{
    seed:67720,scenario:0,visibleBaseline:v});
  assert.equal(r.changed,false);
  assert.equal(d.engine.serialize(),old);
});
test('alternate futures keep same CURRENT/HOLD/NEXT5 and true 7-bag segment contents',()=>{
  const d=demo(),before=visibleState(d.engine.state);
  const old=structuredClone(d.engine.state.bag);
  const variants=[1,2,3].map(scenario=>{
    const c=d.EngineType.restore(d.engine.serialize());
    const info=sampleConditionalPrivateFuture(c,{
      seed:67720,scenario,side:0,visibleBaseline:before});
    assert.equal(info.changed,true);
    assert.deepEqual(visibleState(c.state),before);
    assert.deepEqual(c.state.bag.queue.slice(0,5),old.queue.slice(0,5));
    assert.deepEqual(bagGroups(c.state.bag),bagGroups(old),
      'each partial or full seven-bag segment retains original pieces');
    assert.equal(c.state.bag.bagId,old.bagId);
    return c;
  });
  assert.ok(variants.every(v=>
    v.state.bag.rng.seed!==old.rng.seed));
  assert.ok(new Set(variants.map(x=>x.state.bag.rng.seed)).size===3);
  const futures=variants.map(v=>{
    const state=structuredClone(v.state.bag);
    return Array.from({length:32},()=>pullBag(state)).join('');
  });
  assert.equal(new Set(futures).size,3,
    'alternate legitimate hidden future paths really diverge');
});
test('the same scenario yields byte-identical private checkpoints for BOTH treatments',()=>{
  const d=demo(),v=d.view().visible,original=d.engine.serialize();
  for(const scenario of [0,1,2]){
    const bytes=[0,1].map(()=>{
      const c=d.EngineType.restore(original);
      sampleConditionalPrivateFuture(c,{
        seed:67720,scenario,side:0,visibleBaseline:v});
      return c.serialize();
    });
    assert.equal(bytes[0],bytes[1]);
  }
});
test('public equivalence ignores innocuous nested object insertion order',()=>{
  const d=demo(),before=d.view().visible;
  const reversed=value=>Array.isArray(value)?value.map(reversed):
    value&&typeof value==='object'?
      Object.fromEntries(Object.keys(value).reverse().map(k=>[k,reversed(value[k])])):
      value;
  const equivalent=reversed(before);
  assert.notEqual(JSON.stringify(equivalent),JSON.stringify(before));
  const target=d.EngineType.restore(d.engine.serialize());
  const result=sampleConditionalPrivateFuture(target,{
    seed:67720,scenario:2,side:0,visibleBaseline:equivalent});
  assert.equal(result.publicIdentical,true);
  assert.deepEqual(visibleState(target.state),before);
});
test('private future sampler rejects invalid scenario and mismatched public views',()=>{
  const d=demo();
  assert.throws(()=>sampleConditionalPrivateFuture(d.engine,{
    seed:67720,scenario:-1}),/Invalid conditional/);
  const invalid=structuredClone(d.view().visible);
  invalid.next[0]='z'===invalid.next[0]?'t':'z';
  assert.throws(()=>sampleConditionalPrivateFuture(d.engine,{
    seed:67720,scenario:1,visibleBaseline:invalid}),
    /does not share the original public/);
});
