# Fixed replication batch — 2026-09-24

User authorized increasing scenarios after pilot run 35996830668. Only scenario seeds and job sharding change; frozen inputs, A/B roots, Legacy continuation, authority, cadence, synthetic IID tail/hole generation, KO scoring, mirror checks and watchdog remain unchanged. No new evaluator.

Four NEW seeds per case, fixed before outcomes:

- validation-1: 730201, 1849067
- validation-2: 6901181, 23009293

Every seed runs A/B in normal and mirrored seats: 16 matches/case, 48 total. Three cases × two shards, maximum three jobs simultaneously. Each shard has 270-minute battle timeout / 300-minute job timeout. Infrastructure interruption is incomplete, no scored outcome and no automatic replacement. Technical failure stops its shard; other shards may finish. There is no early stopping for favorable/unfavorable KO scores and no adaptive sample expansion.

Primary report separates these four new scenarios from the original two. Report each case's A-only wins, B-only wins, concordant wins/losses and excluded simultaneous-KO pairs. Mirror checks are duplicates for correctness, not new samples. Seeds are shared across cases, which are also from one replay, so do not pool cases as independent observations.

Pilot directions were B at F48, A at F120/F192, each based on only one discordant pair. On the new batch, call a direction 'repeated descriptive signal' only if at least two discordant pairs favor that same direction and none favor the opposite; otherwise report mixed, opposite, or insufficient discrimination. This is NOT a significance threshold, ground-truth label, strength claim or promotion gate. With four new futures/case this remains a small pilot. Original+new counts can be shown secondarily without changing the primary interpretation.

No further jobs, tuning, state replacement or FT7 are automatically triggered after completion. ntfy summarizes all six shards, clearly reporting partial/correctness failures. Artifact manifest and result record the batch and exact seeds; frozen input hashes must match the original pilot.
