# Native arena runtime integration

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
