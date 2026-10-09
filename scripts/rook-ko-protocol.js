// Shared KO acceptance contract for ROOK vs baseline and pinned Kiwi.
// Seeds identify independent paired trials. BOTH slots in a trial use that
// exact seed, and both choose from the same pre-lock match tick.
export function parseMatchSeeds(env=process.env){
  const raw=env.SEEDS??[env.SEED_A??'1',env.SEED_B??'8'].join(',');
  if(typeof raw!=='string'||!raw.trim())throw Error('No KO seeds');
  const tokens=raw.split(',').map(x=>x.trim());
  if(tokens.length>16||tokens.some(x=>!/^[-+]?\d+$/.test(x)))
    throw Error('Invalid paired KO seed list');
  const seeds=tokens.map(Number);
  if(seeds.some(x=>!Number.isSafeInteger(x))||
    new Set(seeds).size!==seeds.length)
    throw Error('KO seed list must contain distinct safe integers');
  return seeds;
}

export function assertSimultaneousPair(demos){
  if(demos.length!==2)throw Error('Paired KO needs two authorities');
  const states=demos.map(d=>d.engine.state);
  if(states[0].frame!==states[1].frame)
    throw Error('Paired KO battle clocks diverged');
  return states[0].frame;
}

export function assertMatchingOpening(demos){
  assertSimultaneousPair(demos);
  const views=demos.map(d=>d.view().visible);
  if(views[0].current.type!==views[1].current.type||
    JSON.stringify(views[0].next)!==JSON.stringify(views[1].next))
    throw Error('Paired KO players did not start from identical bag seed');
}

export function scoreKO({alive,rounds,cap,error=null}){
  if(!Array.isArray(alive)||alive.length!==2||
    !Number.isInteger(rounds)||rounds<0||
    !Number.isInteger(cap)||cap<1)
    throw Error('Invalid KO result inputs');
  const scored=!error&&alive[0]!==alive[1];
  const winnerSlot=scored?(alive[0]?0:1):null;
  // KO on the *last allowed simultaneous turn* is still a KO, not capped.
  const termination=error?'invalid-match':scored?'KO':
    alive.every(x=>!x)?'double-KO':rounds>=cap?'capped':'unresolved';
  return {scored,winnerSlot,termination};
}
