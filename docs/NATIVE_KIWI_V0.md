# Native Kiwi v0 candidate

This is an opt-in vertical slice, not a promoted champion. Open the viewer with
`?kiwi=native` for TL replays. The default remains the pinned Kiwi WASM; 40L also
keeps its existing stacking adapter. Search runs in the existing Worker and ships
in its existing offline-cached bundle. No server, SAB, threading or new deployment
headers are needed. The Phase 4 controller, branch engine and replay restoration
are unchanged.

## Value decomposition

Winning means surviving until the opponent loses. A public player snapshot does
not contain an opponent response policy or a calibrated probability of winning.
The v0 score is therefore a falsifiable approximation, **not a win probability**:

```
trajectory score = newly sent attack - L - U - H
L = (occupied cells + 9 * remaining pending lines) / 10
U = empty cells with at least one occupied cell above in the same column
H = maximum occupied height squared / 20
known own terminal outcome = -1,000,000
```

All four initial weights are 1. These are seed weights, not fitted results.

| Component | Why it might predict winning | Status and cost | More direct alternative |
| --- | --- | --- | --- |
| New sent attack | Applies pressure to the opponent | Rule-exact transaction amount; its conversion to win probability is assumed. Constant work plus packet cancellation traversal. | Opponent rollout, including cancellation and kill timing |
| L | Reducing remaining material creates capacity to accept future damage | Conservation proxy; O(40 + packets). Tanking a normal nine-cell garbage line conserves L rather than making the pending burden disappear. | Expected placements/time required to recover safe capacity |
| U | Buried empty space can require extra placements and restricted piece sequences before recovery | Geometry proxy; O(40) with ten-bit popcounts. Not proof of irrecoverability. | Reachable recovery search under multiple piece tails |
| H | A high stack gives fewer opportunities to survive the next damaging transaction | Convex risk proxy; O(40). Neither a rule-derived win curve nor an exact topout detector. | Conditional survival probability under incoming/timing scenarios |
| Own terminal | Losing ends the game regardless of board aesthetics | Exact within the modeled transition, not proof that every real timed path loses. | Authority execution in the complete match |

Cancellation is represented through the smaller remaining pending burden. Clears
remove actual cells. Do not separately reward generated attack, cancelled lines,
clear labels or All Clear: that would count the same effects again. Combo, B2B,
Surge, opener pieces, sent history and multiplier remain in the search state and
the shared rule transaction; they do not receive arbitrary standalone bonuses.
Hold is an action with piece consumption and subsequent reveal, not a fixed bonus.

Roughness, transitions, handcrafted spin slots, covered-block depth, preferred wells,
T/I reserves and generic Hold flexibility are deliberately absent. They have not
been established as useful residual predictors after this decomposition. This also
avoids adopting the legacy evaluator as a template. The horizon can undervalue B2B
or a setup that pays off later; that is an explicit hypothesis to test, not a reason
to silently restore all legacy features.

## Implementation and information boundary

`visibleState → BotAdapter → kiwi-worker → native/search → ranked actions →
BotDemo.prepare → authority commit → fresh visibleState`.

The native core imports no Engine, replay reconstruction, random generator or
history observer. It receives only a snapshot and fixed search configuration.
Exactly five previews are required. No piece-count modulo or bag inference is used.
The existing snapshot adapter's mechanical-envelope validator is reused to reject
unsupported configurations; its CC2 state/evaluator/attack implementation is not.

- `board.js`: 40 ten-bit occupancy rows and garbage-material masks. Shared piece
  metadata; compact commit and ordinary garbage insertion have differential tests.
- `movegen.js`: BFS from the actual root pose; shared rotation, kick, spin and fall
  rules operate through compact occupancy callbacks. Root paths are retained.
- `model.js`: placement-level clock and explicit Hold. `resolveAttack` is the
  authority's same pure transaction, with injected bookkeeping instead of private
  RNG/peer-ledger effects. Engine callers retain their original defaults.
- `search.js`: beam with request-local TT, root action coverage, completed-layer
  publication and configurable weights. Every scenario transition consumes a node.
- `tt.js`: bounded table, full string equality after hashing; collisions cannot
  merge different states. Root identity and depth are included in the key.

Unknown pieces are not appended. The maximum horizon is five locks with empty
Hold, six with occupied Hold. When garbage exists, use ten illustrative hole
scenarios; unknown activation uses three delay scenarios crossed with those holes.
These are equally weighted robustness scenarios, **not an empirically established
probability distribution**. Different packets use a deterministic hole offset;
cross-packet hole correlations are an approximation. Stop all scenario continuations
at the first uncertain reveal in any scenario rather than allowing each scenario
to optimize with advance knowledge of its hidden outcome. No future opponent attack
model is present in v0.

## Search limits revised after measurement

Initial width 256 and rotation-history expansion were too expensive in JS. The
candidate defaults are width 32, 200,000 transition limit, 100,000 geometry-state
limit, 32,768 TT entries and 24 frames per placement. The narrow beam retains at
least one continuation per root, so its effective width can exceed 32 when there
are more root actions. A geometry limit inside a later layer returns the previous
completed comparison; a limit before all root actions are scored fails explicitly.
The requested horizon is a maximum, not a promise that search reaches it.

Movegen merges shortest ordinary-regime paths and does not enumerate every
rotation-history-dependent kick cycle. Its output is geometry, not proof of timed
execution under gravity, lock resets or handling. Full authority execution remains
mandatory. There is no certified 64 MiB physical heap bound or corpus-wide p95
latency guarantee. These limitations are included in the analysis report.

## Arena and ablation

```
npm run kiwi:arena -- --a native --b legacy --pairs 1 --frames 240
npm run kiwi:arena -- --a native --b native --pairs 1 --frames 240
npm run kiwi:arena -- --a native --b native-no-load --pairs 8 --seed 1000
npm run kiwi:arena -- --a native --b native-no-coveredEmpty --pairs 8 --seed 1000
npm run kiwi:arena -- --a native --b native-no-height --pairs 8 --seed 1000
npm run kiwi:arena -- --a native --b native-no-sent --pairs 8 --seed 1000
```

`--horizon 1` is a fast transport diagnostic, not the default search benchmark.
`--cadence` controls both authority scheduling and native forecast. A changed
cadence is not a calibrated alternative timing model for the legacy core.

Two actual Tetrp Engines are referees. Both snapshots are captured before either
policy runs. Hold submits an atomic action and triggers a new public snapshot at
the same virtual frame. Candidate path validation uses a synthetic Engine built
only from public information, never the private match checkpoint. Both players
then execute inputs frame by frame; outboxes transfer at the next frame boundary.
Both local peer ledgers consistently call the opponent P2. Private piece and hole
streams stay with each seat while policies swap seats in the paired game.
No replay future, observer history or opponent action reaches a policy.

Failures are recorded and counted rather than removed. Frame-cap and simultaneous
loss are draws. Reports contain per-game failures, times, placement counts,
transactions, profile identity, Git state and source hashes. Actual virtual PPS is
equal; **CPU budgets are not equalized** merely by giving both bots 200,000 nodes.
Reports are marked ineligible for promotion until compute-matched measurements and
held-out multi-opponent games are available. A transport failure is engineering
evidence, not a strategic victory.

`legacy` is the exact bundled tuned Kiwi and currently `champion` aliases it.
Original CC2 and historical artifacts are not bundled under misleading labels.
An external profile can be supplied as `module:path/to/profile.mjs`, exporting
`manifest.version` and `decide(publicSnapshot)` returning a normalized action or
`{candidates: [...]}`. Its implementation and artifact must be audited separately
for snapshot fairness before including it in promotion results.

Validation order:

1. Authority parity, hidden-state invariance, transport, A/A and side swap.
2. Native versus current champion smoke, including actual garbage exchange.
3. Paired `-L`, `-U`, `-H`, `-sent` ablations on a tuning split. Keep budget fixed;
   record reached depth and latency so a speed change cannot masquerade as value.
4. Freeze candidate; run a disjoint held-out seed set against multiple audited
   opponents (at least 512 pairs per opponent before drawing a promotion conclusion).
   Use paired uncertainty estimates; do not tune against this holdout.
5. Only then test residual B2B/setup terminal value, robustness probes or a tail
   model, one hypothesis at a time. Promotion still requires arena improvement.

Run `npm test`, `npm run build`, and `npm run test:browser -- --grep-invert
"real private"`. Browser tests cover responsive Worker search, cached ranked
results, seven-step reveal, exit/cancel restoration and native search after the
server has been shut down. Synthetic latency samples are saved in Playwright's
test output; they do not substitute for a high-level replay-state corpus.

## Verified in this implementation pass (2026-09-22)

- 375 Node tests passed, including compact/authority geometry, attack transaction,
  active garbage cap, late multiplier, snapshot invariance, TT collisions and arena
  A/A/failure accounting. Static viewer build passed.
- 58 public browser regression cases passed across Chromium and WebKit. After the
  final Worker-selection/offline fix, all 10 affected native/PWA cases passed again.
  Private replay tests were not run.
- Six synthetic performance states (empty, stack, active garbage, unknown arrival,
  post-Hold, danger) produced warm p95 of 692 ms in desktop Chromium and 1,631 ms in
  the WebKit mobile-viewport project on the development machine. This is five warm
  observations per browser, not a physical-phone or corpus-wide certification.
- Default native versus bundled legacy: one paired, swapped 720-frame smoke, 30
  placements per player per game. Both games reached the cap; zero policy/transport
  failures. Transactions included send, cancellation and garbage insertion.
- The `native-no-load` ablation route passed a two-game 48-frame, horizon-one smoke.
  This checks the harness only; no feature usefulness or strength conclusion follows.

No original-CC2/historical-opponent tournament, 512-pair holdout, calibrated
win-probability estimate or memory-ceiling certification has been completed.

## KO-only FT7

**Execution model superseded:** see [Arena execution review](ARENA_EXECUTION_MODEL.md).
The strength arena now uses `tl-placement-v1`, original rank zero only and
authority-validated atomic placements. Physical transport is confined to the
explicit demonstration mode. One Actions FT7 is authorized after its correctness gate; prior physical results
must not be pooled with this model.

**Validation hold (2026-09-22): do not use the recorded 7–3 series for strength
claims or launch the proposed batch yet.** A transport audit found that geometric
`down` steps (one cell) are scheduled as 0.1-frame soft-drop taps. With arena
default SDF 6, these do not descend one cell. Timing validation then rejects
intended tucks/spins and silently falls back to lower-ranked placements. Correct
reconstruction verifies the executed fallback, not faithful execution of policy
intent. Both profiles are affected.

The first 24 placements of the replay demonstration were reproduced with decision
logging: Native had 12 fallback requests out of 30 requests (including Hold
reanalysis); Legacy had 4 out of 36. At frame 120, Legacy's first T candidate
targets cells (3,39), (4,38), (3,38), (2,38), full spin. Default transport lands
above that target with no spin; candidate 2 is selected instead. In an isolated
public-snapshot control, the same path at SDF 20 reaches the intended cells and
full spin, clears one line and sends two. This is evidence of the transport
defect, **not** a validated global fix or a new match result. Increasing SDF alone
still requires checks at later gravity, fractional positions and reset limits.

Local diagnostic artifacts: `.cache/arena-decision-audit.json`,
`.cache/arena-decision-audit.log`, `.cache/prove-transport-mismatch.mjs`.
Repair: `src/analysis/placement-transport.js` compiles both arena and Bot Mode
actions using authority-simulated soft-drop pulses until geometric row waypoints
are reached. It retains actual handling and the 24-frame cadence, checks final
cells/spin/lock instant, and tries later starts for reset-heavy paths. It does not
modify the pinned vendor artifact. It is a bounded path compiler, not an exhaustive
timed move search; unexecutable paths still fail closed. Arena reports now include
fallback requests, rejected candidates and maximum selected rank for each policy.

The corrected replay-seed demonstration ended at frame 1368 with Legacy winning
by Native garbage-smash KO, 57 pieces each. Both policies selected rank zero for
every request, with zero transport failures. Both replay streams reconstructed
through 58 anchors each with zero divergence. Artifacts are in
`.cache/native-replay-transport-fixed/`. This replaces neither the historical
recording nor the invalidated FT7 strength claim. Native's shallow search quality
remains separate from the transport repair; one game cannot establish strength.

`npm run kiwi:ft7` runs one Native-default versus Legacy-default first-to-seven
series at exactly 24 frames per placement. Each attempt uses fresh private piece
and hole seeds and swaps policy seats. Only an actual authority KO awards a point.
Simultaneous KO is unscored and replayed. There is no ordinary frame cap; the
360,000-frame bug watchdog is a technical failure, never a win or scored draw.
Policy/transport errors are also unscored. Three consecutive technical failures
stop the run as incomplete for diagnosis rather than manufacturing a result.

The runner writes `result.json` and append-only `events.jsonl` under its printed
`.cache/native-ft7-*` directory, including source hashes, profile settings, seeds,
death reasons and the score after each attempt. An optional positional output
directory can be supplied to `node scripts/kiwi-ft7.js`. A single FT7 is an actual
match result, not evidence sufficient to promote a new default champion.

## Replay export

`npm run kiwi:replay` plays a new KO-only Native/Legacy demonstration and writes
`.cache/native-replay-demo/native-vs-legacy.ttrm` plus its result/verification JSON.
This command now explicitly selects `physical-input-v1`; the input-based TTRM
exporter rejects placement-mode matches. This is not a strength-arena recording.
Open the file in Tetrp and switch players to inspect both policies. The recording
contains actual input and garbage transactions, Hold actions and placement-boundary
anchors. Export must pass reconstruction for both players with zero anchor
divergences before it is written. No viewer or gameplay changes are needed.

This is a synthetic arena replay supported by Tetrp; compatibility with the official
TETR.IO replay viewer is not certified. Current replay import derives piece and hole
RNG from one seed. The demonstration therefore deliberately sets `holeSeeds=seeds`.
Export of an independent-hole-seed match fails explicitly. The earlier FT7 saved
results, not inputs, so this newly played demonstration is not its original recording.

## Proposed next strength gate

First freeze the implementation/configuration and predeclare 100 independent seed
pairs, each played in both seat assignments (200 KO games). Use this as a screening
batch rather than launching repeated FT7s until the outcome looks favorable.
For a promotion decision, freeze again and use at least 512 new seed pairs per
audited opponent. Estimate uncertainty by resampling whole seed pairs, not treating
the two correlated games as independent. A proposed champion gate is a point
estimate of at least 55% versus the incumbent and a 95% paired confidence interval
strictly above 50%, plus no material regressions across the opponent pool.
These are project acceptance criteria, not a guarantee that a given sample count
proves superiority. Small effects require more data.

Keep KO-only scoring, record simultaneous KO and technical exclusions, and inspect
any nonzero technical-failure rate before interpreting strength. Preserve every
planned seed and failed attempt; do not silently resample difficult positions away.
Use disjoint tuning/holdout sets and do not repeatedly peek at the holdout to choose
when to stop. The current champion alias is Legacy, not an independent opponent.

For Actions, a proposed first batch is 20 shards of five seed pairs, with modest
concurrency and per-game persisted artifacts. Infrastructure interruption must
resume/retry rather than award a win. Completion notification should include score,
paired interval, failures, artifact and workflow links. This batch/workflow has not
been dispatched by the local replay export work.
