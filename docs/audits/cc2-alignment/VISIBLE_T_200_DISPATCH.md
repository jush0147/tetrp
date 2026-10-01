# Visible-T fixed 200 dispatch

- Run: https://github.com/jush0147/tetrp/actions/runs/36892959080
- Created: 2026-10-01 16:34:03 UTC / 2026-10-02 00:34:03 Asia/Taipei.
- Source: `71f98f1a71c139e24d7fe1e522658dd61357e957`.
- Confirmed queued once after push; no duplicate manual dispatch.
- Preflight: 25 batch/pool/timing/client/authority/scoring tests and four
  provenance checks passed; syntax and staged whitespace checks passed.
- Configuration: [fixed plan](VISIBLE_T_200_PLAN.md), 200 single KO games,
  100 new seed pairs, 50 shards, at most 16 runners, two matches/runner.
- Only visible-T vs accepted CC2-based baseline. No H9/H1, no production
  promotion, no optional extension, no further performance pilots.
- Let Actions run without polling. Aggregate sends one ntfy notification to
  `just_a_kiwi_for_tetrp`; user will return for analysis.
- When user returns, download `kiwi-visible-t-200-result` and verify complete,
  all 200 correctness gates and any simultaneous-KO retry divergence before
  interpreting paired KO outcomes. Full traces expire after three days;
  compact summaries/results after 30. Incomplete is not strength evidence.
