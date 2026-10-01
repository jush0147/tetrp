# Native arena runtime integration

## 結果：完整 arena runtime gate 通過

Run 36851791560 兩個 integration jobs 與通知均成功。2026-10-01 下載結果後重新核對兩種 runtime 的 reports.jsonl / events.jsonl：各座位案例對應檔案 SHA-256 完全相同，筆數與摘要一致；terminal summaries 排除 latency 後一致。結果保存於 NATIVE_ARENA_RESULT_36851791560.json，包含 trace hashes。

| 座位案例 | WASM 整場 | Native 整場 | 耗時減少 |
|---|---:|---:|---:|
| leg 0（visible-T 在 seat 0） | 28 分 34 秒 | 23 分 43 秒 | 16.98% |
| leg 1（accepted 在 seat 0） | 19 分 36 秒 | 15 分 56 秒 | 18.69% |

兩例合計 WASM 48 分 10 秒 → native 39 分 39 秒，減少 17.68%（約 1.215×）。這是兩個案例的計算耗時合計，不是 workflow wall time；實驗 workflow 約 53 分鐘因每個 job 要跑兩種 runtime 並做比較。未承諾後續所有 seeds 的同等速度或固定 ETA。

Correctness：3,257 次完整 decision reports，10,383 筆完整 authority events，全部一致。每種 runtime 各涵蓋 2,388 次 placements、869 次 Hold，Hold reanalysis 數完全相符；full spin 210 次、mini 140 次；收到 incoming 604 次。四次 match 全由 authority KO 結束，zero technical failures、zero fallback、zero rejected candidates、zero parity mismatches。top-1 / cells / spin / lock frame / clear parity 由既有 authority commit 驗證，加上兩 runtime 全事件一致；沒有 unsupported-rule 或 certificate failure。

判定：此二個凍結 policy 的 native 離線 arena runtime 可採用；不改 browser/PWA WASM，不放寬任何決策或規則檢查。較大批次直接跑 native，不再每場重跑 WASM，否則本來的加速會被驗證成本吃掉。未來換 compiler/source/evaluator artifact 仍需對應 parity gate，不把本次等價性泛化成永久保證。

這是舊 pilot seed 的重複執行，不能加進強度樣本。下一步落實 visible-T 固定 100 seed blocks × seat swap = 200 場的批次配置、成本與判讀，使用 native 並保留全部 correctness gates；不是新的 evaluator 實驗。200 場尚未 dispatch，舊 48 場草案不可誤發。參數順序仍為 visible-T → H9-off → H1-off。以下為事前紀錄。

已由 commit `b999f6662477126793ee8b108d47b10813e23a9c` 啟動 [run 36851791560](https://github.com/jush0147/tetrp/actions/runs/36851791560)。建立時 queued，尚無結果；不持續輪詢。本機 protocol / authority / scoring / publication 共 21 tests 通過；完整 Linux native arena 等價性待該 CI，不宣稱已通過。

2026-10-01。承接 run 36849221714：固定 corpus 完整 report parity 全過，包含 IPC 的完整 request 約省 16.5%。這次只驗證離線 arena runtime 等價性與整場成本，不做強度判定。

## 執行

隔離 runner `scripts/kiwi-native-arena.js` 直接重用 `kiwi-arena-core.match`、prepareKiwi、normalizeTopRecommendation、placement authority；不改 Engine、policy、200k budget、24 frames 或 viewer。既有 arena integration 檔含尚未發布的 48 場草案，本次不混入或啟動它。

固定先前 pilot 的第一個 seed 2026093001，兩席同 piece seed；hole seeds 固定座位為 seed+1 / seed+2。兩個 jobs 交換 accepted / visible-T 座位，各自在同 runner 完整重跑 native / WASM。leg 0 native 先、leg 1 WASM 先。共四次 match 執行、兩個座位案例，不是四個獨立強度樣本。仍使用既有兩個凍結 policy，沒有 Native Kiwi v0 或原版 CC2。

兩份 native binaries 精確固定 run 36849221714 的 hashes，兩份 WASM 固定原 accepted / visible-T hashes。每個 native profile 一個常駐 process，只有 PublicSnapshot 衍生 request 進入核心；Hold 後重新取得公開狀態再分析。

## 必須全部通過

- 每場以 authority topout 結束；不設一般 gameplay frame cap，360000 frames watchdog 是技術異常，job timeout 也是失敗。
- 不評分。Simultaneous KO 仍不給分；本次只是核對兩 runtime 是否得到相同終局，不因此續抽 seed。不得將結果混入 KO 勝率。
- top-1 only，zero fallback / rejected candidates / technical failures / parity mismatch。
- 每席至少 24 placements，實際 Hold reanalysis 與 incoming garbage coverage；Hold 後 current / hold / next / frame 與 authority 實際 reveal 一致。
- 逐筆比對兩 runtime 的 snapshot、request、warnings、完整 report、normalized action；不只比較 top-1。
- 逐筆比對完整 authority event stream：initial / decision / provenance / Hold / placement lock / spin / cells / clear / receive / anchor / end。包含完整狀態 anchor，因此 garbage / attack transaction、terminal state 都須相同。
- 結果摘要排除唯一不確定欄位 latencies 後也須一致。mismatch 保留兩份完整資料與 index；authority technical failure 保留原有 dump。

整場 wall time 包含 prepare、IPC、authority、trace/report 同步寫入，排除 artifact 下載／module setup／程序關閉／離線比較。Native 程序啟動在首次 request 前，未作 warmup，可能有啟動尾端延遲計入；不把這兩次配對當精密性能信賴區間。每場 native 與 WASM 使用相同記錄格式及成本。

## 成本與後續

只兩個並行 integration jobs，每 job 技術 watchdog 120 分鐘（不是 ETA），aggregate 發一次 ntfy。此前 8 個 pilot jobs 約 6–35 分鐘，但 runtime／recording 已變，這裡不承諾固定完工時間。沒有 200 場、沒有權重調整；原參數次序 visible-T → H9-off → H1-off。

成功後才判讀實際整場收益、決定是否將 native adapter 用於較大固定樣本批次；browser/PWA 保持 WASM。失敗先修 integration correctness，不拿技術失敗當 KO。
