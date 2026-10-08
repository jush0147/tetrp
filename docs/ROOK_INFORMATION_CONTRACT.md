# ROOK: player-visible search and authority continuation

Status: **experimental branch only**. ROOK is an independent JS bot search,
not the pinned production Kiwi Worker, not an official TETR.IO client, and
not yet a demonstrated competitive KO-strength improvement.

## Exact information boundary

Tetrp owns the canonical engine and all private state. ROOK receives a new,
detached `visibleState()` projection **for each decision**. Its search entry
point further allowlists the following fields:

- own board and current active piece;
- own Hold piece and `hold.locked`;
- exactly five NEXT previews, plus current;
- observable combo, B2B and attack multiplier;
- presently known incoming garbage packets and public match rules.

The engine's full bag queue, RNG states, hidden garbage holes, original replay,
historical draws/inputs, opponent private/future state and original player's
future placements are **never** inputs to `chooseMove`. A call with six NEXT
entries is rejected, not clipped and accidentally treated as legitimate
preview data.

This is a **stateless, finite-known-preview** bot. Its limited lookahead may
model any already visible current/NEXT piece; it never assumes the exact
unknown continuation. It does not reconstruct a SevenBag remainder from
historical events or the current piece count.

## Separate Hold decision, public reveal, and second search

`RookSession` in `src/analysis/rook-session.js` delegates **all action
execution** to Tetrp's existing isolated `BotDemo` authority. For ROOK, Place verifies an untimed legal SRS+ route using Tetrp's own
movement/rotation semantics, then commits the proven final pose directly
through Tetrp's real lock/clear/attack engine. 24 frames remain a shared 2.5 PPS
**battle-clock cadence only**, not an action, finesse or rotation limit. Kiwi's
legacy timed demo remains available by default; new matched KO experiments
opt both engines into the same atomic placement mode. For Hold:

1. Request an explicit `kind:'hold'` with `mode`, `samePiece` and
   `requiresReanalysis:true`. No placement bundled with it.
2. Commit Hold **only through Tetrp**.
3. In the empty-Hold case the authority consumes a piece, makes NEXT 5 visible
   again and locks Hold. Occupied Hold swaps pieces without an extra draw.
   Same-piece occupied Hold still respawns and locks Hold.
4. Capture a **new** detached `visibleState()` after the actual Hold. Call
   ROOK again. A second Hold in the same turn is rejected.
5. Tetrp verifies and commits the new Place, spawns the next piece and restores
   ordinary Hold availability. The private generator never crosses this API.

A Hold followed by a failed Place leaves the committed post-Hold branch intact
for inspection/retry; the original replay checkpoint is never mutated.

The existing isolated BotDemo uses the repo's pinned placement input scheduler
for authoritative **execution**. ROOK's search, board scoring, root BFS and
move choice do not import or reuse CC2/Kiwi search or its evaluator.

## How to run

From the feature branch, with Node.js 22+:

```sh
node --test test/rook.test.js test/rook-session.test.js test/rook-spin.test.js
npm test
node scripts/rook-demo.js 99 8
```

The demo prints JSONL: publicly visible inputs, authority-executed Hold/Place
decisions, newly revealed NEXT after each lock, and a checkpoint preservation
flag. The bot can also be called as a pure decision function via
`chooseMove(visibleState(engine.state), options)`.

## Acceptance matrix

- Identical public snapshots with different historical/hidden/other-player
  fields yield the same decision.
- A sixth NEXT entry is rejected.
- Empty Hold consumes and reveals exactly one piece, **before** second
  search; second search sees Hold locked.
- Occupied same-piece Hold consumes no new piece but still causes separate
  reanalysis and Hold lock.
- Double Hold within the same piece is forbidden.
- Eight real sequential authority placements preserve the source checkpoint,
  refill NEXT 5 and reset Hold.
- Full existing Tetrp engine, oracle and provenance tests remain mandatory.

## All-mini+ and multi-piece B2B forecast

ROOK's root search already traverses Tetrp SRS+ rotations, including 180-degree
kicks, and delegates actual spin classification to Tetrp's own `classifySpin`.
The second-stage search previously included only non-spin Hard Drops, meaning
it was blind to *all* NEXT-piece spin attacks. The new experimental
`forecastSpinClears` preserves that inexpensive ordinary lookahead but:

1. Uses the *current public spinbonuses profile* (all-mini+, all-mini,
   T-spins, etc.), not hard-coded T-only eligibility.
2. Checks whether an imagined future board has a legal, grounded, spin-clear
   geometry. This is a **pre-filter, not a spin claim**.
3. Runs a bounded SRS+ **forward reachability search** from the known NEXT
   piece's spawn; credits only genuinely reachable spin placements that
   complete at least one line.
4. Carries the resulting mini/full B2B and Combo into the following visible
   search ply. It never reads a sixth NEXT, hidden bag or future opponent state.

Regressions in `test/rook-spin.test.js` confirm Z/L/S/J/T/I mini clears,
B2B continuation in Tetrp's real 24-frame BotDemo from a staged reachable
near-cavity snapshot, non-T mode exclusion under T-spins-only rules, a blocked
overhang with no valid path, and a NEXT Z-mini influencing the two-ply planner.
An O-mini is eligible under Tetrp rules but **not demonstrated as a reachable
clearing placement** by these tests.

Paired same-seed Tetrp authority screen (seed 67020 and 67021, 120 pieces each,
6k proposal budget) gives **0 to 15 spin clears**, including 14 mini and one
full, and B2B maximum **5 to 6**. Attack totals change **121 to 120 lines**,
so the new feature **has not yet increased overall attacking strength**. It
increases CPU cost and is retained as experimental pending more paired KO data.
The actual Tetrp authority, not hypothetical lookahead, counted the Spin clears.

The planner's future spin paths are geometry-reachable; **their 24-frame input
timing is not pre-validated**. After the next real piece becomes current, the
BotDemo authority must validate every actual landing. Ranked alternatives
are used when a proposed root path is not executable. This limitation is
especially important for deep Soft Drops and unrevealed future arrivals.

## Unresolved

This passes a narrow **information-access boundary**, not complete gameplay
rule equivalence or competitive strength. The current evaluator simplifies
pending arrival/cancellation and future attack scaling. Root reachability
uses bounded BFS and timed input authority may still reject a geometrically
reachable candidate. Full Clutch/ARE parity, timing-proof of speculative future spins, and
competitive KO strength above Kiwi or Cold Clear 2 are **not** established.
The bot runs as a Node demo, importable class, and opt-in experimental
**ROOK browser Worker**. It is **not** deployed to the public production site.
On this feature branch's browser preview, open a local replay, choose
**⋮ > 分析 Bot > ROOK (實驗)**, then press the existing analysis button.
Choosing Kiwi leaves the pinned production Kiwi algorithm unchanged. The
isolated Tetrp demo worker owns actual actions and source checkpoints; both
bots receive the identical visible-state projection.

Build a local browser preview with `npm ci && npm run build && npm run preview`.
The local preview server and offline service-worker asset list explicitly
include `rook-worker.js`. The focused Chromium E2E test covers three real
ROOK placements, correct NEXT5, switching back to Kiwi and returning to an
unchanged replay. Source: `browser-tests/analysis.spec.js`.

**Measured strength is below Kiwi.** The first four scored synchronous Tetrp
KO matches (two asymmetric seed pairs, swapped slots, 2.5 PPS) ended
ROOK 0-4 against the pinned Kiwi; Kiwi had 200k evaluator nodes per decision,
ROOK 6k, so this is not a compute-equivalent comparison. Both bots use the
visible-state snapshot and Tetrp authority. The feature is an experimental
benchmark, not a promoted strategy or a claim of world-class strength.
