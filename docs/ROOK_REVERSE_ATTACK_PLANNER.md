# ROOK reverse attack planner: design, continuation checkpoint

Status: **M4 measured paired KO: the optional TSD opener loses to baseline ROOK; garbage-aware safe mode added, not promoted**.
The independent prototype now feeds forward-proven Full TSS/TSD/TST
continuations into the real ROOK decision when the caller sets
reversePlanner:true. New tests cover the actual change of chosen root.
It is deliberately off by default until normal-play APP and KO improve. It plans constrained 0-2 setup-ply sequences
ending in Full TSS/TSD/TST only, with no Hold-dependent line shifts or
unknown pieces. An inverse target tracks both row completion *and corner /
roof support* for a genuine Full T spin. Every proposed route is
forward-checked with Tetrp's SRS+ move generator and canonical attack
projection; the `actualAuthorityExecuted` marker stays false until
BotDemo really commits it. The tests execute 2-ply O -> TSD,
2-ply O -> Full TSS, and 3-ply I -> O -> TSD atomically under Tetrp.
Avoid presenting these crafted puzzles as a natural-game TSD breakthrough.
Owner repo: `jush0147/tetrp`, working branch: `feat/rook-independent-bot`,
draft PR: https://github.com/jush0147/tetrp/pull/6 .
Updated: 2026-10-08. **This document is the handoff entrypoint when chat context is lost.**

## User goal (authoritative product intent)

Build an **independently implemented, genuinely strong, Tetrp-native bot**, not a
retuned Cold Clear 2 / Kiwi. It must understand modern Tetris attack: Full
**T-Spin Single (TSS)**, **Double (TSD)** and **Triple (TST)** are distinct
from **T-Spin Mini** (single/double); Tetrp's **all-mini+** allows other
piece types' Mini spins. It must select among spins, Tetris, B2B, Surge,
Combo, garbage downstack and All Clear according to *real battle value*.

User's evaluation principle: **high APP does not imply a strong bot, but a
strong bot must sustain high APP**. Measure both *generated APP* and *sent
APP* alongside *survival, actual KO results* and attack-chain continuity.
Do not optimize just for TSD count or for a pretty empty board.

**Highest-priority fairness requirement:** the bot sees exactly what a
player sees *at the moment of the decision*. Current, Hold/lock state,
**exactly NEXT 5**, own board and public observable attack/garbage/rules.
Never read private bag/RNG, a sixth next, replay future, actual opponent
future decisions/board, or hidden garbage columns. Explicit Hold is executed
by Tetrp and requires a **fresh visible snapshot** before deciding again.
Existing `visibleState()`, `rook-session.js`, and visibility regressions
are the integration contract; preserve them.

**Important correction by user:** if a target piece position/Spin has a
**legal, SRS+-reachable path**, the Bot may submit the final pose directly.
It does **not** need to execute the keypresses within 24 frames or emulate
each key in battle. The 24-frame / piece cadence is only the *match clock*
for packet timing, multiplier and PPS. Use Tetrp as authority for legal
route (including kick / last rotation / earned Spin), the final lock, clear,
attacks and rules. Do NOT reject a legal path due to button timing. Keep
Kiwi pinned mode unaffected on production.

## Current verified baseline, not a victory claim

- ROOK core: `src/analysis/rook.js`; separate SRS+ move-generation, root BFS
  and beam search; speculative preview spin search; `src/analysis/rook-tsd.js`
  detects near two-line T-slots but it is *not* a general builder from open board.
- Authority attack projection: `src/analysis/rook-combat.js` calls the
  same canonical `src/attack.js:resolveAttack()` as Tetrp; do not recreate
  approximate TSD/B2B/Surge/garbage scoring.
- Real authority / demo: `src/analysis/demo.js` has experimental atomic
  legal-pose mode; `test/rook-atomic.test.js` tests >24 legal operations and
  fake spins; `test/rook-tsd.test.js` has a constructed **O -> Full TSD**
  case. This **does not prove** natural play reaches TSD consistently.
- Last natural fixed-seed screen: seeds **67020** and **67021**, 120 pieces
  each: **0 TSD / 240 pieces**, TSS 1, T-mini 3, 15 all-piece spin clears;
  attack 58 + 62 = **120 generated** (0.50 APP), with ~300ms per piece
  in prior run. Real benchmark script: `scripts/rook-strength-screen.js`.
  Some later code may change this; **rerun after each algorithm change**.
- Last full 4-match synchronous Tetrp KO against pinned Kiwi: **ROOK 0-4**,
  unequal node budgets (ROOK 6,000, Kiwi 200,000). Run:
  `scripts/rook-vs-kiwi.js`, workflow `.github/workflows/rook-ko.yml`.
  Do not claim equal-strength from this or conflate CLI APP with KO.
- Full unit/ROOK/browser tests previously passed on relevant revisions.
  A past green CI does **not** certify any new commit. Check exact SHA and
  latest run before reporting. Production `main` remains unchanged.

## Hypothesis: why normal forward beam search fails

1. Creating an overhang, hole or elevated roof necessary for a future T-Spin
   often looks bad to a generic height/holes evaluator.
2. Fixed beam width drops these temporary setup states before the T piece
   arrives, even if the future attack repays the cost.
3. A superficial T-slot-shaped hole is **not** proof the intended Spin can
   be rotated into place. Previous speculative Spin bonuses inflated APP
   predictions and reduced real performance.
4. A generic search can generate huge numbers of harmless Hard Drops but very
   few intentionally constructed TSS/TSD/TST/mini targets. More beam width
   alone is not an adequate architectural answer.

## Planned architecture: generate attack goals, then prove the construction

### 1. Goal generator (backward from attack)

Generate geometry-grounded attack targets on the **observed** board:

- Full TSS / TSD / TST: possible last T positions, line signatures,
  kick/last-rotation-dependent Full classification, residual board.
- T-Mini Single/Double and all-mini+ clears for all eligible piece types;
  never combine Full TSS and Mini Single into one class.
- Ordinary Tetris, B2B-preserving spin/quad, all-clear and garbage-downstack.
- Consider both *offensive* targets and *defensive* targets as live
  candidates; no blanket preference for TSD.

For each target compute the **necessary pre-lock cells**. Build a compact
scaffold descriptor: target piece, rotation, two/three target rows, required
occupied/empty support cells, possible entry corridor, and the *difference*
between current surface and scaffold. This is a geometric lower bound, **not
an executable plan or a guaranteed Spin**.

### 2. Reverse construction search

From one grounded scaffold, find placements of only **known** Current, Hold
and NEXT 5 that could supply the required support cells. Use inverse
placement templates / constraint satisfaction or backward chaining to
rank short 2- and 3-placement construction sequences. Support *temporary
holes and non-flat stacks* as long as eventual authority verification
succeeds. Maintain a separate tactical candidate pool so generic smooth
board scores cannot prune these roots prematurely.

**Important:** Reverse search can generate *hints* using required cells, but
every candidate must be replayed **forward** from the original visible
snapshot through Tetrp-valid moves. Never reverse a bag, manufacture a
missing T, assume NEXT 6, or postulate a later Hold draw. If Hold is needed
*now*, return a standalone Hold action and replan on the newly visible
snapshot.

### 3. Forward verification and combat evaluation

- For every surviving proposed root action: prove SRS+ reachability, exact
  end-pose/cells, final legal rotation, and Tetrp spin classification.
- For every hypothetical intermediate future placement: verify on the
  hypothetical board; execution is **never assumed** until its turn is
  current and the authority receives a fresh visible snapshot.
- Simulate committed clears and public combat state with Tetrp board and
  attack authority. Count real Full TSS/TSD/TST separately from Minis,
  other-piece Mini, Quad and All Clear; accurately carry Combo, B2B
  (including allclear_b2b), surge, packet cancellation and incoming
  danger. Preserve public-frame/ARE behavior in actual rollout.
- Return a root action with a **reason/evidence** (goal, setup length,
  validated next Spin if already known), but avoid *granting* score
  to a shape alone.

### 4. Search arbitration, not TSD tunnel vision

Maintain explicit search portfolios:
  1. Spin planner (TSS/TSD/TST/Mini, including non-T spin lines)
  2. Attack planner (Quad/Combo/All Clear)
  3. B2B planner (continuation vs strategic Surge cash-out)
  4. Survival/downstack planner (counter known incoming, cap height)

Compare completed *paths*, not just one-turn shape scores. Multi-objective
ordering should consider generated attack, **sent attack**, danger/KO
risk, B2B continuity, useful remainder, and execution feasibility.
Use hard gates against death/hidden information violations.
A high-APP strategy that reliably suicides is **not** stronger.

### 5. Possible learning component later, not prerequisite now

Once verified tactical examples and high-quality self-play exist:
value/policy network can rank and retain promising scaffold/board plans.
Do **not** train immediately on 0.5 APP ROOK rollouts and market it as
learning strong Tetris. The authority and legality checks remain external.

## First prototype: small, falsifiable, test-driven experiment

**Milestone M1, reverse planner library with opt-in beam integration (implemented, not promoted):**
`src/analysis/rook-reverse-planner.js` (experimental). Input strictly
`{board, current, hold, next[5], rules, combat-visible-fields}`.
Output grounded construction candidates with `goal`, `root`,
`intermediate`, `routeWitnesses`, `clear`, `scoredAttack`,
`verified` and bounded `searchStats`. Begin with Full TSS/TSD (not only
TSD), then TST and Mini as variants of the same mechanism.
Do not claim `verified:true` for unexecuted hypotheses.

**Milestone M2, challenge suite:** New `test/rook-reverse-planner.test.js`
should include:
- A reachable TSS that is not Mini, TSD and (when feasible) TST, with
  exact Tetrp clear/attack classification.
- A genuine **2-step** construct-then-Full-TSD (existing O->TSD fixture),
  plus at least one **3-step** near-empty construction puzzle.
- An impossible overhang, a false Spin despite same final cells, and a
  T-Mini vs Full TSS separation.
- Multiple equal-looking routes where normal hole-penalty beam discards the
  necessary setup, but reverse planner retains it.
- Hidden NEXT/RNG injected into direct API input cannot alter the output.
  Hold never predicts what is revealed next before authority executes it.
- Atomic placement works for >24-input legal witness; attack/garbage
  calculations match `resolveAttack()`. Original replay checkpoint unchanged.

**Milestone M3, measured ablation:** compare forward-beam ROOK with and
without goal-planner on **same seeds and equal budgets**, record:
`TSS`, `TSD`, `TST`, `T-Mini`, other Mini/Full spins by piece/lines,
`quads`, `generatedAPP`, `sentAPP`, `peakB2B`, `topout`,
node budget and actual elapsed milliseconds. First screen >=2 fixed seeds
and 120 placements each, then broaden seed/sample size before celebrating.
Run paired synchronous **KO vs previous ROOK**, then **KO vs Kiwi** with
seed and slot swap. Distinguish capped/unscored from real KO.

### Abandon / revise criteria

- Prototype finds crafted Spin targets but produces 0 real TSD in normal
  play, or fails to beat no-planner baseline on real attack or survival:
  **do not promote**; investigate goal preimage reachability, root retention,
  tactical horizon and goal arbitration.
- Any hidden-piece peek, forged spin, erroneous attack simulation, invalid
  locked placement or source replay mutation is a hard failure, regardless
  of APP gains.
- No merge to `main` until regression suite, browser feature checks and
  representative paired KO benchmark are reviewed. No claim of world-best.

## Paired real-authority M1 result and promotion decision

The inverse module now adds grounded Full TSS/TSD/TST setup prefixes to a
reserved tactical beam portfolio inside ROOK's actual decision function.
Every candidate is forward-reachable under SRS+, and only the canonical
Tetrp attack projection awards points. A temporarily ugly overhang cannot
be pruned simply because generic surface features dislike it. The module
does not read the hidden bag, RNG, opponent private state, or NEXT6.

The integration is explicitly opt-in (reversePlanner:true). Reverse setup
candidate work was initially subtracted from the regular beam budget.
That caused a regression: in the first long-horizon A/B, generated attack
fell from 120 to 113 across two seeds, and TSD remained zero. We changed
this research implementation to **preserve the entire ordinary beam budget**
when optional reverse search runs; additional reverse BFS work is counted
and timed separately. This is **equal regular search nodes, NOT equal
total compute**. Future promotion must justify the additional CPU cost
and show genuine APP / KO improvement.

The new integration regression proves that enabling the planner actually
changes a constructed O setup, which Tetrp can follow with genuine Full
TSS or Full TSD. It also proves disabled-by-default, hidden-state
invariance, and legal atomic landing. See the integration test file.

**Measured experiment at fdd09db8**: two real Tetrp seeds, 120 pieces per
seed, matched visible previews and regular 6,000-node search budget.
https://github.com/jush0147/tetrp/actions/runs/37802038139

| Metric, both seeds | Baseline OFF | Inverse goals ON |
| --- | ---: | ---: |
| Generated attack | 120 | 120 |
| Full TSD | 0 | 0 |
| Full TSS | 1 | 1 |
| Tactical plans proposed | 0 | 7 |
| Tactical plans selected | 0 | 0 |

Per-seed average decision timing was noisy and provides no robust speed
improvement claim. **Natural-play strength is unchanged.** This experiment
does **not** justify enabling reverse goals by default or claiming higher
APP or KO strength.

A local 40-piece diagnostic found a reachable Full TSS offer that scored
36.87 points *below* the ordinary completed line. Its projected stack
height was eight rows instead of six, for just two lines of sent attack.
Rejecting this route was rational; artificially rewarding every possible
T-Spin would make the bot weaker.

**Next research milestone:** generate useful T-Slots from comparatively
open boards by reasoning across four or five known setup pieces and a
known T, within Current+NEXT5. Add public Hold branches with authority
reanalysis, and permit row-shifting intermediate clears with exact
forward verification. Compare attack versus top-out risk as a Pareto
portfolio, then use genuine paired KO rather than spin count to decide
whether the new planner should be promoted.

## Prototype discovery: spin-corner support is part of the inverse goal

The originally proven O -> Full TSD fixture has **no missing target-row
support cells** before O is placed. The O's useful contribution is the
**roof/corner blocker** enabling full T-spin classification and access.
Any inverse planner that only tracks "empty cells in rows cleared by T"
misses this valid TSD. That is why M1 also derives Tetrp's T-corner
obligations using the public `spins.json` geometry; it verifies final
spin and reachability afterward, not by guessing that the corner pattern
guarantees it.

For a nontrivial 3-ply fixture, remove row-37 cells x=6..9 from the
near-complete O -> TSD puzzle. Known sequence **I -> O -> T**:
I fills the four row cells; O makes the missing roof; T performs Full TSD.
This is the first real backward-derived proof path and test.

**Known limitations:** M1 restricts intermediate setup placements to
zero-line clears (no row reindexing), uses a bounded support-target scan,
considers a T within the first 3 known pieces (Current + NEXT), and
does not plan Hold swaps or general empty-board openers yet. It is available only as an opt-in ROOK search module, and its latest
natural-play A/B showed **zero decisions selected and no APP benefit**.
Do not promote it by default. M2 must lift these constraints one at a time.

## M2: bounded 4-6 visible-piece reverse construction (2026-10-09)

**Implemented in an opt-in experimental module**, not promoted to default:
`src/analysis/rook-long-planner.js`. When the first known T occurs at
index 3, 4 or 5 of the public `[Current,...NEXT5]` sequence, the module:

- Enumerates concrete Full TSS/TSD target rows and corner/roof constraints,
  avoiding T's final cells throughout the setup.
- Uses bounded, goal-conditioned SRS+ placement search; each setup move must
  reduce unmet row/corner support and leave enough remaining tetromino cells.
  The two-row TSD targets get priority so easier TSS shapes cannot consume
  the entire inverse-goal budget.
- Rejects intermediate clears for now because row coordinates would shift.
  Finally proves a real reachable Full T spin and exact clear count, and
  values the *actual* attack through Tetrp's canonical combat projection.
- Provides explicit node/candidate counters and returns witness paths. Only
  `reversePlanner:true` triggers it. Defaults have bounded 600 setup
  candidates; deeper crafted tests deliberately request a higher budget,
  so such proofs are **not** evidence of affordable natural-play strength.
- Extends the regular ROOK comparison horizon only if a fully proven tactical
  path exists, never beyond the six pieces presently visible.

**Authority regression examples** in `test/rook-long-planner.test.js`:

- Four locks **I -> I -> O -> Full TSD**: fills two 4-cell holes in the
  planned TSD rows, then builds the Spin roof before T.
- Five locks **J -> I -> I -> O -> Full TSD**: additional missing left
  support makes the J an essential earlier setup.
- Both independently replan after each real atomic placement, still finish
  with Full T-Spin Double, two-line clear and canonical B2B/attack (5 lines
  in this fixture due to the garbage-row bonus).
- Private RNG, opponent future, hidden sixth preview and invalid goals
  must not influence or fabricate a plan. Original replay bytes unchanged.

**Historical limitation of the older rook-long-planner module:** its
four/five-piece demonstrations use artificially prebuilt garbage support.
A separate exact-cover opening module now proves genuine seven-bag
empty-board Full TSD below. The broader bot still lacks robust Hold
reshuffling, intermediate row-shift planning, real incoming-garbage
forecast, and sustained B2B/Surge chains.

**Latest honest paired natural-play A/B** (fixed seeds 67020 and 67021,
120 placements each, same full ordinary ROOK search nodes, reverse-goal
CPU added and separately counted):
https://github.com/jush0147/tetrp/actions/runs/37854589783

| Metric | Ordinary ROOK | Optional long inverse goals |
| --- | ---: | ---: |
| Actual generated attack | 120 | 120 |
| Full TSD | 0 | 0 |
| Full TSS | 1 | 1 |
| Reverse plans offered | 0 | 7 |
| Reverse plans actually chosen | 0 | 0 |
| Per-piece mean search ms, seed 67020 | 325 | 587 |
| Per-piece mean search ms, seed 67021 | 311 | 568 |

The safeguard **restored baseline APP**, but paid an extra 31,805 and
34,341 reverse setup candidate examinations on the two seeds. That
overhead is not acceptable without better attacks or wins. The long
planner therefore **remains disabled by default**. It has not met the
strong-bot objective, despite passing constructed proofs.

The promotion gate remains real paired normal-play TSD/APP/B2B/KO evidence
with search-time disclosure. Full integration and measured A/B are tracked
at Issue #7 and draft PR #6, not silently shipped.

### Long-horizon A/B hazard discovered in development

[Earlier reverse-long A/B](https://github.com/jush0147/tetrp/actions/runs/37854074939)
on the two canonical 120-piece seeds reported **120 -> 113 generated**
and **0 -> 0 Full TSD** when extra goal candidates cannibalized ordinary
search nodes. Mean per-decision time rose substantially. The reduction
was not a rules bug; it was the tactical planner starving the baseline
beam of search candidates, even when it never produced a selected goal.

After isolating separate regular and tactical search budgets, unproductive
inverse probes must leave the ordinary move unchanged. This is enforced
in `test/rook-long-planner.test.js`. The cost is more CPU; a candidate
with identical APP but extra time is still **not an improvement**.

## M3: real seven-bag Full TSD from an EMPTY board (2026-10-09)

**This is a true tactical ability gain, not yet a strong-bot promotion.**

New experimental code: `src/analysis/rook-open-slot.js`.
It constructs a target Full TSD via an inverse exact-cover of two clear
rows and the required Spin roof/corners. It uses ONLY the 1-5 setup
pieces explicitly visible before a known T in Current+NEXT5. A
low-stack board with no garbage may be reconsidered after each actual
lock. The solver searches legal polyomino tilings, then verifies
every setup in real public SRS+ move/rotation geometry, *in the actual
known order*. It confirms a last-rotation Full T spin is reachable
and clears two lines. The tentative goal NEVER receives imaginary
attack credit; the actual BotDemo/Engine.lock is authoritative.

A cheap proof for simple spawn rotation+shift+Hard Drop avoids excessive
BFS on unpromising geometric tilings. Expensive operations are bounded
(maxGoals=8, maxTileNodes=1200, maxProofs=12 by default). The
`chooseMove` integration is available ONLY via opt-in
`reversePlanner:true`; `reverseOnlyOpen:true` isolates it from older
experimental inverse planners for fair benchmarking. The ordinary
ROOK beam is never robbed of its baseline node allocation. It remains
**OFF by default**. Opponent packet arrival is not predicted across
the full six-piece tactical line, so reevaluation is essential.

**Actual naturally generated seven-bag example:** Tetrp seed
`39589`, initial visible `L, Z, I, J, S, T`. Starting
from **40 empty board rows**, the actual ROOK calls `chooseMove`
independently for every piece. It constructs a Full TSD at the sixth
lock, clears two rows, sends 4 attack lines, earns one B2B charge
and leaves its original authority replay checkpoint immutable. The
24-frame clock remains a battle cadence, **not a keypress limit**.
Other independently generated seeds (e.g. seed 1) also yield a Full
TSD. Tests: `test/rook-open-slot.test.js` (six new cases, plus all
existing TSS/TSD/long-planner regression tests).

**Pre-committed cohort, not cherry-picked winners.** The benchmark
`scripts/rook-open-cohort.js` enumerates integer seeds upward and takes
the first 12 whose public Current+NEXT5 has T *exactly sixth*, whether
or not the inverse solver succeeds. Both bots then play **six actual
Tetrp locks** from the same authority seed with independent legal
Hold decisions. Result:
https://github.com/jush0147/tetrp/actions/runs/37865579325

| Six-lock cohort (12 conditional seeds) | Original ROOK | Open-goal experiment |
| --- | ---: | ---: |
| Total locked pieces | 72 | 72 |
| Full TSDs | 0 | **6** |
| Actual generated/sent garbage | 0 | **24** |
| Combined decision CPU | 16.4 seconds | 33.9 seconds |

This is a **conditional** opener cohort. T in the sixth position is
approximately one out of seven initial seven-bag arrangements; these
12 seeds are NOT representative of the entire game, or of opponent
garbage, KO or sustained APP. The extra CPU is considerable.

**Full 120-piece follow-through**, isolated open expert enabled and
disabled on the same public seeds (same GitHub run):

| Seed | 120-piece ordinary ROOK | 120-piece open expert |
| --- | ---: | ---: |
| 1 | 64 generated / 0.5333 APP / 1 TSD | **61 generated / 0.5083 APP / 2 TSD** |
| 8 | 58 generated / 0.4833 APP / 0 TSD | 58 generated / 0.4833 APP / 0 TSD |

The open expert therefore demonstrably **improves tactical opening
capability**, but on seed 1 **reduces full-game APP** despite producing
an extra TSD; seed 8 remains unchanged while spending more CPU.
This is direct evidence that TSD count by itself does not define
strength. Neither 120-piece test is a scored KO. DO NOT merge or
enable by default, and do not claim it beats Kiwi.

**Regression fixed during integration:** originally the new expert
shadowed older short/long TSS/TSD specialists on garbage puzzle
boards, causing five existing tests to fail. The final routing now
restricts exact cover to low stacks **without garbage** and falls
back to existing specialists when it finds no verified opener.

**Next research priority:** use the resulting board and public B2B /
incoming garbage to choose *follow-through* attacks, not only a
6-piece spike. Compare post-TSD expected sent APP, peak stack,
B2B continuity, garbage downstack and actual KO with consistent
computing budgets; selectively trigger the expensive exact-cover
search or replace it with a faster policy/value guide. Expand to
Hold and row-clearing setup, while preserving the exact NEXT5
privacy contract.

## M4: real opponent pressure, B2B follow-through and KO results (2026-10-09)

The **next genuine strength gate is matched KO**, not producing a TSD
against an empty, non-attacking board. In the first real Tetrp TL
head-to-head script, `scripts/rook-vs-rook.js`, both independent
ROOK versions play with **real simultaneous garbage, cancellation,
B2B, Hold, ARE, 24-frame battle cadence and atomic legal SRS+ moves**.
Each reads only its own Current/Hold/NEXT5/public information.
The expert is explicitly opt-in; normal ROOK is unchanged. The
experiment swaps which side runs the expert on the same pair of
precommitted native engine seeds, 6k ordinary search-node budget
per decision, with **additional expert CPU separately disclosed**.
**A capped match is NOT scored as a win.**

Primary run:
https://github.com/jush0147/tetrp/actions/runs/37868068311

| Seed pair and swap | Termination | Winner | Expert APP | Baseline APP |
| --- | --- | --- | ---: | ---: |
| 16 vs 23, original slots | KO at lock 65 | Baseline | 0.4923 | 0.6000 |
| 16 vs 23, swapped slots | KO at lock 122 | Baseline | 0.7623 | 0.9672 |
| 1 vs 8, original slots | Capped at lock 150 | None | 0.7600 | 0.7933 |
| 1 vs 8, swapped slots | Capped at lock 150 | None | 0.7000 | 0.7800 |

**Actual scored result: 0 expert KO wins vs 2 baseline KO wins,
two matches capped/unscored**. Sample is too small for broad claims;
the measured result is NEGATIVE and does **not** justify enabling
the opener. A live garbage stream can change the board between
the first T-slot setup and the planned spin, and engine authority
is the only source of true cleared lines and KO.

**Safety fix (separate from strength improvement):**
`chooseMove` now retains the PUBLIC `visible.frame`, uses the
allowlisted pending packet's `activeFrame` and `active` bit to detect
if a packet will become eligible before a speculative no-clear
TSD setup finishes (24 match frames per piece). With the opt-in
`reversePressureGuard:true`, it declines such long speculative
goals and returns control to the ordinary search. This is conservative:
it does **not** invent hidden garbage columns or assert which exact
hole would arrive. It can be disabled only for controlled A/B
diagnostics. Three regression cases in `test/rook-pressure.test.js`
verify imminent packet gating, distant public packet non-gating,
and hidden-information invariance.

A small controlled **synthetic incoming-4-packet** scenario on natural
Tetrp seed 1 with 12 subsequent locks showed generated attack
2 -> 5 and peak stack 7 -> 6 when gating was enabled; seeds 23 and
39589 showed no measured change. This is not real match evidence;
it is a narrow scenario sanity check. The full KO remains the gate.

**Exploratory Perfect Clear continuation:** An inverse 4-piece
2-row PC exact-cover after the measured first TSD was checked
locally on several residual boards. No SRS+-certified path was
found for their next four public piece types. Even scanning 840
distinct four-piece orders against seed 1's four-cell TSD
residue yielded no zero-intermediate-clear geometric tiling.
This does **not** prove all PCs impossible; extra Hold,
intermediate clears or other board shapes are unsearched.
Therefore **no PC expert is being promoted or wired in**.
Avoid adding more specialists without genuine payoff.

**Next step for strength:** collect B2B break points, actual sent/
cancelled/tanked garbage and stack/holes over KO games; use
those measured outcomes to develop an opponent-pressure-aware
post-TSD value estimate, preferably Pareto-ranking future
attack potential vs survival risk. Then rerun **same-seed,
side-swapped scored KO** versus both baseline ROOK and pinned
Kiwi. High solo APP is insufficient. Never use unseen future
RNG or future opponent actions.

## Picking up from another conversation

1. Read **this document first**, then
   `docs/ROOK_INFORMATION_CONTRACT.md`, especially player visibility and
   atomic legal-placement contract.
2. Fetch live branch `feat/rook-independent-bot` and draft PR #6; confirm
   whether the reverse-planner prototype already exists. Never infer
   completion from this plan alone.
3. Inspect `src/analysis/rook.js`, `src/analysis/rook-tsd.js`,
   `src/analysis/demo.js`, `src/analysis/rook-combat.js` and
   `test/rook-tsd.test.js`; add the **smallest testable reverse-goal
   primitive first**.
4. Run targeted tests and full repository tests; record exact commit SHA,
   CI result, actual APP, per-Spin counts, KO wins/losses, budget and
   confidence limitations. A feature is not done because a PR exists.
5. Work and report in Traditional Chinese. Avoid repeatedly apologizing,
   inflating claims or asking the user to repeat the requirements.

**Non-goal:** secretly replacing the pinned Kiwi on the public site or
retuning existing CC2 parameters and claiming it is a new bot.
