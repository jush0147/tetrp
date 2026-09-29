# 評分 observer：執行與判讀限制

2026-09-29。4 個既有真實 PublicSnapshots，各 200k nodes。輸入取自已入庫 perf corpus 的 index 1/4/7/10；固定機械選樣，不按結果挑選。保留 source trace metadata；沒有輸入 private checkpoint。

## 三份完整 report 必須一致

1. accepted landing WASM，驗證 artifact JS/WASM SHA-256，原 snapshot 入口。
2. pinned source 加 accepted artifact 的完整 patch，native observer-off。
3. 相同 native source，只插入 cfg-gated observer，observer-on。

Gate 精確比較全部 report（不只 top-1）。若 cross-runtime 不同，不能以 native 診斷解釋 accepted WASM；若開關 observer 不同，先修 observer，不能把差異當策略現象。

Transform 檢查每個 insertion anchor 唯一，移除標記新增區塊後必須逐字等於原 freestyle source。原公式／相加順序／control flow 均不替換。新增 runner/module 只在測試或診斷 cfg 編譯，production vendor 不改。

## 記錄內容

- 非 terminal evaluate 次數、命中 T-slot 的次數、假想消行改寫局部 board 的次數。
- 有界 witnesses：最先 64 個模板命中、8 個 control。這不是隨機抽樣或根節點重要性排名；可能集中在先執行的 branch/scenario。
- 搜尋深度、當前 placement、clear、combo/B2B、reserve／empty-Hold lineage、synthetic bag、post-transition pending/sent。
- 真實與假想消行後 board columns；每次假想 placement／clear。
- 12 個原有計算階段的累積 Eval/Reward 與差值。T-slot 之後的 holes/height 等是改寫後盤面的分項，沒有重算「未 cutout 的反事實完整分數」。差值是 f32 已累加分數的相減，不宣稱無 rounding error 的獨立項值。

這輪尚不記錄完整 root-to-leaf 路徑、每個 scenario/Place-Hold branch identity、known remaining queue 或 DAG 回傳 attribution。因此不能僅凭 witnesses 說 top-1 是被哪個 feature 決定，也不能宣稱 cutout 可用 T 一定不足。若需補這些資訊，先根據輸出指出具體缺口，不改評分公式。

## 執行

`scripts/kiwi-eval-audit.js prepare` 產生已入庫 fixtures。
`baseline [pkg]` 取得 accepted WASM 報告並驗證 top-1 geometry。
`scripts/kiwi-eval-observer-prepare.js runner [root]` 裝入 test runner。
先 native off，再 `instrument` 與 `RUSTFLAGS="--cfg eval_observer"` native on，最後 `kiwi-eval-audit.js gate`。

Actions 限一個 30 分鐘 job，完成或失敗都 ntfy；不輪詢、不排新對戰、不使用本資料做 strength promotion。當前本機沒有 Rust toolchain；只完成 transform assertions 與 accepted WASM baseline，Rust 編譯結果以該 run 為準。
