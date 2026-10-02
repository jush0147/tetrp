# H1-off dispatch — 2026-10-02

- Run: https://github.com/jush0147/tetrp/actions/runs/37004950142
- Commit: 8450160f2c71f10299dcb1222cc8d68b98ced610.
- Confirmed in progress after a single push trigger. Do not dispatch again.
- User authorized continuing H1-off after H9-off result review.
- Only pending_safety=1 -> 0; H9 remains -0.5, other accepted settings fixed.
- Local 29 targeted tests plus four provenance checks passed. Actual source
  transform and syntax checks passed. Rust build/config/authority gate is
  pending in Actions; do not claim it passed yet.
- Gate success automatically starts fixed 200 KO / 100 new paired seeds.
  Gate failure prevents arena and sends ntfy. Completion/failure notification
  uses just_a_kiwi_for_tetrp. No live monitoring, optional extension, next
  candidate or automatic production promotion.
- Artifacts: kiwi-h1-off-build (gate, configs, binaries, manifest, source delta),
  kiwi-h1-off-200-result, per-shard summaries and compressed traces.
- On return: verify gate, exported config difference, hashes and manifest,
  all attempt correctness, then paired KO statistics. Full traces three days;
  build and summaries 30 days. Plan/protocol: H1_OFF_200_PLAN.md/H1_OFF_200.json.
