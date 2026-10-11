import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttack,resolveAttack} from '../src/attack.js';
import {createHoles} from '../src/random.js';
import {ruleset} from '../src/rules.js';
import {visibleCombat,projectCombat} from '../src/analysis/rook-combat.js';

const publicView=(attack,placed)=>({piecesPlaced:placed,attack:{
  combo:attack.combo,btb:attack.btb,cumulativeSent:attack.cumulativeSent,
  multiplier:attack.multiplier,pending:attack.pending.map(p=>({...p})),
  are:attack.are.map(p=>({...p}))}});
function differential(name,config,clear,overrides={}){
  test(name,()=>{
    const rules=ruleset('tl',{b2bcharge_base:3,...overrides});
    const state=Object.assign(createAttack(),structuredClone(config));
    const before=structuredClone(state);
    const view=publicView(state,state.pieces);
    const projection=projectCombat(visibleCombat(view),clear,rules);
    const actual=resolveAttack(state,clear,rules,createHoles(1));
    const phases=[...actual.surge,actual.normal,actual.all_clear].filter(Boolean);
    const sum=k=>phases.reduce((n,p)=>n+p[k],0);
    assert.equal(projection.btb,state.btb);
    assert.equal(projection.combo,state.combo);
    assert.equal(projection.combat.pieces,state.pieces);
    assert.equal(projection.combat.cumulativeSent,state.cumulativeSent);
    assert.equal(projection.offensive,sum('sent'));
    assert.equal(projection.defensive,sum('cancelled'));
    assert.equal(projection.generated,sum('generated'));
    assert.equal(projection.pending,state.are.concat(state.pending).reduce((n,p)=>n+p.amt,0));
    assert.deepEqual(projection.combat.pending.map(p=>p.amt),state.pending.map(p=>p.amt));
    assert.deepEqual(projection.combat.are.map(p=>p.amt),state.are.map(p=>p.amt));
    assert.deepEqual(view,publicView(before,before.pieces),'do not mutate public snapshot');
  });
}
const tetris={lines:4,spin:'none',allClear:false,garbageRows:0};
const tsd={lines:2,spin:'full',allClear:false,garbageRows:0};
const mini={lines:1,spin:'mini',allClear:false,garbageRows:0};
const packet=(amt,options={})=>({amt,active:true,hardened:false,shielded:false,status:'active',activeFrame:1,...options});
differential('base TSD 4 attack',{},tsd);
differential('base Tetris same 4 attack',{},tetris);
differential('all-mini single is zero base',{},mini);
differential('TSD maintaining B2B charge',{btb:4,pieces:20},tsd);
differential('full TSD with B2B plus combo',{btb:6,combo:3,pieces:40,multiplier:1.3},tsd);
differential('all-clear TSD adds extra B2B + all-clear attack',{btb:3,pieces:22},{...tsd,allClear:true});
differential('breaking a charged chain emits split surge',{btb:8,pieces:30},{lines:1,spin:'none',allClear:false,garbageRows:0});
differential('hardened packet does not cancel',{pieces:30,pending:[packet(5,{hardened:true})]},tsd);
differential('opener defense cancels more than actual attack',{pieces:1,cumulativeSent:0,pending:[packet(8)]},mini);
differential('late defense without opener discount',{pieces:50,cumulativeSent:6,pending:[packet(8)]},tsd);
differential('ARE packets prioritized to pending',{pieces:18,are:[packet(3)],pending:[packet(8)]},tsd);
differential('special garbage clear + multiplier',{pieces:30,multiplier:1.7,btb:2},{...tsd,garbageRows:1});
differential('no garbage blocking sends full attack',{pieces:21,pending:[packet(5)]},tsd,{garbageblocking:'none'});
test('TSD and Tetris have matching base attack but TSD clears half the lines',()=>{
  const r=ruleset('tl');const x=visibleCombat({piecesPlaced:0,attack:createAttack()});
  assert.equal(projectCombat(x,tsd,r).generated,4);
  assert.equal(projectCombat(x,tetris,r).generated,4);
});
test('all-clear + TSD adds two separate B2B units under current TL authority',()=>{
  const r=ruleset('tl');const x=visibleCombat({piecesPlaced:10,attack:createAttack()});
  assert.equal(projectCombat(x,{...tsd,allClear:true},r).btb,2);
});
