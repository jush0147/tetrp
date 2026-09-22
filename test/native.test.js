import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';
import * as R from '../src/rotation.js';
import * as C from '../src/analysis/native/board.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {BotDemo} from '../src/analysis/demo.js';
import {generate,spawn} from '../src/analysis/native/movegen.js';
import {fromSnapshot,place,holdState,scenarios,leaf,stateKey} from '../src/analysis/native/model.js';
import {analyze,recommendation,DEFAULTS} from '../src/analysis/native/search.js';
import {Transpositions} from '../src/analysis/native/tt.js';

test('compact occupancy and shared SRS/spin match authority across irregular boards',()=>{
  for(let seed=0;seed<4;seed++){
    const e=new Engine({seed:seed+1});
    for(let y=32;y<40;y++)for(let x=0;x<10;x++)if((x*13+y*7+seed)%11<5)e.state.board.rows[y][x]='gb';
    const b=C.pack(e.state.board);
    for(const type of 'zlosijt')for(let r=0;r<4;r++)for(let x=-1;x<11;x++)for(const y of [17.96,31.96,34.96,38.96]){
      const p={...spawn(type),x,y,r,rotated:true};
      assert.equal(C.legal(b,p),B.legal(e.state.board,p));
      assert.equal(R.classifySpin(b,p,'all-mini+',C.geometry),R.classifySpin(e.state.board,p));
      for(const d of [1,2,3])assert.deepEqual(R.rotate(b,p,d,15,C.geometry),R.rotate(e.state.board,p,d));
    }
  }
});

test('compact commits, garbage materials and line clears match authority',()=>{
  const e=new Engine();const b=e.state.board;
  b.rows[39]=Array(10).fill('gb');b.rows[39][4]=b.rows[39][5]=null;
  const p={...spawn('o'),y:39},compact=C.pack(b),result=C.commit(compact,p);
  const lockout=B.commit(b,p),lines=B.fullLines(b);B.removeLines(b,lines);
  assert.equal(result.lines,1);assert.equal(result.garbageRows,1);assert.equal(result.lockout,lockout);
  assert.deepEqual(compact.rows,C.pack(b).rows);assert.deepEqual(compact.garbage,C.pack(b).garbage);
  for(let h=0;h<10;h++){assert.equal(C.pushGarbage(compact,h),B.pushLine(b,h));assert.deepEqual(compact,C.pack(b));}
});

test('L conserves garbage burden across ordinary tank; U and H describe actual board',()=>{
  const b=C.pack(B.createBoard());const before=C.features(b,3);
  C.pushGarbage(b,4);assert.equal(C.features(b,2).load,before.load);
  b.rows[37]|=1<<4;
  const f=C.features(b,2);assert.equal(f.coveredEmpty,2);assert.equal(f.maxHeight,3);assert.equal(f.height,.45);
});

test('shared attack transaction matches authority for clears, Surge, opener and All Clear',()=>{
  for(const btb of [0,5,12])for(const pending of [0,8])for(const allClear of [false,true]){
    const e=new Engine({rules:{g:0}});e.state.piece={...e.state.piece,type:'i',r:0,x:4,y:39};
    e.state.board.rows[39]=Array(10).fill('gb');for(let x=3;x<=6;x++)e.state.board.rows[39][x]=null;
    if(!allClear)e.state.board.rows[38][0]='t';
    e.state.attack.btb=btb;
    if(pending)e.receive({from:'P2',iid:1,amt:pending});
    const s=fromSnapshot(visibleState(e.state));
    const result=place(s,s.current,e.state.rules,{framesPerPiece:1,rootFrame:0,scenario:{hole:0,unknownDelay:Infinity}});
    e.lock();
    assert.deepEqual(result.state.board.rows,C.pack(e.state.board).rows);
    for(const k of ['combo','btb','pieces','cumulativeSent'])assert.equal(result.state.attack[k],e.state.attack[k],k);
    for(const k of ['generated','cancelled','sent'])assert.equal(result.state.attack.totals[k],e.state.attack.totals[k],k);
    assert.equal(result.state.attack.pending.reduce((n,p)=>n+p.amt,0),e.state.attack.pending.reduce((n,p)=>n+p.amt,0));
  }
});

test('Hold consumes only visible pieces, never repeats while locked',()=>{
  const s=fromSnapshot(visibleState(new Engine().state)),h=holdState(s,new Engine().state.rules);
  assert.equal(h.current.type,s.next[0]);assert.equal(h.next.length,4);assert.equal(h.hold.piece,s.current.type);
  assert.equal(holdState(h,new Engine().state.rules),null);assert.equal(s.next.length,5);
});

test('active garbage tank matches authority for each hole and preserves the cap',()=>{
  for(let hole=0;hole<10;hole++){
    const e=new Engine({rules:{g:0}});e.state.piece={...e.state.piece,type:'o',x:0,y:39};
    e.receive({from:'P2',iid:1,amt:12});Object.assign(e.state.attack.pending[0],{active:true,column:hole});
    const s=fromSnapshot(visibleState(e.state));
    const result=place(s,s.current,e.state.rules,{framesPerPiece:1,rootFrame:0,scenario:{hole,unknownDelay:Infinity}});
    e.lock();assert.equal(result.inserted,8);assert.deepEqual(result.state.board,C.pack(e.state.board));
    assert.equal(result.state.attack.pending[0].amt,4);assert.equal(result.state.dead,!e.state.playing);
  }
});

test('placement forecast uses the authority late multiplier boundary',()=>{
  const e=new Engine({rules:{g:0,garbagemargin_frames:0,garbageincrease_per_second:1}});
  const s=fromSnapshot(visibleState(e.state)),p=generate(s.board,s.current,e.state.rules).moves[0].piece;
  const result=place(s,p,e.state.rules,{framesPerPiece:24,rootFrame:0,scenario:{hole:0,unknownDelay:Infinity}});
  for(let i=0;i<24;i++)e.step([]);
  assert.equal(result.state.attack.multiplier,e.state.attack.multiplier);
});

test('garbage scenarios stop before hidden-hole-dependent continuation',()=>{
  const e=new Engine();e.receive({from:'P2',iid:1,amt:4});const s=fromSnapshot(visibleState(e.state));
  const hs=scenarios(s,{framesPerPiece:24,horizon:5});assert.equal(hs.length,30);
  const move=generate(s.board,s.current,e.state.rules).moves[0];
  const early=place(s,move.piece,e.state.rules,{framesPerPiece:24,rootFrame:0,scenario:hs[0]});
  assert.equal(early.inserted,4);assert.equal(early.state.frontier,true);
  const late=place(s,move.piece,e.state.rules,{framesPerPiece:24,rootFrame:0,scenario:hs.at(-1)});
  assert.equal(late.inserted,0);assert.equal(s.attack.pending[0].amt,4);
});

test('TT verifies full keys even when hashes collide and includes public rule state',()=>{
  const tt=new Transpositions(16);tt.hash=()=>0;
  assert.equal(tt.dominated('a',1),false);assert.equal(tt.dominated('b',2),false);
  assert.equal(tt.dominated('a',1),true);assert.equal(tt.dominated('a',3),false);
  const s=fromSnapshot(visibleState(new Engine().state)),key=stateKey(s);s.attack.btb++;assert.notEqual(stateKey(s),key);
});

test('native search is deterministic, leaves input untouched and cannot see changed hidden queues',()=>{
  const e=new Engine(),snapshot=visibleState(e.state),before=JSON.stringify(snapshot);
  const a=analyze(snapshot,{horizon:1});e.state.bag.queue.splice(5,99,'t','t','t');e.state.holes.rng.seed=123;
  const b=analyze(visibleState(e.state),{horizon:1});
  assert.deepEqual(a.candidates,b.candidates);assert.equal(JSON.stringify(snapshot),before);
  assert.ok(a.nodes<=a.nodeBudget);assert.throws(()=>analyze(snapshot,{geometryBudget:1}),/ROOT_GEOMETRY/);
  assert.throws(()=>analyze(snapshot,{nodeBudget:1}),/ROOT_BUDGET/);
  const dead=fromSnapshot(snapshot);dead.dead=true;assert.equal(leaf(dead,DEFAULTS.weights).value,-1e6);
});

test('ranked native placement paths execute through existing Phase 4 authority',()=>{
  for(const seed of [1,42,123]){
    const e=new Engine({seed}),report=analyze(visibleState(e.state),{horizon:1});
    for(let i=0;i<report.candidates.length;i++){
      const result=recommendation(report,i),demo=new BotDemo(e);
      demo.prepare(result,0);const view=demo.commit(0);
      assert.equal(view.index,result.action.kind==='hold'?0:1);
    }
  }
});
