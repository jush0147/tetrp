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
execution** to Tetrp's existing isolated `BotDemo` authority. For a normal
Place it verifies the input path under Tetrp's 24-frame scheduling and commits
one lock. For Hold:

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
node --test test/rook.test.js test/rook-session.test.js
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

## Unresolved

This passes a narrow **information-access boundary**, not complete gameplay
rule equivalence or competitive strength. The current evaluator simplifies
pending arrival/cancellation and future attack scaling. Root reachability
uses bounded BFS and timed input authority may still reject a geometrically
reachable candidate. Full Clutch/ARE parity, simultaneous KO evidence against
Kiwi or Cold Clear 2, and full viewer UI integration are **not** established.
The bot currently runs as a Node demo and an importable class, not as the
site's deployed Kiwi button.
