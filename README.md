# Tetrp

Independent, MIT-licensed deterministic gameplay engine for future post-game
TETR.IO replay review and offline practice. Not affiliated with TETR.IO.
No official client code or visual/audio/font assets are included.

**Phase 1 review checkpoint.** No replay parser, UI, PWA, bot, network client,
live-match integration or deployment has been built. Read
[the Phase 1 handoff](docs/PHASE_1_HANDOFF.md) before extending the engine.

## Run tests

Requires Node.js 22+ and Python 3.10+ for the independent test oracles.
There are no npm packages to install and no Python packages to install.

```sh
npm test
```

If Python is not on PATH, set `PYTHON` to its executable. In PowerShell:

```powershell
$env:PYTHON = 'C:/path/to/python.exe'
npm test
```

`npm run test:reference` runs just the five cross-language comparisons.
Python is never imported or invoked by the simulation runtime.

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
but solo placement/scoring currently throws an explicit `UnknownBehavior`
because the supplied presets omit their inherited attack/B2B defaults.
Nonzero line-clear ARE also fails explicitly because its RNG jitter is unspecified.
See the handoff for all unsupported cases and test limitations.

Behavior is based on the user-supplied clean-room handoff, with
[ERRATA_FOR_CODEX.md](ERRATA_FOR_CODEX.md) taking precedence. Original references
and fixture files are retained unchanged and hash-checked. The source material
describes a particular v19 snapshot, not today's live service.
