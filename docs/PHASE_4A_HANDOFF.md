# Phase 4A handoff — Kiwi single-position analysis

Date: 2026-09-20. Scope authority: `docs/PHASE_4_PLAN.md`, with the user's
designation of Kiwi v1 as the Cold Clear 2 implementation. Only Phase 4A is
implemented. No user-visible continuation, bot-move application, analysis branch
timeline, gameplay controls, or Phase 4B work is included. Stop for review.

## Result

Open a supported replay, pause at a position, and select **Kiwi** beside replay
navigation. One recommendation appears as a lime outline on the existing board.
The status explicitly says `HOLD → piece` when required. Details show the budget,
actual evaluator nodes, path, and approximation warnings. The separate status row
does not obscure the board. The × button cancels or clears analysis.

Analyzing pauses playback and auto-step without seeking. Navigation, scrub start,
playback start, round/player/file changes, and coordinated PWA updates invalidate
analysis. Replay persistence remains unchanged; recommendations are not persisted.

## Pinned artifact and license

| Field | Value |
| --- | --- |
| Repository / branch | `jush0147/cold-clear-2` / `kiwi-v1` |
| Product | `kiwi-v1`, display name `Kiwi` |
| Source commit | `89dcfe6cf544991bc9bb59098dd43d2ca2173945` |
| Artifact build commit | `89dcfe6cf544991bc9bb59098dd43d2ca2173945` |
| Frozen strategy ancestor | `e13ec57e7f3795ea0c4dd7e256346d533fcb36e3` |
| GitHub Actions run | `35444205867` |
| Artifact name / ID | `kiwi-v1-browser` / `10585366096` |
| GitHub-reported archive digest | `sha256:b63be254a1cd0ce2b6419719e3eb5ce8db53773c9b6cbe51f8bab48ad3e1561a` |
| Default budget | 200,000 evaluator nodes |
| WASM size | 491,197 bytes |

The complete extracted browser artifact lives in `vendor/kiwi-v1/`, including its
two unmodified mapping helpers, browser package, build manifest, handoff, smoke
report, and licenses. No Rust source or alternate bot was vendored. The recorded
archive digest is GitHub metadata; `scripts/verify-kiwi.js` independently verifies
SHA-256 for every extracted file using `artifact-lock.json` on every build/test.
`.gitattributes` disables text conversion for this directory so a fresh checkout
preserves the verified bytes.

The upstream package declares `MIT OR Apache-2.0`; both notices ship in `dist`.
The artifact omits its repository's `THIRD_PARTY_NOTICES.md`. The same pinned
commit's [third-party notice](https://github.com/jush0147/cold-clear-2/blob/89dcfe6cf544991bc9bb59098dd43d2ca2173945/THIRD_PARTY_NOTICES.md)
was copied separately to `third-party/kiwi-notices.md` and ships as `kiwi-NOTICES`.
It attributes adapted SRS+ data to Triangle.js / halp; it is not Tetrp-authored data.

Reacquire the original artifact while GitHub retains it:

```sh
gh run download 35444205867 -R jush0147/cold-clear-2 -n kiwi-v1-browser -D .cache/kiwi-v1-browser
```

Ordinary builds need no GitHub access, Rust, wasm-pack, or artifact download.
The checked-in browser artifact is the reproducible build input even after Actions
retention expires. Updating the pin is a separate reviewed change.

The user-requested build 35444205867 updates the placement transport to an
**authority-gated reset-safe fallback**, tested upstream against Tetrp commit
`0b48cb7e1a50e5f0bba6fcfee05ba8e291bebee2`. Its WASM, browser glue and authority
adapter are byte-identical to the earlier build 35441288411. This is a transport
fix, not a strategy/rules-parity change. A local regression reproduces a grounded
16-reset path locking two pieces with ordinary scheduling, then verifies the new
engine-probed schedule locks exactly one piece at frame 19, subframe 0.5, without
mutating the supplied Engine. Ordinary safe schedules remain unchanged.
Phase 4A uses the helper's geometry mapping only; scheduling is exercised in tests
and is not exposed as continuation or used by the viewer.

## Architecture and information boundary

```text
ViewerSession / recorded Reconstruction (replay Worker)
  → exact selected position + observed-history reconstruction
  → allowlisted canonical visible state
  → BotAdapter (UI request lifecycle only)
  → dedicated kiwi-worker.js
  → artifact adapter + WasmBot / analyze_pending_json
  → artifact placement helper + Tetrp geometry verification
  → one normalized move
  → read-only Canvas overlay
```

- `src/analysis/visible-state.js` defines the bot-independent transport. It contains
  own board/current/Hold, exactly five previews, public rules, counters, observed
  draw history, and allowlisted incoming packet facts. Packet identity, sender,
  hole column, RNG, hidden queue, opponent board, timeline and raw replay are absent.
- `ViewerSession.analysisState()` runs in the existing replay Worker. A separate
  Reconstruction receives only the source-event prefix ending at the selected
  cursor, with its frame bound truncated to the selected frame. It scans from
  initial state and stops at the exact cursor/frame/phase, yielding every 256
  operations. No later same-frame input or future attack confirmation is read.
  Gameplay reconstruction uses the existing authority Engine; the observer never
  derives a bag frontier from RNG or the queue beyond preview five.
- This scan does not modify or seek the recorded Reconstruction. The final
  projection is a detached copy. History work is invalidated by any new replay
  command or explicit analysis cancellation.
- `viewer/bot-adapter.js` exposes initialize/analyze/cancel/dispose. Worker identity
  and monotonic request generation guard replies and errors. Busy repeated Analyze
  requests terminate/restart the Worker; idle identical requests reuse a cached
  normalized result. Timeout is 120 seconds. Cancellation terminates synchronous
  WASM work rather than trying to send an interrupt through its blocked event loop.
- `viewer/kiwi-worker.js` owns WASM initialization, WasmBot, search and placement
  checking. Nothing runs Kiwi search on the UI thread or replay Worker.
- Replay position generations independently reject late history and search
  responses. Worker errors, initialization errors, unsupported state and mapping
  failures are analysis errors, not replay load errors; replay navigation survives.

## Mapping and search semantics

The artifact's `captureVisibleState`, `buildAnalysisRequest`, `SevenBagObserver`,
`inferredUseHold`, and `createPlacementTools` are reused unchanged.

Board storage is 10 × 40 with 20 visible rows. The helper reverses the rows once
for Kiwi's bottom-up board, converts piece letters to uppercase, and maps ordinary
garbage to `G`. Permanent garbage and other dimensions are rejected. Root queue
is current plus **exactly NEXT 5**. The selected piece's actual coordinates and
rotation remain available for authority reachability checking.

Replay placements commonly have `phase=inputs`. The harness helper's ready-frame
requirement is adapted only on a detached mapping object: the original frame,
subframe, board, and piece remain unchanged. No `finishFrame()` or future input
is executed to manufacture a ready decision. Integer packet timing uses the
selected integer source frame; subframe travel precision is not modeled by Kiwi.

TL combo is supplied directly. `back_to_back = raw btb > 0` and
`b2b_count = max(0, raw btb - 1)` use the artifact's convention. Tetrp keeps its
canonical counters and full rule configuration; Kiwi does not become authority.

### SevenBag and Hold

Observation starts with the initial current plus five visible previews. For each
consumed atomic operation, actual spawn transitions count draws; occupied-Hold
replacement spawns do not. Only newly exposed preview suffix entries are appended.
Ordinary lock/spawn reveals one new preview; empty Hold plus lock/spawn reveals
two. If empty Hold and placement are separate events, each reveal is observed
separately. Buffered Hold is accounted for by the same transition rule.

`SevenBagObserver` validates the accumulated history and computes the remaining
pieces at the *observed preview frontier*. Its draw-window suffix is kept separate
from the actual current piece: nonempty Hold can make current differ from the
latest draw. The observed NEXT five must still match; only the decision-window
binding passed to `buildAnalysisRequest` substitutes the real current. No bag
order beyond the observed frontier is supplied.

Kiwi's represented Hold choice changes the played piece type. The provided helper
infers `useHold` under this explicit contract; same-piece Hold is not a separate
search branch. Hold-locked roots, disabled Hold and infinite Hold fail explicitly,
because the pinned API cannot express those restrictions. Empty/occupied Hold
placement paths are checked through Tetrp's Hold method in the geometry sandbox.

### Persistent versus pending-aware search

No observable incoming: instantiate `new WasmBot()` with its frozen
`h9+h12+h13-interactive` constructor profile, start from the visible root, call
`think_nodes(200000)`, and choose the first suggestion. The Worker/session remains
alive for identical Analyze clicks; those return the same result without adding
another search budget. A replay seek cancels it and establishes a fresh root.
Phase 4A does not call `play_json`, `play_with_hold_json`, or `new_piece`, because
there is no Kiwi continuation to advance.

Any positive observable incoming: use `buildAnalysisRequest()` and
`analyze_pending_json()`. Persistent start never receives a stripped pending root.
Active packets have ready time 0; confirmed inactive packets use
`activeFrame - frame`. Frame, current attack multiplier, growth margin and growth
rate are supplied together, plus placed-piece and sent-garbage counters.
Pending search uses frozen `h9+h12-review`, 24 frames/piece (2.5 PPS), and ten
equally weighted unknown-hole scenarios sharing one 200,000-node budget.

Unconfirmed activation, shielded/hardened/nonstandard packet state, unsupported
garbage cap/blocking/entry rules fail explicitly. No future confirm is consulted.
ARE packets that do not satisfy the supported packet contract likewise fail;
they never become a no-pending search.

### Placement normalization

The artifact helper maps Kiwi piece cells/orientation to Tetrp coordinates and
finds a path using Tetrp SRS+ CW/CCW/180, Hold and spin logic. A detached geometry
sandbox uses the visible board/piece/Hold, five previews, public rules and a fixed
dummy seed; it has no replay RNG or events. Tetrp movement/rotation/drop methods
verify the path, final occupied cells, collision legality and spin classification.
The sandbox is discarded without committing a lock or applying a bot placement
to a replay or user-visible branch.

The result is `{piece, x, y, rotation, useHold, cells}` in top-down Tetrp coordinates,
plus generic search metadata/warnings. `y` and cells use occupied integer rows;
the viewer subtracts its 20-row buffer. It never sees Kiwi placement structures.
The outline is presentation only; no direct board mutation is used.

## Static hosting, offline, privacy

esbuild emits app, replay Worker and Kiwi Worker. Browser glue/helpers are bundled
into Kiwi Worker; the original WASM is copied beside it. Relative URLs preserve
GitHub Pages project subpaths. The preview server explicitly allows the new files
and serves WASM with `application/wasm`.

The content-hashed PWA asset list includes Worker, WASM, provenance manifests and
license/notices. Installation/update still requires the complete asset set and
the existing persistence acknowledgement protocol. Analysis is cancelled before
update preparation. The CSP adds only `wasm-unsafe-eval` to the existing self-only
script policy; no `unsafe-eval`, remote script, backend or bot service is added.
Replays remain local, outside service-worker caches; analysis has no storage path.

## Validation

Commands (Node 24.15.0, Python 3.12.14, Windows; set `PYTHON` if needed):

```sh
npm test
npm run build
npm run test:browser
node scripts/validate-replays.mjs <40L path> <TL path> --output .private-replays/phase4a-regression.json
node scripts/validate-analysis.mjs <40L path> <TL path>
```

Private browser checks use `TETRP_TTR` / `TETRP_TTRM`. Public CI continues to use
synthetic fixtures only (`--grep-invert "real private"`). Logs, screenshots and
private inputs were not added to Git or dist.

- Unit/replay/viewer/reference/PWA: **355 passed, 0 failed, 0 skipped**.
- Full Chromium/WebKit browser suite, including private replay and offline PWA:
  **56 passed, 0 failed, 0 skipped** (3.6 minutes) on the final pinned build.
- Production build and `git diff --check` pass. Local verification logs are
  `.cache/phase4a-unit-latest.log`, `.cache/phase4a-browser-latest.log`, and
  `.private-replays/phase4a-analysis-latest.log` (ignored, not distributed).
- New tests cover artifact hashes/profile, current+NEXT5, hidden-tail/RNG immunity,
  a throwing future-event getter, exact same-frame history boundary, SevenBag
  frontier/Hold accounting, all seven pieces × four orientations, Hold placement,
  deterministic 200k search, pending budget/timing, authority immutability, stale
  reply/error rejection, cancellation, repeated requests and Worker restart.
- Browser tests exercise real WASM, independent worker identity, UI timers during
  search, Hold labelling, new-position analysis, clearing/cancellation, pending and
  unknown-arrival paths, player switching, local-only requests and short landscape.
  PWA tests perform real offline WASM analysis after shutting down the origin.
- Existing private replay audit: 100 solo + 2,420 TL placements, 21 streams,
  **5,082 repeated placement seeks and 2,541 forks**. The same four known TL
  terminal mismatch streams remain. The existing provisional TL retry no-op is
  unchanged; no new engine conformance claim is made.
- Private Kiwi audit observes **2,541 placement positions**, searching initial,
  first, every 25th, and pending sample positions. All **144 searches** normalize
  successfully: 113 persistent, 31 pending; 71 Hold recommendations. 22 selected
  TL positions reject unconfirmed garbage timing; one selected terminal TL
  position rejects no active piece. These are explicit unsupported positions.
  Checkpoint bytes stay identical across every attempted analysis. This audit was
  rerun after pinning build 35444205867: Node search times were 288–398 ms for
  solo (median 345 ms), 18–890 ms for TL (median 451 ms).

## Performance and real limitations

Browser measurements use the synthetic seed-42 empty root and placement 1 with
the real pinned 200k WASM. Worker search and search-plus-mapping are measured using
`performance.now`; history reconstruction, Worker startup, WASM loading and UI
rendering are outside those durations. These are local desktop-host measurements
with mobile WebKit emulation, not physical-phone performance certification.

Final build 35444205867 browser measurements: Chromium search **376–716 ms**,
total **387–746 ms**; WebKit mobile-emulation search **1,512–1,809 ms**, total
**1,525–1,829 ms**. The private Node audit was running concurrently, so these
measurements include desktop CPU contention. The identical WASM in the initial
run measured Chromium 320–352 ms and WebKit 1,688–1,883 ms search time.
Both roots report exactly 200,000 evaluated nodes. UI intervals continue while
search runs. General API behavior allows fewer nodes if its graph has no work;
200k is a hard evaluator budget, not a promised time or depth. Cancellation
terminates the entire Worker; there is a visible thinking state, no invented
percentage progress, and a two-minute watchdog.

Reproducible limitations:

1. **Real TL surge mismatch:** the supplied TL replay uses `b2bcharge_base=3`;
   the pinned Kiwi source's `surge_size` matches base 0. Set that rule on a
   synthetic TL Engine to reproduce the warning. Input B2B counters remain exact,
   but search can undervalue a surge release; no adapter API exists for this rule.
2. **40L unknown combo/B2B:** authority marks solo aggregates unknown. Kiwi receives
   explicitly disclosed neutral combo/B2B values and evaluates competitive
   stacking. This is not a fastest-40L solution or recovered solo scoring.
3. **Hold already locked:** analyze after a Hold before the next lock; Kiwi cannot
   constrain root Hold, so the request fails. Same-type Hold is not ranked separately.
4. **Unknown incoming activation:** receive a packet without confirming it, then
   analyze. The request fails; it is not treated as zero pending or assigned a
   guessed delay. Nonstandard packet/material/board/rule contracts also fail.
5. **Pending is approximate:** 24F pace, ten unknown-hole scenarios, integer frame
   timing, and simplified ARE/bump timing. No opponent future, actual hidden hole,
   actual future input pace, or future attack is used. Future scenario searches
   may be optimistic; evaluation is not a win probability.
6. **Rules parity is not certified:** upstream capabilities explicitly report
   `rules_parity_verified=false`, missing opener double-cancel and clutch-clears.
   Nonstandard spin/attack rules fail; the known surge-base difference is disclosed.
   No-pending persistent search also cannot transport a late-round multiplier;
   a non-unit authority multiplier triggers an explicit warning.
7. **Reachability is geometric:** paths are checked with Tetrp methods and spin,
   independent of invented PPS/gravity timing. No wall-clock execution guarantee
   or replay input schedule is claimed. A bounded helper BFS (100k visits, 32 moves)
   may reject a valid but complex placement; failure produces no overlay and does
   not substitute a different bot or silently paint the cells.
8. **Linear observed-history scan:** arbitrary invocation reconstructs the observed
   prefix from the beginning of the stream. It yields and is cancellable but is
   not yet indexed; long streams can add latency before search.
9. **Scope:** no continuation, move ranking UI, recorded-line grading, cloud
   compute, accounts, or live/ranked assistance. Physical device/installed PWA
   lifecycle verification remains separate from automated browsers.

Review this Phase 4A implementation and limitations before authorizing Phase 4B.
