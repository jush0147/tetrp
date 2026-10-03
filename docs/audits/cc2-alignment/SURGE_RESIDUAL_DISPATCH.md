# Surge residual gate → 200新KO dispatch

修正後重派：[37124649645](https://github.com/jush0147/tetrp/actions/runs/37124649645)，source `c290518d5e28df680a2f3d1194e7301bc1fa81a2`，已in_progress。前次因bank初始化覆寫失敗、無arena；見[失敗與修正](SURGE_RESIDUAL_FAILURE_37124362998.md)。實驗公式/權重/門檻不變，gate全過才200KO，ntfy、不持續監看。標準repo CI為37124649668。

- [Run37124362998](https://github.com/jush0147/tetrp/actions/runs/37124362998)，已確認in_progress。
- Source `ad12c853b5648d8d69038238428c3035fa666e84`。
- 按[SURGE_RESIDUAL_PLAN.md](SURGE_RESIDUAL_PLAN.md)，0.5折價已充能gross residual，公開next-lock multiplier，其他權重保持。
- 本機11 tests、20public restore、source transforms、原控制artifact核驗通過，192 authority fixtures已生成。Rust full-eval與snapshot gate待run，不提前稱通過。
- Gate通過（含charged top1改變）自動接200新candidate KO，重用accepted200；失敗停止。完成／失敗ntfy，不盯跑，不額外隊列。
- 正常repo CI另為37124362963。
