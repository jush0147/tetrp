# 完整 recommendation 等價效能驗證（2026-09-30）

接續 ROOT_ENUMERATION_EFFICIENCY.md。這次量 prepareKiwi → JSON/WASM search → normalizeTopRecommendation → placement certificate，不以局部枚舉倍率推算整場。没有新 arena、參數變更或 bot promotion。

## 方法

固定 pilot 36707273929 的八局，每局取 decision stream 15%／50%／85% 的三個 PublicSnapshots，共 24 個。候選與基準都用相同資料，兩輪交錯新舊版本順序；各版本先暖機。共 96 組配對、192 次測量中的 recommendation 呼叫。

兩份 facade 都由同一份 src/analysis/kiwi.js 載入；reference 只把 placement-tools import 替換為凍結的舊枚舉器。不是另外寫一個精簡 prepare 函式。WASM 仍為 candidate run 36702845823、baseline run 36387270053，hash 與 VISIBLE_T_PILOT.json 精確核對。

每組比較完整 request、warnings、Rust report、normalized top-1 action、placement certificate，並檢查 snapshot 未被修改。96/96 一致；74 個 placement、22 個 Hold。Hold 的後續 reanalysis 未在這個離線 benchmark 串接，因此不能把本表稱為完整 Hold transaction 或整場 arena 的測量。

## 實測

每個 bot 下表涵蓋 48 次呼叫；Node 24.15.0 / Windows 本機。

| Bot | 舊版總秒數 | 新版總秒數 | 耗時減少 | 倍率 |
|---|---:|---:|---:|---:|
| visible-T candidate | 55.624 | 47.182 | 15.18% | 1.179× |
| accepted baseline | 55.982 | 47.426 | 15.28% | 1.180× |

candidate prepare 13.040s → 4.806s，baseline prepare 12.883s → 4.720s。新版本搜尋本身分別 41.027s、41.395s，占完整呼叫約 87%。沒有修改搜尋核心；兩版 search 的小幅計時差異不能當成搜尋加速。

完整逐樣本／逐階段數據、artifact 與 source hashes 見 RECOMMENDATION_PERFORMANCE.json。重現：`node scripts/kiwi-recommendation-bench.js`；需要已下載的 pilot trace、candidate WASM 與 accepted baseline WASM。無下載、無遠端 job、無通知副作用。

## 結論與接續界線

root 枚舉改動保留，已有實際完整呼叫收益與所測範圍的完整 parity；先前 2.73× 不能用作 arena 倍率。這次測量不含 engine 推進、JSONL I/O、實際整局 Hold 分布、GitHub runner／排隊，因此不更新 200 場的保證 ETA，也不把 6–8 小時粗估換算成承諾。

目前仍不足以解釋或消除與舊 200／400 場測試的全部差距。若繼續效能工作，應針對占比最大的 WASM 搜尋做同一公開輸入／同一預算的成本定位；不能再把大量工時放到僅剩小占比的 runner 包裝，也不能降低 nodes、刪 Hold reanalysis 或換資訊模型。這不是授權重寫搜尋或改 evaluator。

參數主線維持 visible-T → H9-off → H1-off；尚未啟動 48／200 場。這個 benchmark 與前一輪 27 tests／build 是局部工程驗證，不是新的強度證據。
