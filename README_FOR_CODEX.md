# Tetrp Codex Handoff

## Product goal

`tetrp` is intended to become an MIT-licensed, client-only PWA for post-game TETR.IO replay review and bot-assisted practice.

Long-term product goals:

1. Load `.ttr` / `.ttrm` replay files locally in desktop and mobile browsers.
2. Provide a mobile-friendly replay viewer and placement-by-placement review.
3. Pause at any placement and ask a Tetris bot to analyze the position or continue from it.
4. Add a Zen-like practice sandbox where the player can ask the bot for a hint, one move, several moves, or temporary takeover.
5. Prefer local computation (browser / Web Worker / WASM) and GitHub Pages deployment. No backend is required for the first version.

## Legal / provenance constraints

This handoff intentionally contains NO TETR.IO production bundle, beautified official JavaScript, official assets, sounds, fonts, or other official source code.

The public project must remain an independent implementation:

- Do not copy, translate, vendor, or commit TETR.IO official code or assets.
- Do not add a runtime dependency on the private `01_Official_Standalone` research copy.
- Treat these documents, fixtures, and small reference programs as behavioral/specification material.
- If a behavior is not specified, mark it unknown/TODO instead of guessing from memory.
- Keep the public implementation architecturally original and MIT-licensed.
- The first version is for post-game replay analysis and offline practice only. Do not build live TETR.IO overlays, input injection, live board reading, or ranked-match assistance.

## Read order

### Required first

1. `ERRATA_FOR_CODEX.md`
2. `01_core_spec/TETRIO_CLEANROOM_ENGINE_SPEC_V19.md`
3. `01_core_spec/TETRIO_RECONSTRUCTION_READINESS_V19.md`

These define the authoritative implementation scope for the first milestone.

### Consult while implementing a subsystem

Files in `02_engine_details/` contain deeper behavioral notes for handling, board/collision, spawn/hold, frame ordering, spin classification, scoring/attack, garbage edge cases, and solo presets.

Do not attempt to memorize all of them before coding. Read the relevant document when implementing that subsystem.

### Fixtures

Files in `03_fixtures/` are machine-readable rules / behavioral test inputs. Convert them into automated tests instead of retyping values from memory.

### Reference programs

Files in `04_reference/` are small independent reference implementations used as oracles for selected behavior. They are not production runtime dependencies.

### Phase 2

`05_phase2_replay/` is for replay/state work after the deterministic engine core is stable. Do not begin Phase 2 until the first milestone has a reliable test suite.

## Full gated roadmap

Read `ROADMAP_FOR_CODEX.md` for the milestone, non-goals, exit criteria, and required handoff report for Phases 1 through 6. The phase gate is mandatory: stop after each phase for review.

## First Codex milestone

Create the initial `tetrp` repository, but implement ONLY the deterministic gameplay engine core first.

Do not start with React UI, authentication, cloud storage, multiplayer networking, bot integration, analytics, or visual polish.

The engine should accept:

- a ruleset,
- a seed,
- timestamped / subframe input events,

and produce deterministic canonical game state.

Prioritize in this order:

1. Board representation and collision
2. Piece definitions
3. Deterministic 7-bag RNG
4. Spawn / Hold / Next
5. SRS+ rotation and kicks
6. Gravity and 20G behavior
7. DAS / ARR / DCD
8. IRS / IHS
9. Lock delay / lock reset / safelock
10. Spin classification
11. Line clear
12. Canonical state serialization
13. Only after the above are stable: attack / garbage / Tetra League behavior

Requirements:

- Gameplay simulation must be independent from rendering and UI.
- Simulation must be deterministic.
- Convert provided JSON vectors into automated tests.
- Every subsystem should have tests before moving on.
- The Python reference files may be used as test oracles but must not become runtime dependencies.
- Create a canonical serialized state suitable for future frame-by-frame differential testing.
- If a fixture and a prose note appear to conflict, stop and document the conflict rather than silently choosing one.
- Keep abstractions minimal until required by actual functionality.

At the end of this milestone, report:

1. Architecture summary
2. Test matrix and pass/fail status
3. Remaining unknown / unsupported edge cases
4. Proposed interface for the next replay-parser milestone

Do NOT begin the replay viewer or bot integration until the engine milestone is reviewed.

## Public repo hygiene

The eventual public repository should contain only the project's own implementation and appropriately reviewed tests/specification material. Never add:

- `TETRIO_Package.zip`
- `01_Official_Standalone/`
- `tetrio.beautified.js`
- any TETR.IO production bundle
- any official TETR.IO visual/audio/font asset

Project working name: `tetrp` / display name `Tetrp`.
