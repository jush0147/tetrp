# Phase 3 handoff — mobile-first replay viewer

Base: `main` at `b928a53`. Phase 3 adds a client-only browser viewer on the existing
Phase 2 stable API. No Engine or replay-layer rules, parser, anchors, or canonical
state were changed. Stop after this viewer; Phase 4 is not implemented.

## Architecture

- `viewer/session.js` imports only the public replay entrypoint for parsing,
  round/player selection, preparation and Reconstruction. A forward scan discovers
  the reconstructed placement count and terminal diagnostics, then seeks to zero.
- `viewer/worker.js` owns File reading, parsing, preparation, indexing and all seeks
  in a module Worker. Indexing yields every 256 transitions so stream changes can
  cancel obsolete work. Opening another file terminates the previous Worker.
- `viewer/app.js` coordinates DOM controls and request IDs. Only the latest response
  can update the display; changing streams resets the session and navigation.
  The scrubber debounces requests and invalidates stale replies immediately.
- `viewer/render.js` is a read-only Canvas adapter. It uses existing `board.cells()`
  and piece geometry, clips rows at `board.buffer`, and uses `ceil(y)` for occupied
  grid coordinates. There is no duplicate gameplay simulation or replay parser.
- `viewer/index.html` / `style.css` provide an original visual system: a dark field,
  muted piece colors, system fonts, a mint action accent and a compact top tray.
  No official TETR.IO asset, skin, font, sound or UI layout is used.
- esbuild bundles two native ESM entries. The production artifact contains exactly
  `index.html`, `app.css`, `app.js`, `worker.js`, and `.nojekyll`. Runtime has no
  framework, Node server, backend, account, database or external dependency.

The current uncompressed artifact is approximately 75 KB. Bundling includes the
existing independent engine tables, not the source tree, private samples, test
fixtures, checkpoints or reports. Build fails if unexpected files exist in dist.

## UX and controls

Open a local `.ttr` or `.ttrm` from the header or initial file picker. Solo enters
its single stream automatically. Multiplayer exposes Round / Player selectors;
changing either constructs a fresh session. File names and player names are inserted
as text, never HTML. Reopening the same file is supported.

The board is the main visual. The top tray contains Hold, Active and Next. Hold's
lock status is shown; active shape/orientation is previewed even when it is wholly
above the visible field, with an up arrow marking buffer presence. On the board,
active cells have a bright edge; sleeping/committed pieces are not drawn a second
time. Basic counters show lines, completed pieces and source frame.

Primary navigation consists of large Previous / Next buttons, a native touch range
scrubber, an editable placement number with submit, and placement/total count.
Playback automatically advances one placement every 350 ms after each response;
it is **placement-paced**, not original-time video playback. Playback pauses on
manual navigation, stream/file changes, hidden tabs and errors. At the end the
play button restarts from zero. Desktop also supports left/right arrows and Space
outside editable controls.

A collapsible frame form seeks to the start of a source frame, before its events,
as specified by Phase 2. Placement zero is initial state; placement N is the state
after the atomic operation producing the Nth placement, not necessarily terminal
end state. Total comes from reconstruction, not untrusted aggregate metadata.

Phone layout puts the board first, compact counters beneath it, and a sticky bottom
transport. Conformance details and frame navigation follow beneath. Controls are
at least 44 px high; Previous / Next are 50 px on mobile. Native inputs support
keyboard, touch and screen zoom; controls do not depend on hover. Reduced-motion
preferences disable the short entrance transition. No swipe-only interaction exists.

## Conformance and errors

- Unsupported schema/profile/stream: clear error and expandable code/path/message.
  Selectors remain available to try another stream. Multiplayer retry is shown as
  unsupported and is not silently omitted or treated as Engine reset.
- Known terminal mismatch: short warning with expandable canonical fields and
  expected/actual values. It does not stop viewing the stream.
- No known mismatch: states only that none was found in available observations.
  The details explicitly say sparse anchors do not verify every intermediate frame.
- Files without terminal board anchors disclose that only available counters can
  be compared. Empty projections are labeled as lacking comparison records.

Diagnostics are collected during initial forward reconstruction and retained for
all display seeks. Navigating backwards cannot erase an already known mismatch.
The four Phase 2 TL differences remain visible and unchanged; all exact-first-frame
claims remain subject to Phase 2's sparse-anchor limitations.

## Validation

Unit suite: **328 passed, 0 failed, 0 skipped**. This includes all 325 existing tests
and three viewer tests for stable-API seek equivalence/copy isolation, rendering
coordinates/clipping/state immutability, and cancellable indexing/session reset.

Browser acceptance: **10 checks passed** across Chromium desktop and touch-enabled
WebKit mobile (8 full-suite checks plus 2 native scrubber/compact-layout checks).
Browser tests use behavior and canonical state, not screenshot snapshots:

- local file selection, previous/next, direct placement jump, frame seek, playback;
- repeated 0/middle/final seeks against independent Reconstruction instances;
- full canonical state and detached model equality, all 200 board-cell center pixels,
  Hold and ordered Next preview labels;
- malformed input, unsupported stream, rapid round/player switching;
- native range track tap, touch next button and 360×640 controls;
- no external HTTP requests or non-GET network requests during local replay use;
- reload starts with no retained replay, and reopening works from local data.

Private real files were tested locally on both browser engines:

| Sample | Verified behavior |
| --- | --- |
| `40L.ttr` | Opens, indexes all 100 placements, seeks 0/50/100/50 with identical canonical results; sparse counter-match status |
| `TL.ttrm` | All 10 rounds / 20 players selectable; all 19 supported streams fully reconstruct and seek 0/middle/final/middle; 4 terminal mismatch streams visibly identified |
| TL round index 6 / player index 1 | Explicit unsupported multiplayer retry message, with selection controls still usable |

Visual inspection of browser captures covered 390×844, 360×640 and 1280×900. Native
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
- Local files are capped at 32 MB and individual streams at 216,000 frames (one
  hour at 60F/s), with explicit messages rather than unbounded UI work.
- A seek still performs Phase 2 linear replay in the Worker. It does not freeze the
  main thread, but very long streams can have perceptible seek latency. No speculative
  caching layer or alternate reconstruction rules were introduced.
- Indexing reports progress and is cancellable between chunks. JSON parse and one
  seek are atomic inside the Worker; choosing another file terminates that work.
- This is a visual replay viewer; a complete nonvisual per-cell narration mode is
  not included. Labels, keyboard controls and status text are provided.
- No persistence, offline install/PWA, original-time playback, practice controls,
  bot, analysis, move suggestions, screen reading or input injection is included.

## Future integration points (not Phase 4 implementation)

`ViewerSession.seek(kind, value)` and `result()` expose detached canonical state and
stream bounds within the worker-owned view layer. `boardModel(state)` is a pure
read-only projection usable by later presentation components. The main document
emits `tetrp:position` with detached `{state, model}` on accepted navigation results.
Listeners cannot mutate the actual Reconstruction by modifying that event detail.
Worker commands are limited to `load`, `select`, and `seek`; no action-injection or
bot command has been added. Any future offline analysis boundary must be designed
in Phase 4 explicitly, preserving this separation.
