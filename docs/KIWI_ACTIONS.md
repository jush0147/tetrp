# Unattended placement FT7

Workflow: `.github/workflows/kiwi-ft7.yml`. One Native versus Legacy FT7 uses
`tl-placement-v1`, top-1 only, 24 frames/placement, fresh per-round seeds and
alternating seats. Simultaneous KO is unscored and replayed. Any technical failure
or gameplay watchdog aborts the series unscored and preserves the failure dump.

The workflow runs the complete correctness test suite before starting the match.
Artifacts contain `result.json`, `events.jsonl` and `runner.log`, including source
hashes, seed settings, round results, parity counters and technical diagnostics.
Artifacts are retained for 30 days. No placement-mode TTRM is manufactured.

The FT7 step has a 240-minute infrastructure timeout; this is not a gameplay
frame cap or a win condition. Partial artifacts upload afterward when the runner
is available. A separate always-run notification job sends completion/failure to
`just_a_kiwi_for_tetrp` through the [ntfy JSON API](https://docs.ntfy.sh/publish/#publish-as-json),
including score, audit counts and the run/artifact link. Notification HTTP failures
are retried three times and then fail visibly in the workflow.

Initial rollout uses a push trigger restricted to branch `codex/kiwi-ft7-actions`
and this workflow file, so the experiment can run without deploying Pages or
merging into main. GitHub requires a workflow on the default branch for the
[manual dispatch event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).
After that rollout is merged, `workflow_dispatch` can select a new base seed.
Do not push follow-up workflow edits during a run unless another queued FT7 is
intended. Concurrency never cancels an existing run.

This is one sanity-check series, not a champion promotion or an evaluator-tuning
batch. No agent heartbeat/polling service is needed; Actions owns execution and
notification. Workflow/platform outages may prevent notification, in which case
the Actions run page remains the authoritative status.
