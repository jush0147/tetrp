# Kiwi product clarification: snapshot analysis and progressive NEXT 5 reveal

Date: 2026-09-20

This is a supplemental product handoff from the Tetrp discussion to the Kiwi
implementation task. Read it alongside `PHASE_4_PLAN.md` (Tetrp's authoritative
scope), `PHASE_4A_HANDOFF.md`, and Kiwi's `TETRP_RULE_PARITY_GAPS.md` at
`502707dd24569a3e46ea6884a8620e2ec625dc95`.

The rule-parity work described in that ledger remains relevant. This document adds
product requirements discussed afterward; it does not imply that those requirements
were already implemented or tested by the reported authority/WASM gates.

## What the user actually wants

The user pauses the entire recorded replay at a selected position and invokes Kiwi.
Each Kiwi decision must use only the current visible snapshot, without reconstructing
the player's memory of earlier piece draws. In a future authorized continuation,
Tetrp executes a bot action in an isolated branch, reveals newly visible pieces from
the original piece sequence, then asks Kiwi to analyze the new snapshot.

The user does NOT mean that continuation stops after the initial current + NEXT 5.
The user also does NOT authorize giving Kiwi the full original piece sequence.

Tetrp remains gameplay authority. The recorded replay, including the other player's
playback, stays frozen. The hypothetical board evolves from Kiwi's actions through
Tetrp, never by copying the original player's later board or placements.

## Confirmed information contract

Each decision may receive:

- Own current board and active piece position/orientation.
- Current piece plus exactly five visible previews.
- Hold piece and explicit Hold availability / `hold_locked`.
- Current combo, B2B, observable pending garbage and supported arrival facts.
- Relevant public rules, authority time, attack multiplier and current counters.

Current counters are allowed snapshot facts; "no history" does not mean resetting
combo/B2B or pretending current pending garbage is absent.

Do not provide or derive for analysis:

- A log of previous draws, prior inputs or a history-derived SevenBag remainder.
- An equivalent bag remainder reconstructed from piece-count modulo seven or
  hidden engine state.
- Hidden queue tail, RNG, raw replay, opponent board, future attacks or original
  player's future actions/placements.

The revised contract supersedes the earlier product requirement to recover observed
draw history with `SevenBagObserver`. Tetrp should not rescan the replay prefix when
the user requests analysis. This does not change normal replay reconstruction needed
to reach the selected position.

Unknown bag state must be represented honestly. Do not fill `bag_state` with all
seven types and call that "unknown": the existing seven-bag contract treats that
as a known fresh bag at the preview frontier.

## Original sequence and visibility are separate responsibilities

Tetrp's isolated branch retains the original sequence cursor/generator privately.
Sequence consumption follows actual branch actions, not original-player frame or
placement numbers. Only pieces entering the visible window are sent to Kiwi.

- Lock/spawn consumes the next draw and refills NEXT 5.
- Empty Hold consumes a draw and refills NEXT 5 immediately, before lock.
- Occupied Hold exchanges pieces and consumes no draw; NEXT 5 is unchanged.

Newly revealed previews are legitimate current information, not a future leak.
Progressive piece reveal does not authorize replaying future opponent attacks.
Unknown incoming activation must still be handled explicitly, never discarded.

## Empty Hold must allow a second decision

Example (L is initially hidden from Kiwi):

```text
Before: current=T, Hold=empty, NEXT=[I,O,S,Z,J], hold_locked=false
Kiwi chooses Hold
Tetrp executes only Hold and consumes the next original-sequence draw
After:  current=I, Hold=T,     NEXT=[O,S,Z,J,L], hold_locked=true
Kiwi analyzes this new snapshot and chooses I's placement
Tetrp validates and executes the placement
```

Do not execute a bundled pre-Hold landing automatically and skip the newly revealed
information. The post-Hold decision must prohibit another Hold at its root; normal
Hold availability returns after the next lock/spawn according to Tetrp authority.

The reported root `hold_locked` fix is necessary and useful, but does not by itself
prove this whole interaction is supported. Action identity must be unambiguous.
Inferring Hold solely from a different played piece type is insufficient for a
general same-piece Hold contract. Specify explicit Hold intent/action semantics,
and state any remaining same-piece Hold exclusion rather than disguising it as
fully supported player-view behavior.

The user requests aligned visible information, not necessarily identical human
reaction times. Execution timing and garbage behavior still need their own explicit
authority contract; snapshot visibility must not silently settle those questions.

## Decisions still needed from Kiwi

No new JSON field name, exported function, or unknown-tail algorithm is prescribed
by this handoff. Propose the concrete API and behavior before presenting them as
supported by the artifact:

1. How a search accepts a current snapshot without a known SevenBag remainder.
2. How it evaluates beyond the known queue: stop at a finite known horizon, or use
   an explicitly declared uncertainty model based only on permitted information.
   The finite-horizon idea was discussed as an option, not approved as a mandatory
   implementation. Neither approach may inspect the real hidden tail.
3. How Hold intent is returned, how Tetrp executes Hold separately, and how the next
   search accepts the post-Hold visible window with the root Hold lock.
4. Whether same-piece Hold is supported and how action identity is represented.
5. How both persistent and snapshot paths obey this contract. Unknown-bag handling
   must not work only for positions without pending garbage.

Default evaluator budget remains 200,000 nodes per search request. A second request
after Hold is another decision, not a reason to silently multiply a single request's
budget. Report actual nodes and any early completion. Search stays in a dedicated
Worker; no main-thread fallback is authorized.

Persistent reuse must not introduce hidden history dependence. For the same allowed
snapshot, budget and deterministic search settings, earlier replay draws or another
analysis session must not change the recommendation.

## Existing rule repairs and product routing

Carry the repaired public rule contract and `hold_locked` into the new browser
artifact. Keep the existing pending-aware path. Also route roots with no pending
but non-unit attack multiplier through snapshot analysis while the persistent DAG
cannot represent the authority attack clock. Do not silently fall back to multiplier 1.

Continue the opener double-cancel and full clutch fixture verification from the
parity ledger. Preserve truthful capability flags for remaining approximations,
including pending pace/hole scenarios/ARE timing and unsupported rule variants.

## Required acceptance evidence

1. Identical allowed snapshots, different earlier draws: same deterministic result;
   no historical SevenBag recovery is required by the request builder.
2. Identical allowed snapshots, different hidden tails/RNG/opponent data: same
   request and result. Hidden pieces do not appear in the Worker message.
3. Empty Hold reveals exactly one new preview immediately; the second decision
   receives that preview and `hold_locked=true`, and cannot Hold again.
4. Occupied Hold consumes no draw; verify explicit action identity, including any
   supported same-piece case.
5. Lock/spawn restores Hold availability and refills previews correctly; continuation
   can proceed beyond the initial six known pieces using successive snapshots.
6. Branch piece consumption matches the original sequence across Hold and locks,
   without using original-player future placements or exposing the hidden tail.
7. Pending and no-pending/non-unit-multiplier cases retain correct routing, public
   rule fields, and the per-request hard node budget.
8. Tetrp checkpoints remain unchanged; cancellation/exit discards branch, search
   state and results. Static PWA WASM/program cache may remain for offline use.

Tests of the action protocol may use an isolated authority harness. They are not
permission to add user-visible continuation in Tetrp before Phase 4B is authorized.

## Delivery and current status

Tetrp still pins `kiwi-v1-browser` build `35444205867`, source/build commit
`89dcfe6cf544991bc9bb59098dd43d2ca2173945`. Its Phase 4A still performs observed-prefix
scanning, rejects Hold-locked roots, and uses the older rule/multiplier behavior.
Documentation updates are not runtime fixes.

Please add these product gaps to the Kiwi ledger, propose the missing API semantics,
implement and verify the agreed contract, then deliver a newly pinned
`kiwi-v1-browser` artifact with updated `kiwi-build.json`, browser/WASM package,
adapter/path helpers, capabilities and handoff. State exact source/build commit,
workflow/artifact identifiers, validation evidence and unresolved limitations.

Do not switch Tetrp to `wasm-port`, another bot, or a direct Rust-source vendor.
Repairs on `tetrp-authority` must be deliberately released into the designated Kiwi
artifact before Tetrp can consume them. No fresh strategy tuning is requested here.

Tetrp remains at the Phase 4A review boundary. This clarification does not authorize
Phase 4B. On future exit from analysis, discard analysis resources and return to the
unchanged recorded position paused; do not persist analysis history.
