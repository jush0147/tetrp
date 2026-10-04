# 本輪最後兩批：井深0／0.6

2026-10-04，source `c9feb5a5148b9fe6cd685bc73ebbc5bd0f207f28`。

1. [37200417596](https://github.com/jush0147/tetrp/actions/runs/37200417596)：variant=well-off，tetris_well_depth=0。確認run／gate in_progress後才送第二批。
2. [37200443114](https://github.com/jush0147/tetrp/actions/runs/37200443114)：variant=well-double，tetris_well_depth=0.6。確認pending、jobs為空。

兩批同concurrency group依序執行，各自gate成功後200新KO，重用原accepted井深0.3控制；其餘原accepted參數保持。遵守WELL_DEPTH_PLAN.md，非原生Kiwi重做、非Surge改動，artifact共用內部名稱須以run／manifest.variant識別。

每批完成或失敗ntfy通知just_a_kiwi_for_tetrp，不持續監看。沒有第三批queue。**完成這兩批後停止本輪參數盤點，不自動跑combo或第6–12項；下一階段才選強化方向與新seed確認。** 不自動promotion，production不變。

派送時僅本機18 checks、0.6環境8 checks、整合installer真實source核對通過；Rust／public gate仍待Actions完成，不預先聲稱通過。
