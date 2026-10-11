// Gate real-authority short matches WITHOUT treating capped results as wins.
// Kept in a .js module so Node can syntax-check it before expensive matches.
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';

const file=process.env.STRATEGIC_SCREEN_IN??'strategic-screen.jsonl';
const rows=readFileSync(file,'utf8').trim().split('\n')
  .filter(Boolean).map(JSON.parse);
if(rows.length!==2||rows.some(r=>r.error||r.cap!==80||
  !r.sameSeed||r.swapRoles!=='0'||!r.expertStrategic||
  !r.compareReactiveStrategy||r.strategicCommitLocks!==3||
  r.slots.length!==2||r.slots.some(s=>
    s.configuredNodeBudget!==3000||
    !['public-strategic-intent','reactive-strategic-intent']
      .includes(s.kind))||
  r.identicalPublicDecisionChecks<1||
  r.slots.some(s=>s.intentDecisions<1)))
  throw Error('Invalid true public equal-node strategy comparator');
const report={
  format:'rook-sticky-vs-reactive-first-choice-screen/1',
  independentSeeds:2,scored:false,cap:80,
  pairedSamePublicDecisionChecks:rows.reduce((n,r)=>
    n+r.identicalPublicDecisionChecks,0),
  samePublicChangedFirstChoices:rows.reduce((n,r)=>
    n+r.identicalPublicActionChanges,0),
  exactPublicMatchFirstDivergenceBySeed:rows.map(r=>({
    seed:r.seed,turn:r.firstIdenticalPublicActionDifference})),
  objectiveSwitchesBySide:rows.map(r=>r.slots.map(s=>({
    kind:s.kind,switches:s.intentSwitches,
    interruptedForDanger:s.intentEmergency,
    retainedForCommitment:s.intentRetained,
    protectedLocks:s.intentProtect,
    attackLocks:s.intentAttack,
    searches:s.searches,cpuMs:s.ms,
    authoritySent:s.sent,authorityTanked:s.tanked}))),
  warning:'80-lock short games NOT scored. This is decision-mechanism coverage only, not a stronger bot.'};
writeFileSync(process.env.STRATEGIC_SCREEN_OUT??'strategic-screen-summary.json',
  JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,
  'changed='+(report.samePublicChangedFirstChoices>0?'true':'false')+'\n');
console.log(JSON.stringify(report));
