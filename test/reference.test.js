import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as B from '../src/board.js';
import * as R from '../src/random.js';
import * as P from '../src/physics.js';
import * as A from '../src/attack.js';
import { ruleset } from '../src/rules.js';
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const oracle = requests => {
  const result = spawnSync(python,[fileURLToPath(new URL('./oracle.py',import.meta.url))],{input:JSON.stringify(requests),encoding:'utf8',maxBuffer:32*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  assert.equal(result.status,0,`Python reference failed. Set PYTHON to a Python 3 executable. ${result.error ?? result.stderr}`);
  return JSON.parse(result.stdout);
};
test('bag reference: every pull and RNG checkpoint, 20 seeds x 150 pulls', () => {
  const seeds = [1,42,12345,2147483646,...Array.from({length:16},(_,i)=>(i+1)*97123)];
  const results = oracle(seeds.map(seed=>({kind:'bag',seed,count:150})));
  seeds.forEach((seed,i)=>{
    const bag = R.createBag(seed);
    for(const expected of results[i]) {
      assert.deepEqual({piece:R.pullBag(bag),queue:bag.queue,bagId:bag.bagId,seed:bag.rng.seed},expected);
    }
  });
});
test('#2 seed normalization: Python modulo, bag sequence and both RNG streams', () => {
  const MOD = 2147483647;
  const seeds = [0,-1,-MOD,MOD,MOD+1,1,42,12345,MOD-1,-MOD-1,
    Number.MIN_SAFE_INTEGER,Number.MAX_SAFE_INTEGER];
  const normalized = oracle(seeds.map(seed=>({kind:'seed',seed})));
  const bags = oracle(seeds.map(seed=>({kind:'bag',seed,count:150})));
  seeds.forEach((seed,i)=>{
    assert.equal(R.seedState(seed).seed,normalized[i],`normalization ${seed}`);
    assert.equal(R.createHoles(seed).rng.seed,normalized[i]);
    const bag=R.createBag(seed);
    for(const expected of bags[i]) {
      assert.deepEqual({piece:R.pullBag(bag),queue:bag.queue,bagId:bag.bagId,seed:bag.rng.seed},expected,`bag ${seed}`);
    }
  });
  for(const seed of [NaN,Infinity,-Infinity,0.1,Number.MAX_SAFE_INTEGER+1,'1',null]) {
    assert.throws(()=>R.seedState(seed),RangeError);
  }
});
test('board reference: mixed-material boards and epsilon boundary probes', () => {
  const rng=R.seedState(45231), boards=[];
  for(let i=0;i<40;i++) {
    const b=B.createBoard();
    for(let y=0;y<40;y++) for(let x=0;x<10;x++) b.rows[y][x]=[null,null,'t','gb','gbd'][Math.floor(R.random(rng)*5)];
    b.rows[38].fill('t'); b.rows[39].fill('gb'); boards.push(b);
  }
  const probes=[];
  for(const y of [-0.001,0,0.000001,17,17.000001,17.96,38.999998,39,39.000001,40]) for(const x of [-1,0,4,9,10]) probes.push([x,y]);
  const outputs=oracle(boards.map(b=>({kind:'board',rows:b.rows,probes})));
  boards.forEach((b,i)=>{
    const result={occupied:probes.map(([x,y])=>B.occupied(b,x,y)),lines:B.fullLines(b),empty:B.empty(b),perma:B.emptyWithPerma(b),unclearable:B.emptyWithUnclearable(b),top:b.rows[0].every(c=>c!==null)};
    B.removeLines(b,result.lines); result.after=b.rows; assert.deepEqual(result,outputs[i]);
  });
});
test('hole reference: cancelled and tanked packet boundaries preserve RNG calls', () => {
  const packets=[4,4,0,1,8,0,3,1,0,12]; const seeds=[1,42,12345,2147483646];
  const outputs=oracle(seeds.map(seed=>({kind:'holes',seed,packets})));
  seeds.forEach((seed,i)=>{
    const h=R.createHoles(seed);
    packets.forEach((n,j)=>{
      const holes=n ? Array.from({length:n},()=>R.nextHole(h)) : null;
      R.completePacket(h);
      assert.deepEqual({holes,seed:h.rng.seed,column:h.lastColumn,changed:h.changed},outputs[i][j]);
    });
  });
});
test('fall reference: 600 combinations of probes, softdrop, anti-stall and kick base', () => {
  const requests=[];
  for(const y of [0,0.000001,17,17.96,38.999998]) for(const dt of [0.1,0.4,1]) for(const sdf of [5,6,20,41]) for(const rot of [0,30,31,35,63]) for(const step of [0.04,1]) {
    requests.push({kind:'physics',y,dt,sdf,rot,total:rot,g:0.02,limit:15,kick:1,step});
  }
  const expected=oracle(requests);
  requests.forEach((v,i)=>assert.deepEqual({probes:P.fallProbes(v.y,v.step),soft:P.softDropBudget(v.g,v.dt,v.sdf),anti:P.antiStallExtra(v.limit,v.rot,v.dt),kick:P.kickY(v.y,v.kick,0,v.limit,v.total)},expected[i]));
});
test('TL reference: 300 mixed placements, mini errata, opener, surge, traffic and travel', () => {
  const actions=[{op:'receive',event:{from:'P2',iid:1,amt:7}},{op:'confirm',cid:1},{op:'advance',frame:19},{op:'lock',lines:0},{op:'advance',frame:20},{op:'lock',lines:0}];
  const rng=R.seedState(82731);
  for(let i=0;i<300;i++) {
    if(i%4===0) actions.push({op:'pending',amt:1+Math.floor(R.random(rng)*16),active:i%8===0,hardened:i%12===0});
    const lines=Math.floor(R.random(rng)*5),spin=['none','mini','full'][Math.floor(R.random(rng)*3)];
    actions.push({op:'lock',lines,spin,allClear:lines>0 && i%13===0,garbageRows:i%3===0 ? 1 : 0});
  }
  actions.push({op:'advance',frame:10801},{op:'lock',lines:4},{op:'advance',frame:10861},{op:'lock',lines:2});
  const [expected]=oracle([{kind:'tl',actions}]);
  const s=A.createAttack(),h=R.createHoles(1),r=ruleset(); let frame=0;
  actions.forEach((action,i)=>{
    let result=null;
    if(action.op==='pending') {
      result=++s.cid; s.pending.push({cid:result,amt:action.amt,active:action.active ?? true,hardened:action.hardened ?? false,status:'spawn',column:null});
    } else if(action.op==='receive') result=A.receive(s,action.event);
    else if(action.op==='confirm') {
      const p=s.pending.find(p=>p.cid===action.cid); if(p) p.activeFrame=frame+20;
    } else if(action.op==='advance') {
      s.multiplier+=(Math.max(0,action.frame-10801)-Math.max(0,frame-10801))*.008/60; frame=action.frame;
      for(const p of s.pending) if(p.activeFrame!=null && p.activeFrame<=frame) p.active=true;
    } else if(action.op==='lock') {
      const out=A.resolveAttack(s,{lines:action.lines,spin:action.spin ?? 'none',allClear:action.allClear ?? false,garbageRows:action.garbageRows ?? 0},r,h);
      const tanked=out.blocked ? 0 : A.tank(s,r,h);
      result={frame,piece:s.pieces,lines:action.lines,spin:action.spin ?? 'none',combo_internal:s.combo,combo_display:Math.max(0,s.combo-1),btb_raw:s.btb,garbage_multiplier:s.multiplier,surge:out.surge,normal:out.normal,all_clear:out.all_clear,blocked_tank:out.blocked,tanked,pending_after:A.pendingCount(s)};
    }
    assert.deepEqual({result,combo:s.combo,btb:s.btb,pending:A.pendingCount(s),sent:s.totals.sent,generated:s.totals.generated,cancelled:s.totals.cancelled,tanked:s.totals.tanked,outbox:s.outbox},expected[i],`action ${i}: ${JSON.stringify(action)}`);
  });
});
