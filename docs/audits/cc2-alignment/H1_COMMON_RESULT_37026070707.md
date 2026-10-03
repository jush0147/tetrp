# H1 common-opponent result — 37026070707

Run: https://github.com/jush0147/tetrp/actions/runs/37026070707

All 101 jobs succeeded. Locally recomputed the prespecified aggregate from all 100 blocks and obtained identical statistics. Verified plan hash, commit, binary identities, Legacy lock, seed/seat/cadence settings and all per-game correctness checks. All 400 games ended in single KO; no simultaneous KO or retry, technical failure, watchdog, unsupported-rule/certificate rejection, parity mismatch or fallback.

350,612 placements and 131,018 Holds passed authority parity; 481,631 requests. There were 131,017 Hold reanalyses plus one terminal Hold (block20/leg3, H1-off seat1, authority garbagesmash), accounting for the difference without an omitted reanalysis. This is aggregate/event-counter verification, not a fresh replay of all compressed event traces.

| Treatment against frozen vendored Legacy | KO score | Win rate |
|---|---:|---:|
| H1 on / accepted | 104–96 | 52.0% |
| H1 off | 107–93 | 53.5% |

The primary paired estimate, off minus on, is **+1.5 percentage points**, approximate 95% CI **−7.79 to +10.79 points**. This does not establish benefit, harm, equivalence, or that H1 is useless. The experiment compares performance against the same Legacy, not direct H1-on/off wins or universal strength. Neither score alone supports a claim of reliably beating Legacy.

Block differences (off wins minus on wins across two seats): −2 in2 blocks, −1 in31, zero in34, +1 in28, +2 in5. Hence 33 blocks favor off, 33 favor on and34 tie. Identical win counts do not establish identical actions. Seat win counts: on51/53; off61/46. These are descriptive, not post-hoc grounds to select a seat or change the protocol.

## Decision and cost

Keep H1=1 in accepted; do not adopt H1-off, tune a weight from this score, or append games until significant. H9 stays -0.5. The planned initial sequence is complete: visible-T inconclusive, H9-off harmful in its direct comparison, H1-off inconclusive against the common opponent. These are different comparisons and must not be combined into one feature ranking.

Wall time from first job start to aggregate completion: **3h20m13s**. Summed job duration approximately48.35 runner-hours (not a billing claim). Final completion was2026-10-03 02:38:59 Asia/Taipei. No new run dispatched during review.

Next step is to choose and predeclare one further mechanism hypothesis from the existing semantics inventory; no remaining order for other parameters was previously agreed. Do not silently label H1 settled as useful/useless or launch another400 games. Production remains unchanged. Record any future hypothesis separately before implementation.

Compact audited counts and all100 block outcomes: [JSON](H1_COMMON_RESULT_37026070707.json). Source evidence: `h1-common-result` artifact; per-block traces retain only three days under the predeclared plan.
