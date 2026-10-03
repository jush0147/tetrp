# Surge residual gate → 200新KO dispatch

- [Run37124362998](https://github.com/jush0147/tetrp/actions/runs/37124362998)，已確認in_progress。
- Source `ad12c853b5648d8d69038238428c3035fa666e84`。
- 按[SURGE_RESIDUAL_PLAN.md](SURGE_RESIDUAL_PLAN.md)，0.5折價已充能gross residual，公開next-lock multiplier，其他權重保持。
- 本機11 tests、20public restore、source transforms、原控制artifact核驗通過，192 authority fixtures已生成。Rust full-eval與snapshot gate待run，不提前稱通過。
- Gate通過（含charged top1改變）自動接200新candidate KO，重用accepted200；失敗停止。完成／失敗ntfy，不盯跑，不額外隊列。
- 正常repo CI另為37124362963。
