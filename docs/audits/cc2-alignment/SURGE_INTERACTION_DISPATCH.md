# Boolean × Surge 兩批派送

2026-10-03，使用者明確授權先補第四格，再queue兩個都是1。

- Source commit：`08d762d389a082f856a92bce1bbf50b2cc760538`。
- 第一批 [37133089622](https://github.com/jush0147/tetrp/actions/runs/37133089622)：`variant=boolean-off`，Boolean=0、bank=0.5，200新KO；派送後確認run及gate為in_progress。
- 確認第一批開始後才派第二批 [37133115397](https://github.com/jush0147/tetrp/actions/runs/37133115397)：`variant=both-one`，Boolean=1、bank=1，200新KO；已確認pending、jobs為空，未佔第二套對戰runner。
- 兩批同concurrency group，不取消正在跑的run。第二批在第一批結束後自行過gate；沒有runner sleep/poll，也沒有第三個pending。
- workflow已移除push觸發，只明確dispatch兩次；一般repo CI不是第三批arena。
- 每批各自gate→200KO、重用accepted控制、結果/失敗ntfy。artifact名稱相同但分屬不同run，下載分析須以run ID區分；manifest含variant、權重、binary SHA，plan hash亦區分變體。
- 本機13項含provenance通過，另以兩個variant環境各跑9項回歸通過；真實accepted source profile轉換核對通過。Rust編譯、same-state單位／Boolean delta、完整report及authority gate仍由Actions執行，尚未聲稱通過。
- 後續依 [固定分析計畫](SURGE_INTERACTION_PLAN.md)驗收，第一批補2×2交互作用，第二批僅聯合數值探索。沒有production變更，不自動promotion或追加樣本。第3項clear shaping暫停。

派送後不持續監看；使用者收到ntfy再回來分析。3.5–4小時加排隊僅參考上一批耗時，非保證。
