// Matched six-lock real-authority ablation, with seed selection fixed
// BEFORE looking at success/failure: the first N positive seeds whose
// initial T is exactly the last publicly visible preview (NEXT5).
// No cherry-picked successful TSD boards or future-bag access by ROOK.
import {Engine} from '../src/engine.js';
import {BotDemo} from '../src/analysis/demo.js';
import {chooseMove} from '../src/analysis/rook.js';

const count=Number(process.env.OPEN_COHORT_SIZE??12);
const maxSeed=Number(process.env.OPEN_SCAN_SEEDS??250);
if(!Number.isInteger(count)||count<1||count>40||
  !Number.isInteger(maxSeed)||maxSeed<1||maxSeed>100000)
  throw Error('invalid opening cohort configuration');
const make=seed=>new Engine({mode:'tl',seed,
  rules:{g:0,spinbonuses:'all-mini+',b2bcharge_base:3}});
const params={depth:4,beamWidth:24,maxNodes:6000,maxStates:1200,
  includeRanked:true,reverseOpenMaxGoals:8,
  reverseOpenMaxTileNodes:1200,reverseOpenMaxProofs:12};
const seeds=[];
for(let seed=1;seed<=maxSeed&&seeds.length<count;seed++){
  const e=make(seed),known=e.state.piece.type+e.state.bag.queue.slice(0,5).join('');
  if(known.indexOf('t')===5)seeds.push({seed,known});
}
if(seeds.length!==count)throw Error('too few precommitted eligible seeds');

function run(seed,reversePlanner){
  const engine=make(seed),original=engine.serialize();
  const demo=new BotDemo(engine,{placementMode:'atomic'});
  let pieces=0,tsd=0,holds=0,spentMs=0,reversePlans=0,
    reverseChoices=0,attempts=0;
  while(pieces<6&&!demo.view().stopped){
    let placed=false;
    for(let tryHold=0;tryHold<2&&!placed;tryHold++){
      const {visible,revision}=demo.view();
      if(visible.next.length!==5)throw Error('NEXT5 contract violated');
      const started=performance.now();
      const decision=chooseMove(visible,{...params,reversePlanner});
      spentMs+=performance.now()-started;
      reversePlans+=decision.diagnostics.reversePlans??0;
      reverseChoices+=Number(decision.diagnostics.reverseSelectedGoal!==null);
      let accepted=false;
      for(const a of decision.ranked){
        const result=a.kind==='hold'
          ?{action:{kind:'hold',mode:a.mode,samePiece:a.samePiece,
            requiresReanalysis:true}}
          :{action:{kind:'place'},move:a.move,execution:a.execution};
        attempts++;
        try{
          demo.prepare(result,revision);
          demo.commit(revision);
          if(a.kind==='hold')holds++;
          else{
            pieces++;placed=true;
            const last=demo.view().lastPlacement;
            if(last.piece==='t'&&last.spin==='full'&&last.lines===2)tsd++;
          }
          accepted=true;break;
        }catch{/* Try a ranked alternative under canonical Tetrp authority. */}
      }
      if(!accepted)throw Error('No accepted move for seed '+seed);
    }
    if(!placed)throw Error('Post-Hold placement missing on '+seed);
    if(engine.serialize()!==original)throw Error('original replay was mutated');
  }
  if(pieces!==6||demo.view().stopped)throw Error('Incomplete opening on '+seed);
  const a=demo.engine.state.attack.totals;
  const board=demo.engine.state.board;
  const top=Math.max(...Array.from({length:board.width},(_,x)=>{
    const first=board.rows.findIndex(row=>row[x]!==null);
    return first<0?0:board.rows.length-first;
  }));
  return {pieces,tsd,holds,generated:a.generated,sent:a.sent,
    sentAPP:Number((a.sent/6).toFixed(4)),reversePlans,reverseChoices,
    attempts,topHeight:top,searchMs:Math.round(spentMs),
    sourceUnchanged:engine.serialize()===original};
}
const matched=[];
for(const {seed,known} of seeds){
  const ordinary=run(seed,false),reverse=run(seed,true);
  const pair={kind:'paired-real-authority-opening',seed,known,ordinary,reverse};
  matched.push(pair);console.log(JSON.stringify(pair));
}
const sum=(arm,metric)=>matched.reduce((n,x)=>n+x[arm][metric],0);
const summary={kind:'rooks-open-cohort-summary',
  selection:'first N integer seeds, T exactly sixth among Current+NEXT5',
  size:matched.length,placedPerArm:matched.length*6,
  baseGenerated:sum('ordinary','generated'),
  expertGenerated:sum('reverse','generated'),
  baseSent:sum('ordinary','sent'),
  expertSent:sum('reverse','sent'),
  baseTSD:sum('ordinary','tsd'),expertTSD:sum('reverse','tsd'),
  expertSearchMs:sum('reverse','searchMs'),
  baseSearchMs:sum('ordinary','searchMs'),
  expertChoices:sum('reverse','reverseChoices'),
  scoredKO:false,
  note:'Conditional six-lock opener only, with extra tactical CPU, not full-game APP or KO proof'};
console.log(JSON.stringify(summary));
