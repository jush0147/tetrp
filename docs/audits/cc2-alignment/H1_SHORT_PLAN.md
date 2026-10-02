# H1 activation diagnostic against original Tetrp Legacy

User accepted this bounded next step after the direct H1-on/off mirror batch
was cancelled. Four games: accepted vs Legacy in both seats, H1-off vs the
same Legacy in both seats. Common seed2026150001 for all four games; within
each game both seats use that same piece seed. Seat-fixed holes seed+1/+2.

Legacy is the vendored Tetrp Kiwi snapshot-v3.2 via existing profile('legacy')
and fair prepareKiwi adapter, NOT original upstream CC2. Verify vendored
JS/WASM hashes against artifact-lock.json. Reuse H1 gated binaries/configs
from run37004950142; the cancelled arena does not invalidate its successful
candidate gate. H9=-0.5 stays enabled in both aligned profiles.

All bots get only PublicSnapshot and200k node budget per request, same24
virtual-frame cadence. Shadow H1-on and H1-off queries get the exact same
snapshot at each aligned-policy decision including after Hold. Only the
designated policy supplies its action to the referee. Extra diagnostic CPU
does not advance virtual time or change garbage delivery order.

Stop each game at KO or2400frames (100placements per side), whichever comes
first. Non-KO horizon is explicitly unscored; no attack/height/time winner.
Even observed KO is diagnostic, not strength evidence. No automatic200 batch.
Keep all mandatory top-1/Hold/spin/cells/lock/clear checks, zero fallback.

Capture board divergence, public pending counts, same-snapshot candidate
score and top-1 differences. Select at most two observed witnesses per leg:
first pending-positive state and first top-1 disagreement (may coincide).
Replay their exact public requests offline through an insertion-only H1
counter observer in accepted source. Require exact full-report equality to
the original accepted report, then record actual evaluated-node H1 deltas,
nonzero counts and ranges. Terminal early-return nodes are excluded. Do not
substitute a static root-board proxy for actual searched H1 contributions.

Per-request stage saved to compact leg JSON; progress logged every25
placements. Four independent jobs, max4parallel, game-step15min/job20min
technical bound; aggregate/observer15min. Failed gate/mismatch/timeout means
incomplete diagnostic, not a scored loss. Once-only ntfy after aggregate.
No continuous monitoring or automatic retry. Inspect this result before
choosing a strength protocol; no guarantee that100placements triggers H1.
