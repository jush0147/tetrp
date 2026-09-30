# Root geometry 枚舉等價加速（2026-09-30）

效率插入工作的一個有限結果；不改 evaluator、不改參數實驗順序、不啟動 arena。

## 改動及等價理由

`vendor/kiwi-v1/tetrp-placement-path.mjs` 的 enumerateRootPlacements 原本在每條 graph edge／每個旋轉 counter 狀態重建完整 piece 與長字串 key。改為共用 immutable edge geometry，queue 單獨保存 rotation counter；visited 以原 key 的完整 geometry prefix 分組，再保存相同的 counter bucket。

沒有合併或刪除旋轉 counter 狀態。動作順序、FIFO 遍歷、SRS+ threshold、spin 計算、250000-state limit、完整落點清單及排序均保持原本語意。快取僅存在單次枚舉內，不跨 snapshot，也不讀 queue/RNG。findCurrentPath、authority certificate/commit、WASM/search budget、Hold reanalysis 不改。

舊實作凍結為 test/fixtures/kiwi-placement-path-reference.js，原始檔 SHA-256 1f0a450cb1e1d38acb1ca0ca39ac8ae03e6bd3d78b714b79590aefef16f0148f。artifact-lock 更新 adapter 的 local patch hash，保留原 source/build/WASM 來源，不宣稱這是 upstream 原始檔。

## 驗證與量測

- 七種 piece × 180 開／關，spin 回歸局面的 rotation counter 0/29/30/31/32，以及 lockresets=0：完整結果（含 states_explored）對舊版相同，input 未改。
- pilot run 36707273929 每局 decision stream 的 15%／50%／85% 各取一個 snapshot：24 個真實公開局面，暖機後兩輪交錯版本順序，48 次完整結果一致。
- 其中六個局面：完整 request 一致，同一 candidate WASM 產出的完整 report 一致；placement 仍通過 authority validatePlacement。
- 本機配對枚舉總時間：original 12645.7924 ms，optimized 4632.9 ms，約 2.73 倍，該部分耗時下降 63.4%。原始逐次數據、版本 hash 見 ROOT_ENUMERATION_PERFORMANCE.json。
- analysis、placement-authority、series-score 與新 differential tests 共 27 tests 通過。

重現：`node scripts/kiwi-root-enumeration-bench.js`。依賴既存 .cache/visible-t-pilot-36707273929/legs 和 .cache/tslot-wasm-run-36702845823/pkg，缺少 artifact 時會失敗，不下載或啟動對戰。fixture indices、Node/platform 與檔案 hashes 在 JSON。

## 限制及接續

2.73 倍只指 root 枚舉，不是完整 recommendation 或 arena；搜尋核心仍是主要成本之一。沒有新的勝率證據，也沒有重新估計或承諾 200 場總耗時。不能拿此局部數字把先前 6–8 小時直接除以 2.73。

第一個僅 cache key prefix 的嘗試只改善約 4%，再分享 piece geometry 約 9%；最後把 visited 長字串改成等價的 geometry-prefix + counter 集合才有上述改善。僅最後版本保留。

參數工作仍停在 visible-T，後續 H9-off、H1-off 不變。下一個效率驗證應重用已保存 snapshots，量完整 request 成本（含兩個 bot 的同一 frozen artifact），確認此局部收益在完整呼叫中的占比；不再重開 correctness pilot 或變更 seed 模型。大批 arena 尚未啟動。
