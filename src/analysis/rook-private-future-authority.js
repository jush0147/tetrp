// AUTHORITY-ONLY research fixture. NEVER import into a bot/selector.
// Condition on exactly the original PUBLIC CURRENT/HOLD/NEXT5, board,
// attack packet timings, clock and rules. Vary only unseen queue order
// within existing 7-bag boundaries and future refills / garbage-hole RNG.
// This samples conditional private futures; the scenarios sharing one
// public position are NOT independent match seeds.
import {seedState,random} from '../random.js';
import {visibleState} from './visible-state.js';

const BAG=new Set('zlosijt');
const toKey=v=>JSON.stringify(v);
export function sampleConditionalPrivateFuture(engine,{
  seed,scenario,side=0,visibleBaseline=null}={}){
  if(!Number.isSafeInteger(seed)||!Number.isSafeInteger(scenario)||
    scenario<0||scenario>10000||!Number.isInteger(side)||
    ![0,1].includes(side))throw Error('Invalid conditional private scenario');
  const state=engine.state;
  const before=toKey(visibleState(state));
  if(visibleBaseline!==null&&before!==toKey(visibleBaseline))
    throw Error('Fork does not share the original public position');
  if(scenario===0)return {changed:false,scenario,
    publicIdentical:true,unseenPermutationCount:0};
  const bag=state.bag;
  if(!bag||!Array.isArray(bag.queue)||bag.queue.length<5||
    !Number.isInteger(bag.bagId)||bag.bagId<1)
    throw Error('Not a genuine authority seven-bag queue');
  const used=7*bag.bagId-bag.queue.length;
  if(used<0||bag.queue.some(k=>!BAG.has(k)))
    throw Error('Invalid authority seven-bag boundary');
  const seedNum=(seed*1009+scenario*100003+side*7919);
  if(!Number.isSafeInteger(seedNum))throw Error('Scenario seed overflow');
  const orderRng=seedState(seedNum);
  let modified=0;
  // The already-consumed prefix of the first bag is not in queue.
  // Bag boundaries remain exact, and shuffling only an UNREVEALED
  // subset of each bag preserves both seven-bag validity and NEXT5.
  for(let begin=0;begin<bag.queue.length;){
    const span=Math.min(7-((used+begin)%7),bag.queue.length-begin);
    const firstUnseen=Math.max(begin,5),end=begin+span;
    for(let i=end-1;i>firstUnseen;i--){
      const j=firstUnseen+Math.floor(random(orderRng)*(i-firstUnseen+1));
      if(i!==j){
        [bag.queue[i],bag.queue[j]]=[bag.queue[j],bag.queue[i]];
        modified++;
      }
    }
    begin=end;
  }
  bag.rng=seedState(seedNum+1777);
  // Existing packet payloads and known hole history stay untouched.
  // Only subsequent unknown hole draws may differ.
  state.holes.rng=seedState(seedNum+7919);
  if(toKey(visibleState(state))!==before)
    throw Error('Conditional private scenario changed public CURRENT/NEXT5');
  return {changed:true,scenario,publicIdentical:true,
    unseenPermutationCount:modified};
}
