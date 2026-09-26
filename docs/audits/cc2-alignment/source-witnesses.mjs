// Source-level witnesses, NOT execution of the Rust/WASM kernel.
// CC2 expressions below are literal small semantic extracts from pinned
// 2e243242b674d57491f99b445f75e35fc48a0e26 src/forecast.rs.
// They expose counterexamples for the later full-kernel differential harness.
import assert from 'node:assert/strict';
import {Engine} from '../../../src/engine.js';
import * as A from '../../../src/attack.js';
import * as B from '../../../src/board.js';

const results=[];
function packet(amt,active){return {amt,active,status:'spawn',shielded:false,hardened:false,column:0};}
function authorityTank(packets){
  const e=new Engine({mode:'tl',seed:1});
  e.state.attack.pending=packets;
  return A.tank(e.state.attack,e.state.rules,e.state.holes,()=>true);
}
// Arena lock is snapshot.frame+23. A packet at +24 is not yet active there.
const at24={authority:authorityTank([packet(1,false)]),cc2Source:Number(24<=24)};
assert.deepEqual(at24,{authority:0,cc2Source:1});
results.push({case:'activation-at-next-decision-not-current-lock',...at24});
// Authority scans past inactive packets; Forecast examines only packet zero.
const headBlocked={authority:authorityTank([packet(2,false),packet(3,true)]),cc2Source:0};
assert.deepEqual(headBlocked,{authority:3,cc2Source:0});
results.push({case:'inactive-head-active-second',...headBlocked,
  scope:'conditional public packet state; frequency/reachability in target matches not established'});
// A partially occupied storage top is discarded by authority pushLine.
const board=B.createBoard();board.rows[0][0]='t';
assert.equal(B.pushLine(board,0),true);
const authorityTopCell=board.rows.some(row=>row.includes('t'));
const cc2Column=((1n<<39n)<<1n)|0n;
assert.equal(authorityTopCell,false);assert.equal(cc2Column,1n<<40n);
results.push({case:'partial-storage-top-clipping',authorityRetainsOldCell:authorityTopCell,
  cc2SourceRetainsOutOfBoardBit:cc2Column.toString()});
console.log(JSON.stringify({kind:'source-expression-witnesses-not-Rust-parity',results},null,2));
