# Phase 3 handoff — mobile-first replay viewer

Base: `main` at `b928a53`. Phase 3 adds a client-only browser viewer on the existing
Phase 2 stable API. No gameplay rules, parser, anchors, or canonical state were
changed. An additive diagnostic observation exposes lock piece/spin facts before
zero-ARE spawn replaces the active piece. Stop after this viewer; Phase 4 is not implemented.

## Architecture

- `viewer/session.js` imports only the public replay entrypoint for parsing,
  round/player selection, preparation and Reconstruction. A forward scan discovers
  the reconstructed placement count, lock/spin/clear observations and terminal
  diagnostics, then seeks to zero. Forward frame playback advances the existing
  Reconstruction; backwards and placement seeks use its seek methods.
- `viewer/worker.js` owns File reading, parsing, preparation, indexing and all seeks
  in a module Worker. It owns independent sessions for both players in a round.
  Indexing yields every 256 transitions so stream changes can
  cancel obsolete work. Opening another file terminates the previous Worker.
- `viewer/app.js` coordinates DOM controls and request IDs. Only the latest response
  can update the display; changing rounds/files resets the session and navigation.
  Changing the focused player reuses both sessions at their existing progress.
  The scrubber debounces requests and invalidates stale replies immediately.
- `viewer/render.js` is a read-only Canvas adapter. It uses existing `board.cells()`
  and piece geometry, clips rows at `board.buffer`, and uses `ceil(y)` for occupied
  grid coordinates. There is no duplicate gameplay simulation or replay parser.
- `viewer/index.html` / `style.css` provide an original visual system: a dark field,
  muted piece colors, system fonts and a mint action accent. The requested Hold-left,
  Next-right placement is retained; styling, controls and composition are independent.
  No official TETR.IO asset, skin, font or sound is used.
- esbuild bundles two native ESM entries. The production artifact contains exactly
  `index.html`, `app.css`, `app.js`, `worker.js`, and `.nojekyll`. Runtime has no
  framework, Node server, backend, account, database or external dependency.

Bundling includes the
existing independent engine tables, not the source tree, private samples, test
fixtures, checkpoints or reports. Build fails if unexpected files exist in dist.

## UX and controls

Open a local `.ttr` or `.ttrm` from the header or initial file picker. Solo enters
its single stream automatically. The header menu opens another local file. Multiplayer exposes a round dropdown and in-game-name player tabs;
Changing round constructs fresh sessions. Changing player sends `focus`, retaining
the existing round frame, each exact canonical state and the running playback clock.
Player labels use the replay's
in-game `username`, with `Player N` fallback when absent; opaque account IDs are
never used as display names. File names and player names are inserted as text,
never HTML. Reopening the same file is supported.

The board is the main visual. Hold sits left and the vertical Next queue sits right.
Hold's lock status is shown. A buffer piece is drawn inside the top of the board,
preserving x and rotation and translating its display cells down only enough to
fit its upper edge. `model.active` retains the true visible collision cells;
`model.displayActive` is the presentation projection. Neither changes state. On the board,
active cells have a bright edge; sleeping/committed pieces are not drawn a second
time. The left rail shows reconstructed B2B/combo and clear labels. A horizontal panel below the board shows pieces,
generated attack and elapsed-time mean PPS/APM.
Lines are shown only for `.ttr`, and hidden for `.ttrm`. Right-side cumulative stats and
score were removed in favor of incoming garbage. Solo B2B/attack remain unknown,
rather than substituting TL rules. The most recent placement's
spin (including non-T and mini), line clear and All Clear persist until the next placement.
All Clear is the engine's clear-time observation, retained before subsequent
spawn/garbage changes; it is never inferred from a later displayed board. It appears
as `ALL CLEAR` alongside the spin/clear label and resets on the next placement.
These labels sit beside B2B in the upper left rail; spin labels use the matching
piece palette color. Quad uses the I-piece color (#82daca). All Clear uses bright green (#42f58a), distinct from S-spin green (#a9c884), including combined clear labels.

The displayed B2B is `max(0, attack.btb - 1)`: the internal counter's first
qualifying clear establishes the chain; the second is B2B 1. Zero-line spins do
not build the chain, no-clear placements preserve it, and ordinary nonqualifying
line clears break it. All-clear contributions remain those of the replay profile,
including its additional contribution, rather than current live-client defaults.
This fixes presentation, not the Phase 2 engine's attack computation.

Incoming garbage is read from remaining `are` / `pending` packets, including
unconfirmed packets, in canonical queue order. Oldest is at the bottom; partially
tanked/cancelled packets shrink and exhausted packets disappear. The total has a
fixed position below Next, independent of packet count. It includes every packet,
even rows omitted for lack of space. A ResizeObserver
fits only complete 24 px rows, retaining earliest packets first. Dim entries are
not yet active. The current supported TL profile tanks at most 8 rows per eligible
intake, shared across packets, not 8 per packet and not an 8-row pending-queue cap.
The intake cap remains available from reconstructed rules; it is not an extra visible label.
The viewer neither splits nor clamps the displayed remaining packet amounts.

Primary navigation is a framed bottom panel: time and piece position, a native range
scrubber, previous/play/next icons and speed selector. Portrait icon targets are at least 44 × 48 px. Placement forms,
and the visible frame-jump form remain removed; the range's
accessible value still exposes its position and total.
`PlaybackClock` drives original-time playback at 60 source frames/second, with
0.5×, 1× and 1.5× speeds. It uses elapsed monotonic time rather than accumulating
Worker response latency. Only one playback seek is outstanding; slow devices may
skip displayed frames to catch up, while reconstruction consumes every source event.
Speed changes preserve the current clock position. Playback pauses on
manual navigation, round/file changes, hidden tabs and errors. Player focus changes
continue playback. At the end the
play button restarts from zero. Desktop also supports left/right arrows and Space
outside editable controls.

Frame seek remains available through the Worker/ViewerSession API and timed playback,
without a dedicated UI form. Placement zero is initial state; placement N is the state
after the atomic operation producing the Nth placement, not necessarily terminal
end state. Total comes from reconstruction, not untrusted aggregate metadata.
Frame playback seeks both players to the same round frame, clamping shorter streams
at their own end. Manual placement seeks the focused player to its exact atomic
placement boundary; the peer uses the beginning of that same integer source frame.
There is no fabricated shared subframe order between independent source arrays.
Frame-end seek retains the stable API's beginning-of-frame semantics; initial indexing
still consumes all terminal events and anchors for conformance reporting.

Portrait shows only the selected player; landscape shows both players side by side.
The startup screen is a compact local file picker; there is no hero, banner or
promotional footer. A round dropdown and player tabs share a single row with their collapse
icon, with no additional heading or disclosure level. Playback follows the supplied reference layout
with its own collapse button. Closing either frees vertical space for the board;
closing controls does not alter progress or pause playback. Reopen the playback
panel to use touch controls; keyboard Space remains available while collapsed.
Each has its own name, Hold, Next, counters, spin and conformance details. Short landscape
screens use compact rails and a single-row transport. Dynamic viewport height allocates space to the board, readable counters and bottom controls without a large empty footer.
Native inputs support keyboard, touch and screen zoom; controls do not depend on
hover. There are no entrance transitions or swipe-only interactions.

## Conformance and errors

- Unsupported schema/profile/stream: clear error and expandable code/path/message.
  Selectors remain available to try another stream. Multiplayer retry is shown as
  unsupported and is not silently omitted or treated as Engine reset.
- Known terminal mismatch: short warning with expandable canonical fields and
  expected/actual values. It does not stop viewing the stream.
- No known mismatch: no status row is rendered. The viewer never claims full
  verification. Sparse-anchor coverage remains in the detached conformance API;
  known mismatch details explain the limits of their comparison.

Diagnostics are collected during initial forward reconstruction and retained for
all display seeks. Navigating backwards cannot erase an already known mismatch.
The four Phase 2 TL differences remain visible and unchanged; all exact-first-frame
claims remain subject to Phase 2's sparse-anchor limitations.

## Validation

Unit suite: **334 passed, 0 failed, 0 skipped**. This includes all 325 existing tests
and nine viewer tests for stable-API seeks/copy isolation, diagnostic checkpoint
isolation, rendering coordinates, cancellable indexing, clock rates, spin/stats labels,
B2B chain boundaries, shared garbage cap/cancellation, buffer display immutability
and All Clear retention/reset across repeated seeks.

Browser acceptance: **12 checks passed** across Chromium desktop and touch-enabled
WebKit mobile, including orientation and controlled-clock playback checks.
Browser tests use behavior and canonical state, not screenshot snapshots:

- local file selection, previous/next, direct placement jump, frame seek, playback;
- repeated 0/middle/final seeks against independent Reconstruction instances;
- full canonical state and detached model equality, all 200 board-cell center pixels,
  Hold and ordered Next preview labels;
- malformed input, unsupported stream, rapid round/player switching;
- native range track tap, touch next button and 360×640 controls;
- portrait single-player / landscape two-player visibility, username labels, Hold/Next
  positions, all three clock speeds and peer canonical frame-state equality;
- real-sample spin labels and B2B/attack/garbage values from reconstruction observations;
- no external HTTP requests or non-GET network requests during local replay use;
- reload starts with no retained replay, and reopening works from local data.

Private real files were tested locally on both browser engines:

| Sample | Verified behavior |
| --- | --- |
| `40L.ttr` | Opens, indexes all 100 placements, seeks 0/50/100/50 with identical canonical results; sparse counter-match status |
| `TL.ttrm` | All 10 rounds / 20 players selectable; all 19 supported streams fully reconstruct and seek 0/middle/final/middle; 4 terminal mismatch streams visibly identified |
| TL round index 6 / player index 1 | Explicit unsupported multiplayer retry message, with selection controls still usable |

Visual inspection of browser captures covered 390×844, 360×640, 844×390 and 1280×900. Native
touch actions were exercised through browser emulation. No physical iPhone/Android
hardware was available; do not reinterpret emulation as real-device certification.
Private captures, traces of local validation and samples remain outside the public
artifact (ignored `.private-replays/` / `test-results/`). Browser tracing/video and
automatic screenshots are disabled. CI runs only synthetic browser fixtures.

## Build and GitHub Pages

```
npm ci
npm run build
npm run preview
```

Preview serves only the four public files, including the `/tetrp/` project subpath,
at `http://127.0.0.1:4173/tetrp/`. It cannot serve samples or the workspace.
Production needs only a static host. Relative stylesheet, module and Worker URLs
work under a GitHub Pages repository path.

`.github/workflows/pages.yml` tests, builds, runs Chromium/WebKit acceptance using
synthetic data, uploads only dist, and deploys main with GitHub Pages Actions.
The Pages deployment uses the official [custom workflow pattern](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
Site address: https://jush0147.github.io/tetrp/

For opt-in private validation, set `TETRP_TTR` and `TETRP_TTRM` to local paths and run
`npm run test:browser`. CI deliberately excludes that test. Never upload its sample
files or generated reports. `npm test` remains usable without browser packages.

Client privacy: File objects are sent only to the local Worker. No fetch, analytics,
WebSocket, replay storage, localStorage, IndexedDB or service worker is installed.
The document CSP restricts scripts/styles/workers to self and sets `connect-src
'none'`, `form-action 'none'`, and `object-src 'none'`. Refresh discards all state.
Loading the static site itself still naturally requests its public assets.

## Supported platforms and limitations

- Modern module-Worker browsers. Tested: Chromium 153 and Playwright WebKit 26.6,
  with mobile/touch emulation. Firefox/Edge and physical-device Safari were not
  separately exercised; unsupported Worker environments get a clear message.
- Replay variants inherit Phase 2: container v1, v19-compatible gameplay-v15 40L,
  and gameplay-v19 single-opponent league. Not historical-v15 binary emulation.
- Rounds with more than two players explicitly fail with `UNSUPPORTED_VIEWER_ROUND`.
  An unsupported stream stays visible as an error lane; its supported opponent can
  still play. Selecting the unsupported player disables that player's placement controls.
- Local files are capped at 32 MB and individual streams at 216,000 frames (one
  hour at 60F/s), with explicit messages rather than unbounded UI work.
- A seek still performs Phase 2 linear replay in the Worker. It does not freeze the
  main thread, but very long streams can have perceptible seek latency. No speculative
  caching layer or alternate reconstruction rules were introduced.
- Indexing reports progress and is cancellable between chunks. JSON parse and one
  seek are atomic inside the Worker; choosing another file terminates that work.
- This is a visual replay viewer; a complete nonvisual per-cell narration mode is
  not included. Labels, keyboard controls and status text are provided.
- No persistence, offline install/PWA, practice controls,
  bot, analysis, move suggestions, screen reading or input injection is included.

## Future integration points (not Phase 4 implementation)

`ViewerSession.seek(kind, value)` and `result()` expose detached canonical state and
stream bounds within the worker-owned view layer. `boardModel(state)` is a pure
read-only projection usable by later presentation components. The main document
emits `tetrp:position` with detached `{state, model, views, roundFrame}` on accepted
navigation results. `views` contains each player's display name (legacy `id` field), canonical state, bounds,
conformance and last placement, or an explicit unsupported error.
Listeners cannot mutate the actual Reconstruction by modifying that event detail.
Worker commands are limited to `load`, `select`, `focus`, and `seek`; no action-injection or
bot command has been added. Any future offline analysis boundary must be designed
in Phase 4 explicitly, preserving this separation.

The additive replay observation API is `Reconstruction.transitions`, the detached
diagnostic events from the last `advance()`. `lock` includes `piece`, `spin` and
`placementIndex`; a subsequent `remove-lines` observation includes removed row indices
and the engine's `allClear` boolean.
These facts never enter canonical state or checkpoint bytes, are cleared on reset
and exhausted advance, and are empty immediately after restore. ViewerSession indexes
these observations for seek-stable presentation. No new gameplay rule was introduced.
