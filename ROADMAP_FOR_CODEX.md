# Tetrp implementation roadmap for Codex

This roadmap is gated. Complete and review one phase before beginning the next. Do not silently pull future-phase work forward because it seems convenient.

## Global constraints

- Public code is MIT-licensed original implementation only.
- Do not copy, translate, vendor, or commit TETR.IO production code or official assets.
- Do not depend at runtime on the private research copy of TETR.IO.
- Post-game analysis and offline practice only. No live-match overlay, live board reading, input injection, or ranked-match assistance.
- Prefer client-only execution. GitHub Pages is the intended host.
- Keep game simulation deterministic and independent from rendering, replay parsing, and bot adapters.
- When behavior is unspecified, record an unknown/TODO instead of guessing.

---

## Phase 1 - Deterministic engine core

### Goal
Build the rules/physics engine that can reproduce TETR.IO-compatible gameplay state from a ruleset, seed, and timestamped/subframe inputs.

### Required scope
1. Board representation and collision
2. Piece definitions
3. Deterministic 7-bag RNG
4. Spawn / Hold / Next
5. SRS+ rotation and kicks
6. Gravity / soft drop / 20G semantics
7. DAS / ARR / DCD
8. IRS / IHS
9. Lock delay / lock reset / safelock
10. Spin classification
11. Line clearing
12. Canonical state serialization
13. Then add attack / garbage / Tetra League behavior covered by the supplied specs and references

### Tests
- Convert all relevant `03_fixtures/*.json` data into automated tests.
- Use `04_reference/*.py` only as independent test oracles.
- Add subsystem unit tests and deterministic replay-of-input tests.

### Do not build yet
- React/PWA UI
- `.ttr/.ttrm` parser
- bot integration
- cloud backend
- multiplayer server
- polished renderer

### Exit criteria
- All imported fixture tests pass.
- Relevant reference-model comparisons pass.
- Re-running the same seed/rules/input sequence produces byte-equivalent canonical state.
- Engine state can be serialized and restored without behavioral drift for covered state.
- Architecture and remaining unknowns are documented.

### Required handoff report
- architecture summary
- test matrix
- unsupported/unknown edge cases
- proposed replay-parser interface

---

## Phase 2 - `.ttr` / `.ttrm` replay parser and reconstruction

### Goal
Turn a replay file into navigable game states without UI-specific assumptions.

### Required scope
1. Local-file parsing for `.ttr` and `.ttrm`
2. Version/schema detection with explicit unsupported-version errors
3. Enumerate rounds and players
4. Decode event/input timeline required by the engine
5. Seek by frame
6. Seek by piece placement
7. Reconstruct canonical engine state at an arbitrary review point
8. Fork a new analysis branch from a reconstructed state
9. Preserve original replay data separately from reconstructed state

### Architecture requirement
Expose a parser/reconstruction API independent from rendering and bots, conceptually similar to:

- `parseReplay(bytes)`
- `listRounds(replay)`
- `listPlayers(round)`
- `seekFrame(round, player, frame)`
- `seekPlacement(round, player, placementIndex)`
- `forkState(snapshot)`

Exact names may differ; keep responsibilities equivalent.

### Tests
- Parser unit tests for valid, malformed, and unsupported files.
- Round/player enumeration tests.
- Seek determinism tests.
- State reconstruction tests against known checkpoints from representative replay samples.

### Do not build yet
- bot analysis
- Zen/practice mode
- accounts/cloud replay storage

### Exit criteria
- Representative `.ttr` and `.ttrm` files can be parsed locally.
- A selected round/player can be stepped placement-by-placement.
- Seeking repeatedly to the same location yields identical canonical state.
- A reconstructed state can be forked and advanced with new local inputs.
- Parser errors are explicit rather than silent.

### Required handoff report
- supported replay variants/versions
- known parser gaps
- reconstruction accuracy/test matrix
- stable API for the viewer

---

## Phase 3 - Mobile-first replay viewer PWA

### Goal
Ship a useful replay-review tool before adding bots.

### Required scope
1. Static client-only web app suitable for GitHub Pages
2. PWA manifest/service worker as appropriate
3. Local file picker for `.ttr/.ttrm`; no upload required
4. Round selector and player selector
5. Board rendering using original project visuals/assets only
6. Placement-by-placement previous/next controls
7. Timeline/scrubber with frame and placement navigation
8. Show Hold, Next, relevant state metadata, incoming garbage where reconstructed
9. Portrait-first mobile layout; usable desktop layout
10. Preserve recently opened replay state locally only if useful (IndexedDB or equivalent)

### UX priority
The viewer must be pleasant on a phone. Do not copy TETR.IO's UI. Optimize for review rather than live play.

### Do not build yet
- login/account system
- server-side replay library
- bot analysis
- social/sharing features

### Exit criteria
- Deploys successfully to GitHub Pages.
- A user on mobile can pick a replay, select a round/player, scrub, and step placements without desktop drag-and-drop.
- UI remains responsive on representative long multiplayer replays.
- Core replay review works after PWA assets are cached, where browser capabilities allow.
- No replay content needs to leave the device.

### Required handoff report
- deployment URL/build instructions
- tested mobile browsers/devices or emulation matrix
- performance issues on large replays
- viewer API point where bot analysis will attach

---

## Phase 4 - Bot analysis adapter and `Analyze from here`

### Goal
At any replay position, ask a local Tetris bot for candidate placements/continuations without coupling the UI to one bot implementation.

### Required scope
1. Define a generic bot adapter interface
2. Prefer compatibility with Tetris Bot Protocol concepts where practical
3. Integrate the first selected bot (initial candidate: Cold Clear 2, subject to current licensing/build compatibility review)
4. Run bot computation off the main UI thread (Web Worker; WASM if appropriate)
5. Convert canonical engine state into bot input
6. Return at minimum a best placement and continuation
7. Support configurable analysis budgets such as Fast / Deeper
8. Allow cancellation of in-progress analysis
9. Overlay or otherwise display the recommended placement using original project rendering
10. Add `Analyze from here` at arbitrary replay placements

### Important product rule
An LLM is not the position evaluator. Bot/search output is the source of move recommendations. Any future natural-language coach should explain measured/search-derived results rather than invent them.

### First analysis UX
At minimum show:
- player's actual placement
- bot's preferred placement
- optional top candidate alternatives if supported reliably
- a short bot continuation

Do not invent a chess-like scalar evaluation unless the chosen bot provides a meaningful, interpretable value.

### Performance strategy
Start client-side. Do not add paid/server compute merely to avoid optimizing the browser path. Establish actual mobile performance first.

### Exit criteria
- Analysis works from reconstructed replay state.
- Bot work does not freeze the UI.
- Analysis is cancellable.
- Same state + same deterministic bot settings gives stable results where the bot permits determinism.
- Works on at least one realistic mobile target at a useful analysis budget.
- Bot license obligations are documented and satisfied.

### Required handoff report
- bot interface
- performance benchmarks
- licensing/build notes
- unsupported state/ruleset cases
- plan for branch continuation

---

## Phase 5 - Branch analysis and bot-assisted practice

### Goal
Turn the viewer into a learning environment rather than a move-suggestion screen.

### Part A: Replay branch analysis
From any replay position:
1. Fork the canonical state.
2. Let the bot play one or more pieces.
3. Let the user continue from the branch.
4. Keep the original replay immutable and switchable for comparison.

Implement analysis modes only when their semantics are explicit. At minimum distinguish:
- single-position/best-move analysis
- continuation from the current state

If implementing a "same pressure" mode that reuses the original incoming-garbage timeline, label it clearly as a counterfactual training mode, not a literal alternate-history replay.

### Part B: Zen-like practice sandbox
1. Start an independent practice board using the same engine.
2. User can play normally.
3. Undo/redo or branch history sufficient for learning.
4. `Hint`: show a suggested placement without executing it.
5. `Bot 1 move`: bot places one piece.
6. `Bot N moves`: bot demonstrates a short continuation.
7. `Take over`: bot continues until stopped or a defined condition is met.
8. `Give back`: user resumes from the bot-produced state.
9. Compare user line versus bot line when practical.

### Do not fake explanation quality
Do not generate claims like "this is a blunder" unless there is an explicit metric supporting that label.

### Exit criteria
- A replay position can be forked without altering the source replay.
- User and bot can alternate control in practice mode.
- Undo/branch semantics are reliable.
- Incoming-garbage counterfactual modes are visibly labeled and tested.
- Practice works with touch controls on mobile.

### Required handoff report
- branch/state-history model
- practice control semantics
- analysis-mode semantics
- remaining gaps before public beta

---

## Phase 6 - Public beta hardening and GitHub Pages release

### Goal
Prepare `Tetrp` for a public MIT repository and usable GitHub Pages beta.

### Required scope
1. Repository cleanup and license review
2. Ensure no official TETR.IO source/assets have entered git history
3. README with project purpose and independence disclaimer
4. Clearly state post-game/offline training scope
5. Document supported replay versions and bot support
6. Mobile accessibility/usability pass
7. Error handling for malformed/unsupported replays
8. Performance profiling and bundle-size review
9. PWA/offline-cache sanity checks
10. CI for tests and production build
11. GitHub Pages deployment workflow

### Explicit non-goals for beta unless separately approved
- accounts
- cloud synchronization
- server compute
- live TETR.IO integration
- ranked-match assistance
- official TETR.IO look/branding

### Exit criteria
- Clean repository audit passes.
- CI passes from a fresh checkout.
- GitHub Pages deploy is reproducible.
- Core flow works: import replay -> review -> analyze position -> branch/practice.
- Mobile core flow is usable without desktop-only interactions.
- Known limitations are documented instead of hidden.

---

## Gate rule for Codex

At the end of every phase, STOP. Report the exit-criteria status and wait for review before beginning the next phase.

Do not interpret "long-term product goal" as permission to implement future phases early.
