# TETR.IO v19 Tetra League garbage-hole RNG behavior

Source basis: behavior traced from the v19 production client in the local standalone package.

## Relevant current TL defaults

- `garbageholesize = 1`
- `garbagefavor = 0`
- `messiness_change = 1`
- `messiness_inner = 0`
- `messiness_nosame = false`
- `messiness_center = false`
- `roundmode = down`

For ordinary 10-wide play this makes a newly rerolled hole uniformly selected from columns 0 through 9 using the extra RNG stream (`rngex`).

## PRNG

`rngex` is the same Park-Miller minimal-standard generator used elsewhere by the engine:

- modulus: 2147483647
- multiplier: 16807
- next seed: `(16807 * seed) mod 2147483647`
- float: `(nextSeed - 1) / 2147483646`

Both `rng` and `rngex` start from the match seed, but advance independently.

## Packet-level hole behavior

With TL defaults, an ordinary garbage packet keeps one hole column throughout the packet.

When that packet is exhausted, the engine always attempts a change because `messiness_change=1`, and it rerolls a new uniform hole for the next packet.

Thus a 4-line packet normally enters as four clean rows with one common hole, while the next packet normally begins with a different/randomly selected reroll (same-column repetition is allowed because `messiness_nosame=false`).

## Important RNG-consumption detail

`messiness_inner=0` does NOT mean the inner-hole random test is skipped.

When a packet has no explicit column and a last column already exists, each tanked row evaluates a random draw against zero. The condition can never succeed, but the RNG state still advances.

Therefore tanking N rows consumes RNG draws that cancellation of those N rows does not consume.

At packet exhaustion, two further draws normally occur:

1. one draw for the `random < messiness_change` check (`< 1`, always true but still consumes a draw)
2. one draw to select the newly rerolled column

For the first packet after `lastcolumn=null`, the first row directly rerolls a column without the failed inner test. For later rows/packets, the failed `inner=0` test continues to consume values.

## Cancellation interaction

When `FightLines()` fully removes an impending packet, the packet-completion path also performs the `messiness_change` random draw and rerolls the next column.

Partial cancellation does not reroll yet; the remaining packet keeps its identity and can later be tanked.

Consequently two matches with the same seed and same total garbage amount can reach different future hole RNG states if packet boundaries or cancel-vs-tank history differ.

This is one reason a faithful deterministic simulator must model packet identity and RNG call ordering, not just an integer pending-garbage count.

## Explicit-column packets

If a packet explicitly supplies a column, the normal per-row inner reroll branch is skipped for that packet line. Packet completion can still update the global next `lastcolumn` state under the usual messiness-change rule.

Ordinary server-generated TL garbage interactions observed in the client path do not need to include an explicit hole column; the receiving deterministic engine can generate holes from its local `rngex` state.

## garbagefavor path

When `garbagefavor != 0`, rerolling is no longer uniform. The engine scores candidate columns based on stack height and distance from the most recent garbage hole, adds a small RNG tiebreaker, applies configured center/no-same restrictions, and weighted-selects a column.

Current Tetra League leaves `garbagefavor=0`, so this weighted geometry-aware path is not used in standard TL.
