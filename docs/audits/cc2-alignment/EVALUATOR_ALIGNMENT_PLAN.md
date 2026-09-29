# 現有 CC2 evaluator：目前唯一的後續順序

2026-09-28，依使用者最新指示記錄並開始。此文件取代 PARAMETER_RULE_AUDIT_2026-09-28.md 的「下一步固定順序」，以及對話中的六候選／整組自動調參提案。

## 問題不是先找最佳權重

使用者要回答：現有項目哪些有用、哪些重要、哪些重複、哪些缺少；而且首先要確認每個項目的計算語意適合目前 Tetrp TL S2、snapshot-only、固定 cadence 的環境。

順序固定：**語意／環境對齊 → 機制有效性 → 權重調整**。

1. 全部現有 evaluator 欄位建立覆蓋清單，區分 active、zero-weight、inactive branch、機制開關。逐項記錄資料來源、real/counterfactual board、reward/leaf、規則量或策略 proxy、重疊及支援限制。
2. 對可疑計算建立最小可重現 witness。精確交易以 Tetrp authority 為準；手工 shaping 不假稱為 attack table。區分已證實不一致、刻意近似、尚未驗證，不能把推測寫成勝率原因。
3. 只有明確的 semantic bug 才做局部修正，附原本失敗／修正後通過的驗證。不把戰略取捨偽裝成 correctness fix。幾何 T-slot 對未來資源的估计要先拆出證據，不能直接換成「只數 NEXT T 就正確」。
4. 語意清楚後才提出機制 ablation，驗證有用／冗餘；缺項須有行為與對戰證據，不憑高手觀感加 bonus。
5. 最後才討論權重。現階段不做參數 sweep、自動調參、新 feature、search rewrite、300k nodes 或強度比賽。

## 固定邊界

- accepted artifact／權重作為比較基準，production vendor 不換。
- Tetrp authority；PublicSnapshot；不偷看 future、不推 SevenBag remainder。
- 不回頭救 Native；神經網路只保留成本紀錄，未啟動。
- 不能把「目前不生效」等同「沒有戰略價值」，不能把「移除後分數改變」等同「更強」。
- 最終強弱仍是資訊公平、zero fallback、top-1 parity 的 KO arena；但本階段不開 arena。

## 目前進度與接續點

- 已完成 pinned source + accepted patch 的第一輪欄位盤點。
- 本輪新增 source-linked 全欄位語意分類與 authority transaction witnesses；見 EVALUATOR_SEMANTICS_2026-09-28.md 及 evaluator-semantic-evidence.json。
- 下一個具體深入項：T-slot 的 synthetic bag／empty-Hold reserve／假想消行如何聯動其他 leaf 項目。要以真實 continuation 的診斷證據評估影響，尚未授予它「有害」判定。
- 2026-09-29 已實作隔離 observer 與四個真實 PublicSnapshot fixture；本機 accepted WASM baseline 可執行。Rust 編譯／完整報告 parity 尚待 `kiwi-evaluator-audit.yml`。一次限時 30 分鐘的診斷 job，不開 arena。完工後讀 artifact，勿直接進入 tuning。
- 規則擴展 ARE 留為獨立支援域工作，不混入零 ARE arena 的 evaluator 調整。
- 2026-09-29 run 36548712730 正式通過，8 次完整 report parity 零差異。結果見 RESULT_36548712730.md：已確認 cutout 的跨項影響，但樣本保留方式漏掉三組後段 board-rewrite witnesses，尚不足以歸因 top-1。下一步補分類取樣與 branch/scenario/visible-queue lineage，不調參。
- Observer v2 已加入上述分類取樣、正規化可見序列及 DAG selected-path，待相同四局面 CI 診斷驗證。僅修診斷覆蓋，不修改任何 evaluate/search expression；每個 strata 的覆蓋與 queue 消耗加入 gate。

不要求使用者重新拆解此問題；沿此文件逐項推進，發現新證據才更新判定。
