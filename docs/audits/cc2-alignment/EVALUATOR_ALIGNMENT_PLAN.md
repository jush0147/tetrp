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
- v2 run 36551709585 已通過並本機复核。729 個資源 lineage checks 一致；取得 remaining queue/hold 無 T 卻因 synthetic bag.len<=3 假想 T 消行的真實節點。見 RESULT_36551709585.md。下一步使用已存 witness 做離線幾何與分項對照，不需再跑同一批搜尋取證；未開始調參或 arena。
- 離線幾何／分項對照已完成，見 TSLOT_WITNESS_RESULT.md：12/12 fresh-T conditional full-spin geometry/clear parity；429 個保留節點的 cutout 局部分數效果 +4.4～+22。取證到此停止重複；接下來提出局部資源／兌現語意處理方案，不直接調 bonus 或刪模板。
- 局部候選規格已完成：TSLOT_RESOURCE_PROPOSAL.md。僅替換 snapshot-only cutout 資源計數，其他公式與權重固定；未知 tail 暫不預支是假設而非正確性真理。靜態影響 632 降／34 升／63 不變，尚未建置候選／改 bot／開 arena。下一步是隔離候選與 resource invariants。

不要求使用者重新拆解此問題；沿此文件逐項推進，發現新證據才更新判定。

2026-09-29 最新接續點：隔離 visible-T 候選 source transform、四個 Rust resource tests、八個 public input 的精確 report／計數／Hold lineage／top-1 gate 已實作。本機 accepted WASM 八局面通過；Rust candidate 由 `kiwi-tslot-resource-audit.yml` 單 job 建置診斷，完成 ntfy 通知後讀結果。不換 production，不調權重、不開 FT7；詳見 TSLOT_RESOURCE_PROPOSAL.md。

Run 36566413689 已成功：16 次完整 report parity、160 萬次資源斷言、371 個 lineage witnesses 通過；8 個 top-1 中只有 leg20/request493 改為 occupied Hold。見 RESULT_36566413689.md。下一步讀這個決策差異，不重跑已成功的診斷或直接宣稱更強。同 commit 的一般 CI 失敗是兩個診斷 Rust 檔漏登記 publication allowlist，已做精確路徑修正。

決策差異離線分析已完成，見 TSLOT_DECISION_RESULT.md／TSLOT_DECISION_AUDIT.json。原 Place mean 降 2.31，Hold 降 0.14；根據真實公開資訊，放 T 後沒有其他已知 T，因此 candidate 的 Place 分支 100k evaluates 無 cutout。121 個配對 witness 的 reward 與 pre-cutout stages 一致。無法精確分解 root backup／search reordering，也不為此再擴張 instrumentation。T-slot 候選封存待機制比較，baseline 不換。下一項固定為 H1 pending-safety／base board 的有效係數、cancellation 反應與重疊語意。一般 CI run 36566930087 已成功。

H1 語意分析完成，見 H1_SEMANTIC_RESULT.md／H1_SEMANTIC_EVIDENCE.json：1,100 個既存 Rust witness 重現；pressure=min(pending,16)/8，真實盤面 danger weighting。已證實低乾淨盤面 H1=0、20→16 抵銷的 H1 改善=0；但 forecast／盤面與原 clear shaping 仍包含防守效果，不宣稱 cancellation 完全缺失。不改係數、不另加 bonus、不開 arena。下一項 H9 cavity 與 holes/coveredness 的語意重疊；之後彙整最小機制比較清單。

H9 完成：1,100 個 witness 重現，合成對照證明不等同 holes/coveredness，七種 piece 的 authority 幾何驗證證明 H9=0 不保證每種 piece 可達。見 H9_SEMANTIC_RESULT.md。局部語意取證收束，MECHANISM_EXPERIMENT_PLAN.md 固定下一順序：visible-T 候選 WASM/browser gate → 單項機制比較；H9-off、H1-off 後續各獨立對 accepted baseline，不同時改、不同時派三組。現在未啟動新 arena 或 promotion。

2026-09-30：已準備 `kiwi-tslot-wasm-audit.yml`，用 accepted exact patch + 同一 visible-T transform，無 observer、單執行緒 WASM；與 run 36566413689 的 native 完整 report 做 Chromium module Worker 比對。8 fixtures × 3 passes × 2 kernels = 48 checks，包含 top-1 geometry／Hold transition、200k budget、UI heartbeat，並記錄 memory／paired latency。明確不依賴 cross-origin isolation。相對效能篩查預先固定為 warm per-state ratio 中位數≤1.25、最差局面≤1.5；這是工程 regression screen，不是 24-frame deadline 或使用者裝置的 SLA。效能未過需另審，不能由 correctness pass promotion。單 job 30 分鐘上限、完成 ntfy，不跑 arena。

Run 36702845823 已成功並本機重核：48 exact report checks 零差異，27 placement／21 Hold checks，候選 artifact hash 已驗證；performance screen 通過。見 RESULT_36702845823.md。可前進四 seeds × seat swap 的八局 KO pilot，先固定配置與 seeds 再 dispatch；本次結果審查沒有啟動 arena、不 promotion、不改 H1/H9。

八局 pilot 已準備：VISIBLE_T_PILOT.json 固定兩個 artifact hash、seeds 2026093001/2026093101/2026093201/2026093301、seat swap 與重試規則；`kiwi-visible-t-pilot.yml` 8 平行 jobs，每局步驟120分鐘技術上限，無 gameplay frame cap。19 個回歸測試通過，實際兩個 WASM 的本機 bounded smoke（不計強度）完成8 placements、4 Holds/reanalyses，零 parity mismatch。runner 與 summary 沿用既有 correctness gates，加入 accepted baseline artifact驗證；沒有使用 vendored Legacy 作對手。完成 ntfy 後再讀8局結果，勿持續輪詢或自動追加對戰。
