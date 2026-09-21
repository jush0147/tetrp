# Phase 4B — disposable Kiwi demonstration

2026-09-21. Downstream continuation after Phase 4A review and the user's request
to execute recommendations, followed by approval to start/continue.

## Product behavior

Kiwi's image button remains beside the next-placement arrow. Clicking it pauses
the whole replay and forks the focused player's current checkpoint. The first
move is computed immediately. The target is shown for 350 ms after successful
authority validation, then committed. Kiwi or → computes one more placement;
←/→ revisits already computed states without repeating search. Maximum 20
placements, including history. Game end stops further moves. × exits, terminates
Kiwi's Worker, releases timers, discards branch/history/search data and restores
the exact original replay position paused. Switching file, round or player also
discards the branch. Nothing is persisted beyond the existing original-replay
storage; PWA static assets remain cached.

## Artifact and architecture

The Phase 4A v3.2 pin is unchanged:

- Kiwi source/build: `2e243242b674d57491f99b445f75e35fc48a0e26` (`kiwi-v1`).
- Actions run `35524225160`, artifact `10608234222` (`kiwi-v1-browser`).
- Archive SHA-256: `5f41edcd5f92165e4d77589e74bb47e926384c8d113fc927afd9552ec56aa3e8`.
- See `vendor/kiwi-v1/artifact-lock.json` and Phase 4A handoff for verification.

`viewer/worker.js` owns the recorded reconstruction and a separate `BotDemo`.
`src/analysis/demo.js` forks the engine, owns private checkpoint history and
executes actions through Tetrp. The renderer gets a projection with only NEXT 5,
never the private branch RNG or unrevealed queue. `DemoController` coordinates
search, prepare, target preview and commit using generation/revision guards.
`viewer/kiwi-worker.js` performs all root enumeration and WASM search; it receives
only `visibleState`, not checkpoints, replay events or opponent state.

## Execution and mapping

The artifact's complete geometry enumeration and placement helper remain the
mapping source. A normalized recommendation now also includes its canonical
input path and target spin. Before preview, the authority runs that path on a
temporary clone, using the artifact scheduler and 24 source frames per placement.
It requires exactly one lock, the requested cells/piece/spin, and the expected
lock frame/subframe. Only this validated clone can be committed. A replay stopped
mid-frame continues that frame rather than starting it over. Recorded held keys,
queued inputs and initial input buffers are released/cleared for branch ownership.

Geometry alone does not prove timed execution. Testing found a T-spin candidate
whose scheduled inputs reached different spin semantics. That candidate is now
rejected before commit; the controller tries ranked alternatives from the same
cached WASM report, without allocating another 200k search. If all fail, the
branch remains at its last valid state and reports an error. The displayed move
is therefore the first executable ranked candidate, not necessarily rank one.

## Piece visibility, SevenBag and Hold

Only the Tetrp authority retains the original generator/cursor. It reveals pieces
when branch actions consume draws, without using the recorded player's later
inputs or board. Every Kiwi decision uses current + exactly NEXT 5, unknown bag,
finite visible search; no history scan or hidden-tail sampling.

Hold is a separate committed action, including same-piece Hold. Empty Hold draws
a new current and replenishes NEXT 5 immediately. Occupied Hold consumes no draw.
Both trigger another snapshot request with Hold locked before a Place. Thus one
user step can require two separately capped 200k decisions. If post-Hold search
fails, the branch remains in its actual post-Hold state for retry; the original
replay is unaffected. History indices count placements, not Hold actions.

## Garbage boundary and limitations

Current pending packets remain visible and cancellable. Existing known activation
times advance through authority simulation. Unknown activation stays unknown:
Kiwi evaluates the v3.2 uncertainty scenarios, but the branch does not invent a
future acknowledgement or read one from the replay. Such packets therefore do
not spontaneously become confirmed during the demonstration. This can make a
long continuation optimistic about arrival; it is not a prediction of the real match.

New opponent attacks/events are not replayed. The opponent board stays frozen.
Unrevealed garbage columns and original hole RNG are removed from the branch;
garbage holes use a disclosed independent seed-1 scenario. The original piece
sequence is retained, but this does not authorize retaining hidden garbage outcomes.

Positive existing ARE queues, unsupported packet statuses, hardened/shielded
packets and unsupported rules still produce explicit errors. Full rules parity,
ARE/bump search timing, opener/Clutch parity and optimal Hold information gain
remain unclaimed. Executed placements are checked by Tetrp; this does not certify
all of Kiwi's deeper search assumptions. Fixed 24-frame scheduling can reject
otherwise achievable moves and is not fastest-input optimization. No physical
phone performance validation or automatic multi-move autoplay is included.

## Validation

- Unit/replay/viewer/reference suite: **359 passed**, Python 3.12.
- Chromium + mobile WebKit browser/PWA suite: **54 passed**; the 2 opt-in private
  replay cases were then run separately and **both passed** (56 total).
- Browser cases execute 8 successive placements, navigate backward/forward,
  verify empty Hold and post-Hold reanalysis, exit during search, restart, switch
  players, check responsiveness, local-only requests and offline execution.
- Unit cases execute 10 placements with actual WASM, compare each consumed draw
  against the original generator, preserve recorded checkpoint bytes, validate
  partial-frame entry, rollback, stale revisions and garbage RNG independence.
- Controller cases cover cancellation during search and target preview, ranked
  candidate fallback, saved navigation and the 20-placement bound.
- Additional private acceptance: from placement 20 in a 40L and TL sample,
  execute 3 moves each in Chromium and WebKit: **12 placements**, all successful,
  original position unchanged on exit. Every final Place request used 200,000
  nodes; Hold decisions have their own separate budget.
- Synthetic desktop/portrait screenshots inspected locally. Private files and
  audit logs stay untracked; CI uses only synthetic fixtures.

Measured click-to-commit latency for those 12 private placements on this Windows
host, including initialization when needed, geometry, search, authority trial,
possible Hold reanalysis and the 350 ms preview:

| Browser | 40L (3 steps) | TL (3 steps) |
| --- | --- | --- |
| Chromium | 1.00–1.15 s | 1.15–2.03 s |
| WebKit | 1.38–1.72 s | 1.73–3.48 s |

Final Place search alone measured 0.43–0.61 s in Chromium and 0.54–1.32 s in
WebKit. These are small sample measurements, not a general latency guarantee or
physical iPhone result. Candidate retries reuse the report but still incur
mapping/authority validation. No long-replay prefix scan is added by this feature.
