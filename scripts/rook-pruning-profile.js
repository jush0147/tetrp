// Compare intermediate beam shaping at EXACTLY matched search capacity.
// Uses the same public observations for both policies; this is NOT KO.
// A fixed 6000-evaluation baseline advances each authority to reproducible
// player-visible positions; each budget analyzes the SAME immutable snapshot.
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {chooseMove} from '../src/analysis/rook.js';
import {actionSignature} from '../src/analysis/rook-disagreement.js';
import {parseMatchSeeds} from './rook-ko-protocol.js';

function integers(raw,max,kind){
  if(!raw||typeof raw!=='string')throw Error('Missing '+kind);
  const tokens=raw.split(',').map(s=>s.trim());
  if(!tokens.length||tokens.length>max||tokens.some(s=>!/^\d+$/.test(s)))
    throw Error('Invalid '+kind);
  const values=tokens.map(Number);
  if(values.some(n=>!Number.isSafeInteger(n))||new Set(values).size!==values.length)
    throw Error('Duplicate or invalid '+kind);
  return values;
}
const seeds=parseMatchSeeds({SEEDS:process.env.SEEDS??'1,8,16,23'});
const variants=[
  {id:'original-pruning',budget:24000,depth:5,beamWidth:48,relief:0},
  {id:'setup-survival',budget:24000,depth:5,beamWidth:48,relief:0.65},
];
const turns=integers(process.env.SAMPLE_TURNS??'0,4,12',12,'sample turns');
if(turns.some(n=>n>120))
  throw Error('Profile sample turn out of range');
const advanceOptions={depth:4,beamWidth:24,maxNodes:6000,
  maxStates:1200,maxSteps:42,includeRanked:true,reverseOnlyOpen:true};
function makeDemo(seed){
  return new BotDemo(new Engine({mode:'tl',seed,
    rules:{g:0,gincrease:0,b2bcharge_base:3},
    handling:{arr:0,das:1,dcd:0,sdf:20,safelock:false,cancel:false,
      may20g:true,irs:'off',ihs:'off'}}),{placementMode:'atomic'});
}
function advanceOne(demo){
  for(let phase=0;phase<2;phase++){
    const {visible,revision}=demo.view();
    const report=chooseMove(visible,advanceOptions);
    let held=false;
    for(const a of report.ranked){
      const request=a.kind==='hold'
        ?{action:{kind:'hold',mode:a.mode,samePiece:a.samePiece,requiresReanalysis:true}}
        :{action:{kind:'place'},move:a.move,execution:a.execution};
      try{demo.prepare(request,revision)}catch{continue}
      if(a.kind==='hold'){
        if(phase!==0)throw Error('Invalid second Hold');
        demo.commit(revision);held=true;break;
      }
      demo.commit(revision);
      return;
    }
    if(!held)throw Error('No Tetrp-authority-executable profile placement');
  }
  throw Error('Missing placement after profile Hold');
}
const positions=[];
for(const seed of seeds){
  const demo=makeDemo(seed),maxTurn=Math.max(...turns);
  for(let turn=0;turn<=maxTurn&&!demo.view().stopped;turn++){
    if(turns.includes(turn)){
      const publicState=demo.view().visible;
      if(publicState.next?.length!==5||'bag' in publicState||'holes' in publicState)
        throw Error('Profile received hidden or incomplete public information');
      positions.push({seed,turn,visible:publicState});
    }
    if(turn<maxTurn)advanceOne(demo);
  }
}
for(const {seed,turn,visible} of positions){
  const frozen=JSON.stringify(visible),samples=[];
  for(const variant of variants){
    const {budget,depth,beamWidth,relief}=variant;
    const started=performance.now();
    const r=chooseMove(visible,{...advanceOptions,maxNodes:budget,
      depth,beamWidth,intermediateHoleRelief:relief,
      traceRootSurvival:true});
    const elapsedMs=performance.now()-started;
    if(JSON.stringify(visible)!==frozen)
      throw Error('ROOK budget variant mutated the public observation');
    const diag=r.diagnostics;
    if(diag.evaluated>budget||diag.evaluated<1)
      throw Error('Invalid accounting: '+diag.evaluated+' of '+budget);
    samples.push({variant:variant.id,budget,depth,beamWidth,relief,
      evaluated:diag.evaluated,
      utilization:diag.evaluated/budget,reachedBudget:diag.evaluated===budget,
      effectiveDepth:diag.effectiveDepth,beamWidth:diag.beamWidth,
      rootCount:r.ranked.length,
      beamRootsByPly:r.rootSurvival.map(p=>p.roots.length),
      choice:actionSignature(r),score:r.diagnostics.value,
      ms:Math.round(elapsedMs),
      futureProbes:diag.futureProbes,spinProbes:diag.spinProbes});
  }
  process.stdout.write(JSON.stringify({
    format:'rook-setup-survival-position-response/1',
    seed,turn,frame:visible.frame,piecesPlaced:visible.piecesPlaced,
    positionKind:visible.hold?.piece==null?'empty-hold':'occupied-hold',
    baseline:6000,samples})+'\n');
}
