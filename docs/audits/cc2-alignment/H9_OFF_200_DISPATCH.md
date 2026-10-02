# H9-off dispatch — 2026-10-02

- Run: https://github.com/jush0147/tetrp/actions/runs/36996780368
- Commit: 97c3d6b2168c5101e583c4dc09f799e83436d4f6.
- Confirmed queued once after push. Do not dispatch a duplicate.
- User authorized candidate correctness checks followed by 200 KO games.
- Local: 27 targeted tests + four publication/provenance tests passed; actual
  source transform and exact public fixture restoration checked. Rust build
  and candidate runtime checks are pending in the Actions gate, not yet passed.
- Gate failure prevents arena. Successful gate automatically starts the fixed
  100 seed pairs / 200 KO batch, H9-off versus accepted baseline. One ntfy
  failure/completion message. No monitoring, no H1 or production promotion.
- Plan: H9_OFF_200_PLAN.md; frozen pre-build protocol: H9_OFF_200.json.
- Artifacts: kiwi-h9-off-build (gate/configs/source delta/binaries/runtime
  manifest), kiwi-h9-off-200-result, 50 summary and compressed trace shards.
- When user returns, inspect gate first. If the batch completed, audit all
  attempts against the runtime manifest and paired outcomes. Incomplete gate
  or technical failure is not strength evidence. Preserve traces within three
  days if diagnosis is needed; build/summary artifacts last 30 days.
