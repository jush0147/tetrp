# Residual value：一般 CI 檔案登記修正

2026-10-06 使用者回報Run failed。核對失敗的是 [Phase 1 engine tests run37444558431](https://github.com/jush0147/tetrp/actions/runs/37444558431)，sourcebfdbd87，519 tests中518 passed、1 failed。

唯一錯誤：`test/provenance.test.js` 的public-tree allowlist未登記新增的`tools/cc2-eval-audit/residual_value.rs`。此檔為本次撰寫的隔離候選／測試Rust原始碼，非二進位、上游完整source、私人replay或憑證。沿既有逐檔允許模式只加此一路徑，不放寬副檔名或目錄限制。

不改候選、公式、資訊邊界、成本門檻，不重新派送實驗。查詢時真正的[離線preflight run37444591656](https://github.com/jush0147/tetrp/actions/runs/37444591656)仍in_progress，Rust compile與semantic tests step成功，正在capture leaf witnesses；這不是該實驗最終結果。

修正後本機執行provenance與residual-value兩份測試。推送只讓一般CI自動驗證；residual workflow沒有此路徑的push觸發，不會產生另一批實驗。
