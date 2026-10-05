# Work allocation 診斷已派送

- Run: https://github.com/jush0147/tetrp/actions/runs/37330860246
- Source: `037695eaf5905266e013e5bcc731d5fcd17f3e14`
- 2026-10-05 已確認 workflow_dispatch、in_progress。尚無結果。
- [計畫](SEARCH_WORK_ALLOCATION_PLAN.md)：同4個public snapshots、原200k/search，插入式離線work counters；原完整report/final score重建必須一致。
- Artifact沿用 `kiwi-score-trace`，`observed.json` 的 diagnostic.allocations 和 `score-trace-summary.json` 的 rows[].work 包含計數。
- 無production／weight／策略更改，無arena；完成或失敗ntfy，不持續監看、不自動追加任務。
