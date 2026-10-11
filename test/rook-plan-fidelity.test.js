import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine.js';
import {verifyAuthorityOnlyPostHoldLanding} from '../scripts/rook-posthold-authority-proof.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {chooseMove,rookBoardKey} from '../src/analysis/rook.js';
import {auditPublicNextForecast,comparePublicForecastPrerequisites,
  sameForecastAsFreshRookChoice}
  from '../src/analysis/rook-plan-fidelity.js';

const v=()=>visibleState(new Engine({
  seed:67920,mode:'tl',rules:{g:0}}).state);
function publicForecast(visible,action){
  return {preBoardKey:rookBoardKey(visible.board),
    preCurrent:visible.current.type,preHold:visible.hold.piece,
    prePending:0,preBtb:visible.attack.btb,
    preCombo:visible.attack.combo,
    useHold:false,piece:action.move.piece,spin:action.execution.spin,
    cells:action.move.cells};
}
test('genuine legal SRS+ first placement passes fresh public next-lock proof',()=>{
  const visible=v();
  const report=chooseMove(visible,{depth:3,beamWidth:12,maxNodes:1800,
    maxStates:700,maxSteps:42,includeRanked:true});
  const legal=report.ranked.find(x=>x.kind==='place');
  assert.ok(legal);
  const probe=auditPublicNextForecast(visible,
    publicForecast(visible,legal));
  assert.equal(probe.status,'placement-srs-proven');
  assert.equal(probe.verifiedPlacement,true);
  assert.equal(probe.reachable,true);
  assert.equal(probe.all,true);
});
test('public garbage, board or current changes invalidate a formerly valid forecast',()=>{
  const visible=v();
  const a=chooseMove(visible,{depth:2,beamWidth:12,maxNodes:900,
    maxStates:700,maxSteps:42,includeRanked:true})
    .ranked.find(x=>x.kind==='place');
  assert.ok(a);
  const plan=publicForecast(visible,a);
  const changes=[
    vv=>{vv.attack.pending=[{amt:2}]},
    vv=>{vv.board.rows.at(-1)[0]='gb'},
    vv=>{vv.current.type=vv.current.type==='t'?'i':'t'},
    vv=>{vv.attack.btb++}
  ];
  for(const mutate of changes){
    const changed=structuredClone(visible);mutate(changed);
    const audited=auditPublicNextForecast(changed,plan);
    assert.equal(audited.status,'public-precondition-changed');
    assert.equal(audited.reachable,null);
    assert.equal(audited.verifiedPlacement,false);
    assert.equal(comparePublicForecastPrerequisites(changed,plan).all,false);
  }
});
test('same visible preconditions with incorrect spin is NOT SRS+ proof',()=>{
  const visible=v(),a=chooseMove(visible,{depth:2,beamWidth:12,
    maxNodes:900,maxStates:700,maxSteps:42,
    includeRanked:true}).ranked.find(x=>x.kind==='place');
  assert.ok(a);
  const plan=publicForecast(visible,a);
  plan.spin='invalid-expected-spin';
  const audited=auditPublicNextForecast(visible,plan);
  assert.equal(audited.status,'placement-no-srs-proof');
  assert.equal(audited.reachable,false);
  assert.equal(audited.verifiedPlacement,false);
});
test('Hold precondition is public but placement after Hold is never pre-approved',()=>{
  const visible=v();
  if(!visible.rules.hold||visible.hold.piece!==null)
    throw Error('Test requires original empty Hold');
  const plan={preBoardKey:rookBoardKey(visible.board),
    preCurrent:visible.current.type,preHold:visible.hold.piece,
    prePending:0,preBtb:visible.attack.btb,
    preCombo:visible.attack.combo,useHold:true,
    piece:visible.next[0],spin:'none',cells:[]};
  const audit=auditPublicNextForecast(visible,plan);
  assert.equal(audit.status,'hold-publicly-permitted');
  assert.equal(audit.reachable,true);
  assert.equal(audit.verifiedPlacement,false);
  assert.equal(audit.holdRequiresFreshPostHoldReachability,true);
});
test('reject future state information and absent NEXT5',()=>{
  const visible=v();
  visible.next.pop();
  assert.throws(()=>comparePublicForecastPrerequisites(visible,{}),
    /public NEXT5/);
});

test('OFFLINE genuine authority Hold confirms actual SRS+ landed next piece without NEXT6 leakage',()=>{
  const engine=new Engine({seed:67920,mode:'tl',rules:{g:0}});
  const original=visibleState(engine.state);
  assert.equal(original.hold.piece,null);
  const after=Engine.restore(engine.serialize());
  assert.equal(after.hold(),true);
  const nextPublic=visibleState(after.state);
  assert.equal(nextPublic.current.type,original.next[0]);
  const report=chooseMove(nextPublic,{depth:2,beamWidth:12,maxNodes:1200,
    maxStates:700,maxSteps:42,includeRanked:true});
  const action=report.ranked.find(x=>x.kind==='place');
  assert.ok(action,'post Hold must produce a legal CURRENT piece placement');
  const step={preBoardKey:rookBoardKey(original.board),
    preCurrent:original.current.type,preHold:original.hold.piece,
    prePending:0,preBtb:original.attack.btb,
    preCombo:original.attack.combo,
    useHold:true,piece:original.next[0],
    spin:action.execution.spin,cells:action.move.cells};
  const done=verifyAuthorityOnlyPostHoldLanding(engine,original,step);
  assert.equal(done.holdAuthorityAccepted,true);
  assert.equal(done.sameProjectedPiece,true);
  assert.equal(done.placementSrsProven,true);
  assert.equal(done.authorityFutureExposed,false);
  assert.equal('newlyVisibleNext5' in done,false);
  assert.equal('bag' in done,false);
  assert.equal('rng' in done,false);
  // Wrong spin MUST fail SRS proof even though real Hold is permitted.
  const bad=verifyAuthorityOnlyPostHoldLanding(engine,original,
    {...step,spin:'impossible'});
  assert.equal(bad.holdAuthorityAccepted,true);
  assert.equal(bad.placementSrsProven,false);
  assert.equal(bad.authorityFutureExposed,false);
  assert.equal(engine.state.hold.piece,null,
    'offline proof cannot mutate live authority checkpoint');
});

test('public actual decision comparison distinguishes legal-but-abandoned forecast and Hold',()=>{
  const planned={useHold:false,piece:'t',spin:'full',
    cells:[[4,19],[5,19],[5,18],[5,20]]};
  const actual={placement:{piece:'t',
    cells:[[5,20],[5,18],[4,19],[5,19]]},
    executionSpin:'full',holdCount:0};
  assert.equal(sameForecastAsFreshRookChoice(planned,actual),true);
  assert.equal(sameForecastAsFreshRookChoice(planned,
    {...actual,holdCount:1}),false);
  assert.equal(sameForecastAsFreshRookChoice(planned,
    {...actual,executionSpin:'mini'}),false);
  assert.equal(sameForecastAsFreshRookChoice(planned,
    {...actual,placement:{piece:'t',
      cells:[[5,20],[5,18],[4,19],[4,20]]}}),false);
  assert.equal(sameForecastAsFreshRookChoice({...planned,useHold:true},
    {...actual,holdCount:1}),true);
  assert.equal(sameForecastAsFreshRookChoice(planned,
    {placement:null,holdCount:0}),false);
});
