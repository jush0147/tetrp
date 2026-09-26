# 單項修正：Forecast lock timing

基於 run 36246453477 的7個已確認差異，此候選只處理4個timing案例。

實作保存在 `tools/cc2-transition-audit/lock-timing.patch`，套用固定CC2 commit後再編譯；不是JS模擬，也尚未替換production WASM。`lock_elapsed = elapsed_before + frames_per_piece.saturating_sub(1)` 用於tank readiness，after-state elapsed仍增加完整cadence。zero-cadence snapshot仍不前進。attack、cancel、隊列掃描與40bit截斷不改。

Actions同時編譯baseline與lock-timing兩個版本，使用相同65 fixtures。硬性驗收：baseline恰好重現原7例；candidate僅剩 `empty/charged-base3`、`empty/inactive-head`、`empty/partial-storage-top`；四個修正case外，其餘61個comparisons完整不變。未達成即gate失敗。

另外在真正Rust Forecast執行兩個test functions：arrival23/24/25跨兩次resolve、垃圾只入一次；clear blocking、inactive cancellation後不能復活pending。連同既有Forecast tests執行。

完成或失敗由Actions ntfy通知；不監看長跑、不開FT7、不動evaluator。即使gate通過也不是完整模型parity，下一步仍是獨立queue-scan修正。
