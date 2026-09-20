# Tetrp Phase 4 Plan

> This document is the authoritative Phase 4 scope.
>
> If older handoff packages, roadmaps, research notes, or historical Phase 4/5 plans conflict with this document, this document takes precedence.
>
> Implement Phase 4A first.
> Stop for review after Phase 4A.
> Do not begin Phase 4B until explicitly approved.

## Current product direction

### Product clarification — snapshot input and progressive reveal (2026-09-20)

This clarification supersedes earlier requirements to recover observed draw history
for Kiwi analysis. It records the requested behavior; it does not authorize starting
Phase 4B or claim that the existing Phase 4A implementation already conforms.

- Pause the entire replay before invoking Kiwi. Keep the recorded replay and both
  players' playback frozen while analysis is active.
- Each decision receives only a detached current visible snapshot: own board,
  current piece and position, exactly NEXT 5, Hold piece/availability, current
  combo/B2B, observable pending garbage, and relevant public rules/time/counters.
  Current counters remain valid snapshot data even though gameplay produced them.
- Do not replay earlier inputs or collect previous draws to infer a remaining
  SevenBag set for analysis. Do not use piece-count modulo seven or hidden queue/RNG
  to reconstruct that information indirectly. Unknown bag state is not a known
  fresh full bag. The Kiwi API must explicitly support the chosen snapshot-only
  search semantics; omission or a fabricated bag_state is not an implementation.
- For a future authorized continuation, Tetrp owns an isolated branch with the
  original piece sequence at the selected position. Only Tetrp may retain the
  private sequence cursor/generator. Kiwi receives no raw replay, hidden sequence,
  RNG, opponent board, future attacks, or original player's future placements.
- Reveal new pieces as branch actions consume draws, not according to the recorded
  player's frame or placement number. Tetrp refills exactly NEXT 5 before each new
  Kiwi decision. A single decision's visibility limit does not limit the whole
  continuation to its initial six visible pieces.
- Empty Hold is a separate authority action: move current into Hold, draw the new
  current, immediately refill NEXT 5, then re-analyze with Hold locked. Do not commit
  the pre-Hold landing without giving Kiwi the newly revealed preview. Occupied Hold
  exchanges pieces without consuming the sequence; NEXT 5 stays unchanged and Hold
  becomes locked. Any subsequent analysis must respect that lock.
- Tetrp executes and validates every action, then supplies the actual resulting
  visible state. Never substitute the original player's later board. Unknown future
  garbage is not authorized merely because future pieces can progressively reveal.
- On leaving analysis, cancel work, terminate its Worker, discard branch/search/
  recommendation data, and return to the unchanged recorded position paused. Do not
  persist analysis history. Static PWA program assets may remain cached for offline use.

Open implementation decision: unknown-tail evaluation (for example, ending search
at the known queue versus an explicitly declared uncertainty model) must be specified
and tested in the Kiwi integration. No particular new API or unknown-tail algorithm
has yet been approved or delivered. Both no-pending and pending-aware paths must
obey the same snapshot boundary and the 200,000 evaluator-node default budget.

Acceptance checks for the revised contract:

- Identical allowed snapshots produce the same analysis regardless of earlier replay
  draws or unrevealed sequence tails under the same deterministic search settings.
- Analysis preparation does not scan the observed replay prefix.
- Empty Hold immediately reveals one new preview and requests analysis with Hold
  unavailable; occupied Hold reveals none; lock/spawn refills previews as required.
- Branch draws match the original sequence under each action's actual consumption,
  including empty Hold, without exposing unrevealed pieces to Kiwi.
- Exit frees analysis resources and leaves the recorded replay checkpoint unchanged.

See `docs/PHASE_4A_HANDOFF.md` for the current implementation gaps.

Tetrp is a replay viewer plus bot-assisted stacking analysis and demonstration platform.

The current official scope is:

- accurate TETR.IO replay loading and reconstruction;
- replay viewing on desktop and mobile;
- bot analysis from any supported replay position;
- bot stacking demonstration from that position.

The following previously discussed ideas are no longer part of the official roadmap:

- interactive Zen / practice mode;
- player-controlled analysis branches;
- player and bot alternating moves;
- bot takeover followed by handing control back to the player;
- a playable Tetris sandbox.

Phase 4 is split into:

- **Phase 4A — Bot Integration / Analyze From Here**
- **Phase 4B — Bot Stacking Demonstration**

Phase 4A must be completed and reviewed before Phase 4B begins.

---

# Phase 4A — Bot Integration / Analyze From Here

## Goal

Complete this pipeline:

```text
Replay position
↓
Canonical Tetrp state
↓
Bot adapter
↓
Bot execution
↓
Normalized bot result
↓
Viewer recommendation overlay
```

The minimum success condition for Phase 4A is:

> At any supported replay placement, the user can request analysis, the bot evaluates the current state, and Tetrp correctly displays the recommended placement.

---

## 4A.1 Bot adapter layer

Create a bot-independent adapter boundary.

The viewer and replay engine must not depend directly on Cold Clear 2-specific APIs or data structures.

A conceptual interface may look like:

```text
BotAdapter
  initialize()
  analyze(state, options)
  cancel()
  dispose()
```

The actual implementation may differ if a cleaner design is appropriate.

Input must come from Tetrp canonical state, not raw replay data.

The adapter should expose only the information required for analysis, including as appropriate:

- board;
- current piece;
- hold piece;
- hold availability;
- next queue;
- relevant game rules;
- relevant incoming garbage context.

The bot adapter must not depend on DOM state or viewer layout.

---

## 4A.2 First bot integration

Use **Cold Clear 2** as the first bot integration.

**Cold Clear 2 is the required Phase 4A bot. Do not substitute the original Cold Clear or another bot implementation.**

Preferred technical direction:

- browser-local execution;
- WASM where practical;
- bot computation in a Web Worker;
- no cloud bot service;
- no backend requirement;
- no UI-thread blocking.

Before implementation, verify the current upstream Cold Clear 2 integration/build path, browser/WASM feasibility, public API surface, and license terms. If the actual Cold Clear 2 upstream design differs from assumptions in this plan, adapt Tetrp's bot adapter around the real Cold Clear 2 implementation rather than falling back to the original Cold Clear.

Cold Clear 2-specific structures should remain behind the bot adapter boundary.

Do not scatter Cold Clear 2-specific logic across replay, engine, or viewer modules.

---

## 4A.3 Canonical-state bridge

Create a clear conversion layer:

```text
Tetrp canonical state
→ bot input state
```

This layer must define the information boundary explicitly.

The bot may only receive information that is legitimately available at the current replay position.

Do not expose future information merely because the replay file contains it.

At minimum, handle correctly:

- visible board;
- current piece;
- hold;
- hold availability;
- next queue depth;
- relevant rule configuration.

If TETR.IO state and the bot's rule model cannot be mapped exactly:

- document the limitation;
- fail explicitly where necessary;
- do not modify Tetrp canonical engine state to make the bot happy;
- do not invent unsupported rule semantics.

---

## 4A.4 Normalized bot result

Bot-specific output must be normalized before it reaches the viewer.

At minimum, expose a result equivalent to:

```text
BotMove
- piece
- x
- y
- rotation
- useHold
- optional score/evaluation
```

The adapter may also expose:

```text
candidates[]
```

if the bot naturally supports multiple candidate moves.

A full candidate-ranking UI is not required for Phase 4A.

The normalized result must not leak unnecessary Cold Clear 2-specific internal structures into the viewer.

---

## 4A.5 Viewer UX

Add an Analyze action to the existing replay viewer.

Basic interaction:

```text
Pause at a replay placement
↓
Analyze
↓
Bot computes
↓
Recommended placement appears on the board
```

The recommendation should be projected directly onto the existing board UI.

Prefer a simple presentation such as:

- ghost placement;
- outline;
- clear recommended orientation;
- clear Hold indication if Hold is required.

While analysis is running:

- provide a visible thinking/loading state;
- allow cancellation where practical;
- keep the viewer responsive.

Changing replay position invalidates the current analysis result.

An asynchronous result for an old position must never overwrite the current position's analysis.

---

## 4A.6 Analysis state and replay state must remain separate

Bot analysis must never mutate replay reconstruction.

Example:

```text
Replay:
80 → 81 → 82 → 83 → 84

              ↑
           Analyze
              │
              └── Bot recommendation
```

Closing or clearing analysis must leave:

- the replay position unchanged;
- canonical replay state unchanged;
- the next replay placement unchanged.

Analysis overlays are presentation state, not replay state.

---

## 4A.7 Cancellation and concurrency

Bot calculation may take time.

Handle at least:

- cancellation of the current analysis;
- invalidation when replay position changes;
- stale worker responses;
- worker errors;
- worker restart / disposal;
- repeated Analyze requests.

Use request identity, generation counters, abort semantics, or another reliable mechanism to ensure stale bot results cannot update the current viewer state.

---

## 4A.8 Phase 4A non-goals

Do not implement:

- player-controlled branches;
- Zen / sandbox gameplay;
- keyboard/controller gameplay for playing pieces;
- bot takeover;
- interactive practice mode;
- live TETR.IO board reading;
- screen reading;
- input injection;
- ranked/live assistance;
- account/backend systems;
- cloud bot computation;
- natural-language coaching.

---

## Phase 4A acceptance criteria

Verify at least:

- a 40L replay can be analyzed at arbitrary supported placements;
- a supported TL replay stream can be analyzed at arbitrary supported placements;
- board conversion is correct;
- current piece is correct;
- Hold state is correct;
- Next queue is correct;
- bot output maps correctly back into Tetrp coordinates;
- Hold recommendations render correctly;
- recommendation overlays do not mutate replay state;
- seeking to a new position causes a new analysis to use the new state;
- stale bot responses cannot overwrite newer analysis;
- analysis can be cancelled or invalidated cleanly;
- mobile UI remains responsive during bot computation;
- existing replay, engine, viewer, and PWA tests continue to pass.

At the end of Phase 4A, Tetrp should be able to answer:

> If the bot were playing from this replay position, where would it place the next piece?

## Phase 4A gate

After Phase 4A is complete:

1. update or create a Phase 4A handoff documenting actual implementation;
2. run the full regression and browser test suites;
3. report limitations and bot/state-mapping assumptions;
4. stop for review.

**Do not begin Phase 4B until explicitly approved.**

---

# Phase 4B — Bot Stacking Demonstration

## Goal

After Phase 4A is stable, extend single-move analysis into an analysis-only continuation.

The user may start a bot demonstration from any supported replay position.

The bot then places multiple pieces in an isolated branch.

This branch exists only for viewing and analysis.

The user does not directly control pieces inside the branch.

---

## 4B.1 Branch architecture

The bot demonstration branch must remain completely separate from the original replay timeline.

Example:

```text
Original replay:

80 → 81 → 82 → 83 → 84 → 85 → 86
              │
              └── Bot branch
                  B1 → B2 → B3 → B4 → B5
```

The original replay must remain intact.

Leaving Bot Demo returns to the original replay position from which the branch was created.

The bot branch must not rewrite or replace original replay history.

---

## 4B.2 Branch starting point

Create the demonstration branch from the canonical checkpoint at the current replay position.

Conceptually:

```text
current replay checkpoint
↓
fork isolated analysis state
↓
bot analyze
↓
apply bot move to branch engine
↓
advance branch state
↓
bot analyze next state
↓
repeat
```

Do not modify the original Reconstruction object.

Use existing deterministic engine / checkpoint / fork capabilities wherever appropriate rather than duplicating gameplay simulation.

---

## 4B.3 Demonstration length

The first implementation should use bounded continuation.

Reasonable examples:

- 5 pieces;
- 10 pieces;
- 20 pieces.

The exact UI may be adjusted based on implementation quality.

Infinite autoplay is not required.

Avoid runaway computation and keep cancellation straightforward.

---

## 4B.4 Piece-information boundary

The bot continuation may only use information available from the branch state.

The canonical branch engine preserves the original piece sequence and refills NEXT 5
after every draw, including an empty Hold before lock. Its private deterministic
sequence/RNG state must never cross the Kiwi boundary. Follow the snapshot and
progressive-reveal clarification above; do not wait for the visible queue to empty.

Do not:

- inspect the original player's future placements;
- use future replay actions to guide the bot;
- leak future replay information merely because it exists in the file.

The bot branch is an independent simulation beginning at the selected checkpoint.

---

## 4B.5 Multiplayer and garbage boundary

Treat multiplayer continuation conservatively.

Future opponent actions may not be known independently of the original replay timeline.

The first Phase 4B implementation may define bot demonstration as:

> continuation from the current known state without unknown future opponent actions.

If future garbage or opponent interactions cannot be simulated faithfully, expose that as a limitation.

Do not silently mix two different meanings:

1. independent bot continuation;
2. bot continuation against the recorded opponent's future timeline.

If a future mode intentionally supports the second behavior, it must be explicitly designed and labeled.

---

## 4B.6 Bot Demo viewer

The bot demonstration UI should allow at least:

- viewing the current bot placement;
- previous bot move;
- next bot move;
- current bot move index / total;
- board;
- Hold;
- Next;
- returning to the original replay.

Reuse Phase 3 viewer/navigation concepts where practical.

Do not build an entirely separate replay player unless genuinely necessary.

---

## 4B.7 Per-move metadata

Each bot placement may retain analysis metadata such as:

- input canonical-state identity/hash;
- chosen move;
- Hold usage;
- evaluation;
- resulting state;
- calculation metadata.

This information belongs to the analysis branch only.

Do not write it back into the replay document.

---

## 4B.8 Optional candidate moves

If the adapter naturally exposes multiple candidates, Phase 4B or a later refinement may expose alternatives such as:

```text
Best
Alternative 1
Alternative 2
```

This is optional.

Do not couple the public bot adapter to one bot's evaluation format merely to support a ranking UI.

---

## 4B.9 Phase 4B non-goals

Do not implement:

- player-controlled tetromino movement inside the branch;
- alternating player/bot moves;
- bot takeover followed by handing control back;
- interactive training sandbox;
- live-game assistance;
- matchmaking;
- online opponent simulation;
- lesson generation;
- LLM coaching.

These are outside the current official Tetrp scope.

---

# Phase 4 final product flow

After Phase 4A:

```text
Load replay
↓
Review game
↓
Stop at interesting position
↓
Analyze
↓
See bot recommendation
```

After Phase 4B:

```text
Load replay
↓
Review game
↓
Stop at interesting position
↓
Analyze
↓
See bot recommendation
↓
Optionally watch bot continuation
↓
Return to original replay
```

---

# Architecture principles

Maintain this separation:

```text
Replay Parser
      ↓
Reconstruction / Engine
      ↓
Canonical State
      ↓
Bot Adapter
      ↓
Cold Clear 2 Worker / WASM
      ↓
Normalized Analysis Result
      ↓
Viewer
```

## Bot must not

- directly consume raw replay data;
- modify Reconstruction;
- directly control viewer DOM;
- define Tetrp canonical gameplay rules.

## Viewer must not

- understand Cold Clear 2 internal state;
- independently reconstruct bot boards;
- duplicate gameplay simulation.

## Engine must not

- change gameplay rules to satisfy the bot;
- contain Cold Clear 2-specific logic.

---

# Privacy and deployment constraints

Maintain the current client-local architecture.

- Replay data remains local to the user's device.
- Bot computation should remain local where practical.
- Do not upload replay state to a bot service.
- Do not add a backend merely for bot analysis.
- Preserve GitHub Pages / PWA compatibility.
- Current replay persistence behavior must continue to work.
- Do not persist bot analysis history unless separately justified.

---

# Public project boundary

Tetrp remains an independent replay-analysis project.

Phase 4 should not introduce:

- official TETR.IO assets;
- copied TETR.IO UI;
- live-game automation;
- screen-reading assistance;
- input injection;
- ranked-game assistance.

Bot features are for offline/post-game replay analysis and demonstration.

---

# Phase 4 completion conditions

## Phase 4A complete when

A supported replay position can be transformed into canonical bot input, analyzed locally, and rendered as a correct next-move recommendation without mutating replay state.

## Phase 4B complete when

A supported replay position can create an isolated analysis branch, the bot can make a bounded sequence of moves, the user can inspect those moves, and the user can return to the unchanged original replay.

After Phase 4B, move to public beta / hardening rather than interactive practice mode.
