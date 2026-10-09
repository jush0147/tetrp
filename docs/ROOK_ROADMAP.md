# ROOK 研發路線圖：2026-10-09 最新接手契約

> **本文件是 ROOK 的最新主路線與上下文恢復入口。** 歷史實驗細節在 docs/ROOK_FULL_MATCH_STRATEGY.md；每次恢復工作應先讀本文件、Issue #8、Draft PR #6，以及當前 CI。這是路線與已驗證現況，不表示下面的工作都完成了。

- Repo: https://github.com/jush0147/tetrp
- 工作分支：feat/rook-independent-bot；Draft PR：https://github.com/jush0147/tetrp/pull/6
- 追蹤 Issue：https://github.com/jush0147/tetrp/issues/8
- 日期：2026-10-09（Asia/Taipei）。
- **唯一最終目標**：獨立開發的 ROOK 在完整現代 Tetrp TL 對戰中，於足夠多個獨立種子與可公開比較的運算成本下，穩定擊敗固定版 Kiwi；最終以真實 KO 勝率為主要標準，不是拼單個 T-Spin、短局 APP 或單次巧合。
- 使用者明確要求：**不必把 ROOK 永遠綁死在 6,000 evaluations。先找出用更多計算能達到的強度，再讓實作變快。**

## 0. 絕對不可改掉的競技／資訊契約

1. 兩名 Bot **同一場的初始 seven-bag seed 完全相同**；同 seed 交換左右 slot 再測。兩邊每回合各看自己的公開局面，在彼此決策之前不能窺視對手當回合尚未做出的動作。
2. 每名 Bot 僅可見：Current、Hold、NEXT5、棋盤、公開規則、frame、公開的垃圾與 B2B/Combo 等狀態。不得取得 private bag tail、隱藏垃圾洞位、對手內部資訊、authority checkpoint 或 future RNG。
3. 由 Tetrp Engine / BotDemo 權威實際執行 Hold、SRS+ 合法落點、真實旋轉路徑與取得的 Spin、消行、攻擊、垃圾抵銷、KO；不可以直接瞬移繞過路徑驗證。
4. **24 frame／一方一顆方塊 = 2.5 PPS 的共同戰鬥節奏**，是垃圾和攻擊時間軸；**不是**限制必須在 24 個 frame 內完成所有實際按鍵。SRS+ 具合法路徑即可用 atomic 放置。
5. 比到單方真實 KO 為止，每方最多 **2,000 次同步落子**，只是 safety cap。剛好第 2,000 次 KO 仍算 KO；存活到上限是 capped；同時死亡 double-KO；程式例外／CI timeout 為 invalid 或 incomplete。不得把 capped／double-KO 當成某方贏，也不能把它們直接納入 KO 勝率分母。
6. 必須涵蓋完整規則與戰略：Tetris、Full T-Spin/TSD/TSS/TST、T-Mini、All-mini、B2B/Surge、Combo、Hold、PC、incoming garbage、cancel、downstack、存活與壓迫；高 Sent APP 很重要，但**不是唯一目標**。不能只做開局 TSD 專家。
7. 真正獨立的 ROOK 搜尋器／評估器；Kiwi 可作為固定 benchmark 和合法公開局面決策對照，不能把 Kiwi 的搜尋／評估實作偷接到 ROOK 當作獨立成果。

## 1. 已測得的基準，勿重複宣稱「進步」

| 試驗 | 具體實測 | 結論與來源 |
| --- | --- | --- |
| ROOK 6K vs pinned Kiwi 200K nodes | **0 勝、8 敗**；只有 4 個獨立 seed，各交換一次 slot；Kiwi 38–81 顆 KO。ROOK Sent APP 約 0.399，Kiwi 約 0.832。 | 需要巨大改善；兩者 nodes/evals 單位不同，非等 CPU。 https://github.com/jush0147/tetrp/actions/runs/37876960250 |
| 提高「未來 SRS+ 探測」9 → 24，非整體 maxNodes | 4:4（4 個獨立 seed 各交換 slot）；實驗搜尋耗時約 +67%。 | **不能**據此推論加大 ROOK 整體搜尋預算無效。 https://github.com/jush0147/tetrp/actions/runs/37886562562 |
| Focused Beam 保留 8 個根，其他空間給其深入分支 | 實驗 2:6，實驗耗時約 +13%。 | 舊 root-diverse beam 仍為預設；新策略不提升。 https://github.com/jush0147/tetrp/actions/runs/37899764227 |
| 攻擊送出 reward 權重 4.8 → 7.2 | 4:4；實驗 Sent 1582 vs baseline 1650。 | 不提高預設 4.8；不再隨意亂調單一權重。 https://github.com/jush0147/tetrp/actions/runs/37924464189 |
| Hold 後沿用最初已搜索的合法第一手 | 4:4；搜尋耗時 1,249,219ms vs 1,650,970ms，約 **省 24.3%**；1446/1446 預定步通過權威驗證，0 拒絕。Baseline 1548 次 Hold 重搜中 196 次（12.7%）選了不同一步。 | 有**效率收益**，目前**沒有強度證據**；保留 opt-in，並非已升級預設。 https://github.com/jush0147/tetrp/actions/runs/37933085621 |
| 相同公開盤面的 Kiwi vs ROOK 決策診斷 | 22 個抽樣，8 次同手，5 次 Kiwi 落點已在候選但沒選，5 次 Kiwi Hold 而 ROOK 不選，4 次 ROOK Hold 而 Kiwi 不選；根候選未觀測到 SRS+ 漏招。 | 原始抽樣少，不能推論所有局面；要進一步拆解分數與搜尋深度。 https://github.com/jush0147/tetrp/actions/runs/37886668563 |

**特別注意**：交換 slot 的兩場仍是高度相關的相同 seed，不能把 8 場當 8 個獨立樣本。固定種子用於迴歸測試，正式驗收要增加之前未調參的獨立 seed。

## 2. 下一階段：優先順序與決策關卡

### P0 — 先測 ROOK「算力換強度」曲線（第一個要實作的工作）

- **禁止把 6K 當最終上限**。先用同一批只含公開資訊的局面做 6K、12K、24K、48K evaluations 的預算擴張，若有收益與資源則再試 96K／更高。這是 ROOK 自身 maxNodes，不是 Kiwi 的 200K node；兩者不可直接比數字。
- **已完成**獨立預算對照工具：`scripts/rook-vs-rook.js` 現在可分別以 `ROOK_CANDIDATE_NODES`、`ROOK_BASELINE_NODES` 指定兩個 Bot 的 maxNodes，交換位置仍隨身份移動；未指定時保留 `ROOK_NODES` 共用預設。Kiwi 外部基準可另外用 `scripts/rook-vs-kiwi.js` 的 `ROOK_NODES`／`KIWI_NODES`，但不比較兩邊節點數字作為等 CPU。
- 在既有公開局面上先做**無 KO 聲稱的剖析**：每次實際 evaluated 數、可行根候選數、各層 beam 的 unique root 數、best action 是否改變、effective depth、搜尋耗時（平均／中位／P95）、記憶體／CPU 增幅、Sent/Generated APP。先確認增加 maxNodes **真的擴大有效搜尋**。如果到 6K 其實就不再用滿預算，擴大數值沒有意義。
- 先用 4 個互不相同的 seed、各交換 slot 做預試的**真 KO 對照**，2000 鎖上限。不因單次 4:4 就下結論；有改善跡象才擴到至少 16–32 個獨立 seed，之後保留新 seed 作 confirmatory 測試。
- 區分搜索配額擴張與搜索架構：固定 4-ply / beamWidth 24 時，若 maxNodes 增加後 best action、實際 evaluated 或 attack 幾乎不變，應改測 beamWidth / horizon / candidate allocation 和 transposition 效率，而不是只加大上限。
- **輸出決策**：算力提升是否能換來真 KO 勝率、持續攻擊與存活品質的上升？優先尋找 ROOK 的「離線強度上限」；即時運行先不綁死 400ms。

### P1 — 找出 ROOK 評估／規劃的結構性盲點

- 利用已提交的 src/analysis/rook.js 之 traceRootScores / explainBoardEvaluation，以及 scripts/rook-choice-diagnostics.js，對 Kiwi 和 ROOK 在**同一可見局面**的候選比較：即時 generated/sent/cancelled、累計 reward、終點 board score、holes、covered、高度、Tetris 建槽、T-spots、B2B、combo 和風險。
- 新版對照已產生根候選評分報表（[Actions #37949389406](https://github.com/jush0147/tetrp/actions/runs/37949389406)）：22 個公開局面、14 次選擇不同，平均 ROOK 選的路線比 Kiwi 那手在**ROOK 自己的評價函數**中高約 18.49 分，其中終點盤面（已折扣）約 +12.21、累積 reward 約 +6.28；最顯著的盤面單項是 holes 懲罰相差約 +13.38（未直接折扣項）。這是**評分偏好診斷**，不是 Kiwi 那手更優的因果證明，也不是勝率改進。局面輸出只許 NEXT5。
- 特別查：搜索前 4 ply 與真正中長期價值不一致；高度/洞的過度懲罰或假的 Tetris/T-Spin 建槽獎勵；Hold 兩階段策略不連續；未來只能簡化 Hard Drop 的分支偏差；垃圾不確定性和生存風險。
- **不得**因 Kiwi 挑了某手就當它一定最好。應用獨立 Tetrp 真實攻防後續與多 seed KO，判斷「評分錯」或「搜尋沒找到好延伸」。
- 若更大的有效搜尋預算仍無法明顯提升強度，優先重做搜索／價值架構（長期攻防的 multi-ply / beam / transposition / tactical continuation）；停止堆一堆特定招式 expert。

### P2 — 在 P0/P1 有效果後，改善效率

- 先保留已實測成功的 **post-Hold plan reuse** 作效率優化候選（但其 KO 對照只有 4:4）。更廣泛地量測並去除多餘的重新搜索、重複 geometry、duplicate board evaluation、重複 cache miss。
- 在確定有效搜尋方法後，再考慮 native Rust / C++ / WASM、TypedArray board / bitboards、跨 ply transposition、worker 併行，以及 benchmarking 和 profile-guided optimization。**語言移植不等於策略變強**，不能作為 P0 的替代。
- 離線極致強度與即時可執行是兩個報告：後者需認真測驗 2.5 PPS 下約 **400ms/次** 的中位、P95 時延，必要時用 time budgeting / anytime search / fallback；模擬中的 24 frames 不是目前真正限時 CPU。

### P3 — 充分統計的最終驗收

- 與固定版 Kiwi 比較，至少擴展到大量**獨立**、未用於調參的 seed（目標 64+，依有效 KO 比例與資源決定是否再增加），每 seed 角色互換；計算 KO 勝率和信賴區間時考慮 seed 配對／相關性。
- 進步 gate：先對舊 ROOK 在同計算成本或清楚揭露成本的設定下穩定變強，再打 Kiwi；最終要 **真 KO 勝率超過 50% 並有足夠證據不是偶然**。完整報告 KO、capped、double-KO、invalid、Sent APP / Generated APP、垃圾抵銷／承受、死亡原因與每決策 CPU。
- 有兩種成績必須分開命名：**offline strength ceiling**（可使用更多算力，不隱瞞耗時）與 **matched-CPU / real-time performance**（公平 wall/CPU 或可明確比較的思考時間）。絕不把任一個當成另一個。
- 不能縮短 2000 鎖 cap、先以 24/120/500 placements 人工截斷，再假造勝負。小場次僅是執行正確 smoke，不是競技強度證據。

## 3. 下一次直接要做的事情（以此為準）

1. **先讀新的 [budget scaling Actions](https://github.com/jush0147/tetrp/actions/workflows/rook-budget-scaling.yml)**，確認 profile 是 success／failure／queued，禁止把 queued 當成功。提取 6K／12K／24K／48K 的實際 `evaluated`、選棋變化、P95 耗時；如果 12K 根本沒多算，就不要浪費完整 KO 在 12K vs 6K。
2. 若 12K 的確增加有效搜尋量，讀取 12K vs 6K、seed 1/8/16/23 各交換位置的 **KO-first／2000-lock** A/B，按四個獨立 seed 而非八個獨立樣本報勝率；未完成則不能聲稱提高算力變強。
3. 如果 4-ply／24 beam 因本身 frontier 飽和而無法消耗更多 maxNodes，下個 P0 實驗改成**明確分側的 beamWidth／depth 擴張**，但須獨立隔離變因、量測額外 CPU 和真正 KO。不可只把 `maxNodes` 上限寫得更大。
4. 若預算擴張改善實際強度，進一步對 Kiwi 並用至少 16–32 個獨立 seed 做 confirmatory；若沒有改善，回 P1 專注 search horizon / continuation 與 Board/value 結構，不盲調 reward。
5. 每次把 commit、exact budget、獨立 seed、KO/capped/error、CPU、採納／否決結論更新到**本文件與 Issue #8**；PR #6 保持 Draft，未達標不合併 `main`。

## 4. 技術入口與現有預設

- Core search：src/analysis/rook.js；chooseMove 默認 depth=4、beamWidth=24、futureReachableProbes=9，通用 maxNodes 默認 8000，但**目前對戰腳本預設實驗 budget = 6000**。不要混淆函式預設與 benchmark 預設。
- Kiwi 同 seed 完整 KO：scripts/rook-vs-kiwi.js；環境變數 ROOK_NODES、KIWI_NODES、SEEDS、MAX_LOCKS；預設 6000 ROOK eval / 200000 Kiwi nodes / 2000 lock cap。
- ROOK 自我 A/B：`scripts/rook-vs-rook.js`；`ROOK_NODES` 仍是雙方**共用預設**，可用 `ROOK_CANDIDATE_NODES`、`ROOK_BASELINE_NODES` **分側覆寫**；`BUDGET_SCALING=1` 禁止摻入其他 expert。最新自動流程會先做有效工作量 screen，再決定是否啟動真 KO。
- 局面／非勝率 smoke：scripts/rook-strength-screen.js；可用 SEEDS、PIECES、ROOK_DEPTH、ROOK_BEAM、ROOK_NODES；它沒有對手，不得當 KO 勝率。
- 公開決策對照：scripts/rook-choice-diagnostics.js 與 scripts/rook-vs-kiwi.js 的 ROOK_DIAG、ROOK_DIAG_TURNS、ROOK_DIAG_PATH、ROOK_DIAG_SNAPSHOTS_PATH。
- Authority & protocol：src/analysis/demo.js、src/analysis/visible-state.js、scripts/rook-ko-protocol.js。
- Relevant CI：.github/workflows/rook-ko.yml、rook-choice-diagnostics.yml、rook-bot.yml 和所有消融 ablation workflows。

## 5. 防止上下文遺失的強制交接格式

每次工作結束，在 Issue #8 和本路線圖最末尾新增：
- 當時 head commit / branch / Draft PR 是否變動。
- **已完成**：實際改了哪些路徑、測試是否通過及證據鏈接。
- **已測實驗**：exact budgets、不同 seed 數（不是只報 swap 總場數）、KO/capped/error、sent APP、搜索耗時、是否採納。
- **未完成**：CI 正在 queued / in_progress 時不得假裝完成，無法查到 log 就說尚無資料。
- **下一個唯一 P0 action**：明確要改的函式、驗證和 budget 邊界。
- 對於失敗的實驗，保留可重現資料但不要提高核心默認配置。

> 目前交接結論：**已實作分側預算和 6K/12K/24K/48K 真工作量 profile。下一步先讀 budget-scaling CI 的實測資料；有有效搜尋增量才進入完整 KO，沒有就擴展 search horizon / beamWidth。root-score 評分拆解已完成，不代表對 Kiwi 的勝率改善。**


## 2026-10-09 P0 實作紀錄：獨立候選／基線搜尋預算

- `scripts/rook-vs-rook.js` 已新增環境變數
  `ROOK_CANDIDATE_NODES`、`ROOK_BASELINE_NODES`，均預設
  fallback `ROOK_NODES`（舊版同一 budget 的 workflow 不變）。
  搜尋呼叫前按該 side 選取 maxNodes；swap 後 budget **跟
  Bot 身份走，不跟 slot 走**。每局 JSON 另顯
  `candidateNodeBudget`、`baselineNodeBudget`、
  `budgetsByKind`、`slots[].configuredNodeBudget`、
  `searches`、`budgetReached`、`searchDepthLimit`（設定上限，非真正完成 ply）。
- 此處只是 benchmark 設施，不是已證實 48K 比 6K 強；
  `nodeBudget` 舊欄仍代表 `ROOK_NODES` fallback，
  **預算不等時以 candidate/baseline 欄為準**。
- 下一步：跑相同公開盤面 6K/12K/24K/48K 的
  actual evaluations／best action／depth／ms profile，
  再做不同 budget 的同 seed/slot-swap 完整 KO。


## 2026-10-09 新實作交接：獨立預算與第一輪真正 maxNodes scaling（尚未有結果）

- `scripts/rook-vs-rook.js` 支援 `ROOK_CANDIDATE_NODES` 與
  `ROOK_BASELINE_NODES` 各自設定；兩者未指定時繼續沿用
  `ROOK_NODES` 共用預算，舊 workflow 可維持相同語意。
  新增 `BUDGET_SCALING=1` 專用標籤 `budget-scale`，
  禁止同時啟用戰術／Hold／offense 等其它 expert，以保證
  第一輪只有 maxNodes 不同。輸出 per-slot configuredNodeBudget、
  evaluated、searches、budgetReached、searchMs、Sent APP。
  候選與基線不同預算時，舊欄位 `nodeBudget` 設為 null，
  **不可假稱兩側搜尋預算相同**。
- 修正 `src/analysis/rook.js` 的 `evaluated++` 超額計數：
  當已達搜尋預算，不應再計入沒有評估的候選；
  `test/rook-budget-protocol.test.js` 驗證不超限，
  且選棋只讀公開資訊。
- `scripts/rook-budget-profile.js` 在獨立 Tetrp authority
  生成的**同一批公開局面**比較 6K/12K/24K/48K，
  記錄真 evaluated、是否達上限、各層 beam 根數、
  選棋是否改變、執行時間。這不是 KO，也不提供
  隱藏 bag、洞位或 authority checkpoint。
- `.github/workflows/rook-budget-scaling.yml`：
  首先量測 seed 1/8/16/23 各固定局面，若 12K
  的真實 evaluated **沒有高過 6K**，就跳過
  無意義的 12K 對 6K KO，轉為調整 beam/depth。
  有真正搜尋增量才跑完整 4 個獨立 seed x slot swap，
  雙方同初始 seed 同步鎖定，每場 KO-first
  最多 2000 鎖；後續要擴到更多獨立 seed 才能得出
  強度結論。工作流程的結果必須再確認，不能在排隊
  或執行中就宣稱提高算力會贏。

本次工作只建立**可重現且誠實計算預算**的實驗平台，
未經 KO/CPU 結果不可升級任何正式搜尋預設。


## 2026-10-10 最新接手狀態：6K–48K maxNodes 已確認飽和，改測搜尋寬度／深度

**已完成的真實量測**：[GitHub Actions #37954922598](https://github.com/jush0147/tetrp/actions/runs/37954922598)，
固定 4 個 seed（1、8、16、23）、各 0／4／12 手，共 12 個公開盤面：
`maxNodes=6000/12000/24000/48000` 的真實 `evaluated`
**全部平均 3288.17**，無任何樣本碰上限，任一較大預算
對 6K 的第一手選擇 **0/12** 次不同，執行時間並未顯著改變。
因此 CI **正確跳過** 12K vs 6K 完整 KO；這證明的是固定
4-ply、24-beam frontier 飽和，**不是額外算力一定無效**。

**已提交的新容量實驗（完整 CI 與 KO 結果仍待確認）：**
- `scripts/rook-vs-rook.js` 現在也支援
  `ROOK_CANDIDATE_DEPTH`/`ROOK_BASELINE_DEPTH`、
  `ROOK_CANDIDATE_BEAM`/`ROOK_BASELINE_BEAM`，
  預設仍 4 層／24 beam；和獨立 maxNodes 一樣，
  必須隨 Bot 身份交換 slot，不能混用。
- `test/rook-budget-config.test.js` 對交換位置後的
  depth、beam 與 maxNodes 進行權威對戰煙霧驗收，
  也檢查非法設定值拒絕。
- `scripts/rook-capacity-profile.js` 在同一組只含
  NEXT5 的公開盤面對比：
  1. 4-ply／beam 24／maxNodes 6000（原版）；
  2. 4-ply／beam 48／maxNodes 12000（只加寬）；
  3. 5-ply／beam 24／maxNodes 12000（只加深）；
  4. 5-ply／beam 48／maxNodes 24000（寬深皆增）；
  5. 5-ply／beam 96／maxNodes 48000（更大上限）。
  記錄每筆真實 evaluated、每層 root 存活數、
  選棋變化、延遲與是否碰 budget。這些不是勝率測試。
- `.github/workflows/rook-capacity-ablation.yml`：
  **只有** 5x48/24K 在相同公開盤面上同時觀測到
  `evaluated` 高於原版且選棋不同，才跑 4 個不同
  seed 各交換位置的同步真 KO。A/B：
  5-ply／48 beam／24K 對 4-ply／24 beam／6K，
  同一場雙方同 seed、每名 Bot 最多 2000 次同步鎖定，
  依原規則分 KO、capped、double-KO；量測實際 search
  ms／eval 和攻擊量。此為**離線強度上限實驗**，
  搜尋成本不等價，必須揭露。
- 即使 KO 結果改善，也只是少量獨立 seed 的初步信號，
  不能直接宣稱超越 Kiwi 或升級正式預設。

**恢復工作的唯一下一步：**
先讀 [ROOK search-capacity Actions](https://github.com/jush0147/tetrp/actions/workflows/rook-capacity-ablation.yml)
中最新的 `profile` job log，確認實際 work growth、
候選改選比例及 P95；若 KO 條件觸發則取 report 與
每個 seed 的真 KO／Sent APP／CPU。若更多搜尋仍只
帶來很小變化，應審查 transposition、多步評分與
未知垃圾條件，而不是繼續單純加大上限。


## 2026-10-10 最新實測：寬度／深度已有效利用算力，但 KO 不升反降

[GitHub Actions #37971335064](https://github.com/jush0147/tetrp/actions/runs/37971335064)
已完成。相同 4 個 seed（1、8、16、23）的 12 個公開盤面：

| 設定 depth × beam / node cap | 平均實際 evaluated | 12 局中選棋不同於 4x24 | 搜尋耗時中位數 |
| --- | ---: | ---: | ---: |
| 4×24 / 6K（原版） | 3,288 | 0 | 344ms |
| 4×48 / 12K（加寬） | 6,276 | 3 | 473ms |
| 5×24 / 12K（加深） | 4,401 | 7 | 378ms |
| 5×48 / 24K（加寬深） | 8,511 | 7 | 564ms |
| 5×96 / 48K（極大） | 15,314 | 6 | 829ms |

所有組別的 node cap 命中數 0。這代表**深度、beam 寬度確實使
ROOK 用更多算力產生不同決策，但單純提高 maxNodes 仍沒用滿**。

5×48/24K vs 4×24/6K 的 **4 個獨立 seed、交換位置共 8 場，
全數真 KO**：實驗組 2 勝，基線 6 勝；實驗
Sent 1,718 vs 基線 1,748；累計搜尋耗時
1,818,177ms vs 1,177,157ms（約 +54.5%），累計
evaluated 27,602,022 vs 10,591,818。**不採用
5×48 搜尋設定作正式預設**。此結果仍只有 4 個
獨立 seed，不可強推對所有局面的統計結論，但已無理由
宣稱「搜尋更深就更強」或繼續無方向加大 beam。

### 新受控實驗：給暫時不平整的攻擊建構路線更多存活機會

Kiwi 同局面逐項評分拆解先前顯示 ROOK 更偏好低 holes 的
未來盤面；這是**搜尋/評分假說**，不是 Kiwi 行為一定最佳
的證明。目前 ROOK 在所有 ply 以同一盤面 heuristic
排序 beam，會提早剪掉「先產生洞、後用 Spin/連續消行
修復」的路線。

- 新 opt-in `chooseMove(...,{intermediateHoleRelief:0.65})`：
  僅在尚未抵達搜尋終點時，暫時減輕 holes 對
  **beam pruning 排名**的影響；真正的 leaf
  `evalScore`、Tetrp 攻擊/消行、終局盤面洞數
  懲罰 **完全維持原本**。預設 relief 仍是 0，
  既有 ROOK 沒有改策略。
- 改用一次 `surface` 掃描同時取得洞數與原始盤面
  分數，避免實驗版因額外重算所有行列導致無謂
  CPU 負擔。仍記錄任何額外耗時。
- `test/rook-intermediate-pruning.test.js` 要求
  原版／relief=0 完全一致，且新的 final leaf
  `score = cumulativeReward + discountedOriginalBoardValue`、
  ROOK 所用資訊不變、非法 relief 被拒絕。
- `scripts/rook-vs-rook.js` 實驗版
  `EXPERT_PRUNING=1 EXPERT_PRUNING_HOLE_RELIEF=0.65`
  與同設定 baseline 對比（**雙方都是**
  5 ply、48 beam、24K maxNodes），其它 expert 全關。
- [ROOK setup-survival workflow](https://github.com/jush0147/tetrp/actions/workflows/rook-intermediate-pruning.yml)：
  先用 12 個同樣的公開盤面量測是否改選且沒有分數污染，
  有改選才跑 4 個不同 seed x swap、KO-first、
  2000 鎖 cap 的完整權威對局，記錄 real
  KO、Sent APP、CPU 和 evaluated。
- **目前沒有新實驗 KO 結果**，上述只是
  針對價值與剪枝機制的受控假說；不可宣稱改善。
  即使新分數勝過較弱的 5×48 基線，也還需要
  打敗更強的 4×24 舊版，最後才有資格再跟 Kiwi
  對照。

**最新唯一接手行動**：查上述新 workflow 的
profile/report log 以及 test/acceptance；
若 5×48 的新剪枝沒變強，停止針對同一權重窮舉，
直接分析 search horizon、沒有有效未來 T-Spin
合法路徑的簡化 forecast，及帶垃圾時的模擬有效性。
保留 Draft PR #6，未經 KO 證據絕不併入 main。
