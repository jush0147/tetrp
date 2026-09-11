# Tetrp

Independent, MIT-licensed deterministic gameplay engine for future post-game
TETR.IO replay review and offline practice. Not affiliated with TETR.IO.
No official client code or visual/audio/font assets are included.

**Phase 3 mobile-first viewer.** Open local `.ttr`/`.ttrm` files, select a stream,
and navigate by placement or frame. Play at 0.5× / 1× / 1.5× source speed;
portrait shows the selected player and landscape shows both players by in-game name.
Hold, vertical Next, B2B, counters and placement spin/clear labels accompany each
board, with a bottom-first incoming garbage queue and total. Replay data stays on the device.
See [the viewer handoff](docs/PHASE_3_HANDOFF.md) and
[Phase 2 conformance findings](docs/PHASE_2_HANDOFF.md).
No bot, practice UI, or live-match integration is included. Read
[the Phase 1 handoff](docs/PHASE_1_HANDOFF.md) before extending the engine.

## Run tests

Requires Node.js 22+ and Python 3.12 for the independent test oracles and AST audit.
The engine/replay unit tests need no npm or Python packages. Viewer builds and
browser tests use the development dependencies installed by `npm ci`.

```sh
npm test
```

If Python is not on PATH, set `PYTHON` to its executable. In PowerShell:

```powershell
$env:PYTHON = 'C:/path/to/python.exe'
npm test
```

`npm run test:reference` runs the five oracle domains, seed boundaries and AST audit.
Python is never imported or invoked by the simulation runtime.

## Browser viewer

```sh
npm ci
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/tetrp/`. Production consists only of `dist/` static
assets; the preview server is a development convenience. All assets use relative
paths for GitHub Pages project sites. `.github/workflows/pages.yml` runs tests,
builds, checks Chromium/WebKit, and deploys `main` through GitHub Pages Actions.

```sh
npx playwright install chromium webkit
npm run test:browser -- --grep-invert "real private"
```

Private browser acceptance is opt-in via `TETRP_TTR` and `TETRP_TTRM` environment
variables pointing to local sample files. Never commit those files or test output.

## Engine API

```js
import { Engine } from './src/engine.js';

const game = new Engine({ seed: 42 }); // supplied v19 TL rules
game.step([
  { frame: 0, subframe: 0.2, type: 'keydown', key: 'rotateCW' },
  { frame: 0, subframe: 0.7, type: 'keydown', key: 'hardDrop' },
]);
const bytes = game.serialize();
const restored = Engine.restore(bytes);
restored.step([]);
```

`step` consumes one source frame, keeping input-array order, including
decreasing/equal subframes. Subframes are floored to tenths. Supply keyups;
repeated keydowns do not emulate operating-system key repeat.

For a checkpoint between inputs, use `beginFrame(events)`,
`processNextInput()`, `serialize()`, and `finishFrame()`. The checkpoint owns
the unconsumed inputs for the in-progress frame. Future frames remain caller-owned.

`receive({ from, iid, ackiid, amt })` and `confirm(cid)` model semantic garbage
consumer events locally. They do not contact any service. The initial local
offence target is P2; arbitrary multiplayer coordination is out of scope.

`state` is exposed for test/reconstruction adapters. Do not mutate it during
a frame. Read `state.bag.queue.slice(0, state.rules.nextcount)` for visible NEXT;
the complete queue and RNG are checkpointed. `trace` contains diagnostic
transition events and may be cleared by the caller; it is not canonical state.

The runtime uses native ES modules and JSON imports. A future browser bundler
can package these modules without Node or Python runtime code.

## Scope and evidence

The engine implements the specified standard pieces and the supplied TL
gameplay subset. Solo preset values and Blitz progression formulas are tested,
and solo placements can reconstruct boards across checkpoints. Solo aggregate
score/B2B/attack remain explicitly unknown (`stats.score` and `attack` are null);
known drop points are recorded separately. Checkpoints now use schema v2.
Nonzero line-clear ARE also fails explicitly because its RNG jitter is unspecified.
See the handoff for all unsupported cases and test limitations.

Behavioral inputs came from a user-supplied clean-room handoff and its precision
and mini-spin corrections. The public tree now contains project-facing
[engine documentation](docs/ENGINE_SPEC.md), minimal runtime tables in `src/data`,
behavioral test vectors and five independent test-only Python models. It does
not need the raw handoff archive to build or test.

Unused per-mino metadata, preview data, exotic kick tables, finesse tables and
source-level research narrative were removed from this revision. See the
[artifact-by-artifact provenance review](docs/PROVENANCE.md) for the public/private
boundary and the remaining historical-publication limitation. This describes a
particular v19 behavioral snapshot, not today's live service.
