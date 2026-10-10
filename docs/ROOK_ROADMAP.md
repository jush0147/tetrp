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


### 2026-10-10 06:00：中途 Hole-pruning 假說的第一輪結果及後續稽核

[Setup survival A/B #37997846981](https://github.com/jush0147/tetrp/actions/runs/37997846981)
已完成初階 profile：4 獨立 seed 的 12 個公開局面，
5 ply／48 beam／24K eval cap 雙方相同。
`intermediateHoleRelief=0.65` 對 `=0`，
**選棋 0/12 次改變**；平均真實 eval
8,509.5 vs 8,510.75；平均搜尋時間
589.6ms vs 556ms。由於早期公開局面根本沒改選，
CI 正確**跳過**完整 KO。**此設定未提高強度，
絕不可升級正式預設**。早期樣本沒涵蓋全部
垃圾壓迫局面，不能據此聲稱對所有局面絕對無效。

為避免一直用乾淨開局抽樣，新建
`scripts/rook-stress-diagnostics.js` 及
[真實 Kiwi KO 公開局面稽核工作流程](https://github.com/jush0147/tetrp/actions/workflows/rook-real-ko-public-stress.yml)：
- 直接從先前成功的
  [Actions #37949389406](https://github.com/jush0147/tetrp/actions/runs/37949389406)
  讀取 22 筆當時的 `rook-public-observations.jsonl`
  與對應 `rook-choice-diff.jsonl`；這是
  **權威對戰真實局面，絕非隨機拼假的盤面**。
- 嚴格確認 snapshot seed／turn／owner 與 Kiwi
  決策對照一致、只有玩家可見 NEXT5，
  而且 baseline 4×24 的行動仍精確匹配舊紀錄；
  不吻合立即失敗，不拿不同版本混稱同局面。
- 對同一真實局面比較原版 4×24/6K、
  5×48/24K、5×48/24K+setup-survival，
  按 pending garbage／已進入棋盤的垃圾／
  holes／回合 20+ 分組。
  統計改選比例、搜尋成本，以及是否較一致 Kiwi
  的合法第一手。**與 Kiwi 同手是診斷訊號，
  不是 KO 勝率，也不是 Kiwi 一定正確。**
- 該新 CI/壓力結果尚未確認完成。除非在真實
  中後期/壓力盤面出現顯著改選且後續真 KO 有收益，
  不得繼續無目的調整 `intermediateHoleRelief`
  數字；若仍找不到方向，應研究不可見垃圾的未來
  SRS+ reachability／多步攻防估值或重大架構改寫。

**最新接手唯一事項**：先取
[ROOK real Kiwi KO public stress triage](https://github.com/jush0147/tetrp/actions/workflows/rook-real-ko-public-stress.yml)
的工作結果（可能仍 queued），再決定需要的搜索架構
改動；每輪維持 2000 鎖、真正 KO 才計分、分側 CPU
誠實紀錄，Draft PR #6 不合併。


## 2026-10-10 06:50 接手更新：真實 KO 壓力盤面結果、去除鏡像重複運算

### 已證實的壓力局面結果

[Real Kiwi KO public-state stress run #37998159298](https://github.com/jush0147/tetrp/actions/runs/37998159298) **成功**。
此前完整權威 Kiwi vs ROOK KO 提供 **22 筆公開局面**，
但只來自 **2 個獨立 seed（67020、67023）**，
因此它們**不是 22 個獨立對戰實驗**。

| 局面子集 | 局面數 | 原版 4×24 與 Kiwi 同手 | 深搜 5×48 與 Kiwi 同手 | 深搜 + hole relief 與 Kiwi 同手 | hole relief 相對深搜改選 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 全部 | 22 | 8 | 8 | 9 | 1 |
| 待處理垃圾 pending > 0 | 3 | 0 | 0 | 0 | 0 |
| 棋盤已有垃圾 | 12 | 6 | 5 | 6 | 1 |
| 棋盤有洞 | 14 | 7 | 6 | 6 | 0 |
| 對局回合 >= 20 | 8 | 3 | 2 | 3 | 1 |

**注意**：這不是 Kiwi 的最佳行動證明，更不是 ROOK 的
KO 勝率。加深加寬沒有提升與 Kiwi 的一致性，
hole relief 在真實戰鬥也只改變 1/22 決策；此前乾淨盤面
12/12 次不改選且跳過 KO。**停止在 hole-relief
單一係數上繼續搜尋，預設仍為 0。**
新的 `scripts/rook-stress-diagnostics.js` 已追加
`futureProofsByPly`、`actualFutureSpinClears`、
`fastSpinProbes`、`forecastSpinClears`、受阻垃圾
分支數等診斷。新版
[public stress CI](https://github.com/jush0147/tetrp/actions/workflows/rook-real-ko-public-stress.yml)
目前尚未完成，**要先看完整後續 Spin 搜尋覆蓋率**，
再考慮專門改善搜索前幾層的真正 SRS+ 證明。

### 回應使用者的公平性／算力質疑：不應把鏡像當成兩個新樣本

在現有雙方同 seven-bag seed、同步決策及鎖定、
攻擊在落子後交換的確定性 Tetrp 對戰中，
大部分角色交換結果都是完全鏡像。
舊 4 seed × swap 的「8 場」只有 **4 個獨立 seed**。
多一輪鏡像不是獨立勝率證據。例：seed 8 的
原／交換位置均在 562 鎖後由同一 Bot KO，
其節點數完全一樣。

**已實作** `SWAP_ROLES=0`：
- `scripts/rook-vs-rook.js` 和 `scripts/rook-vs-kiwi.js`
  都可指定每個獨立 seed **只跑一次**。輸出
  0/1 slot 正常完整 Tetrp authority，仍須同步落子，
  相同初始 seed，最多 2000 鎖 KO-first。
- 為保留仍明確期待兩列鏡像結果的歷史 ablation CI，
  未指定 `SWAP_ROLES` 暫時**沿用舊預設 '1'**；
  這是**舊 workflow 相容**，不是正式推薦作法。
  新、正式強度測試一律明確設定 `SWAP_ROLES='0'`。
  只在偶爾檢查角色對稱性時使用 `SWAP_ROLES='1'`，
  不把鏡像當成獨立 seed。
- [新的 pinned Kiwi KO workflow](https://github.com/jush0147/tetrp/actions/workflows/rook-ko.yml)
  使用不同的 8 個 seeds 67020–67027，各 seed
  **只跑 1 場**，保留 Kiwi 200K nodes 和
  ROOK 6K evaluations、完整真 KO、
  2000 顆安全上限。
  這是重新建立 baseline，**不是新 ROOK 強度變更**。
- `test/rook-budget-config.test.js` 驗證新
  `SWAP_ROLES='0'` 的單 seed 對戰筆數與交換行為，
  `test/rook-ko-single-seed.test.js` 以 **1-lock
  protocol smoke（不是強度測試）** 證明 Kiwi
  對戰輸出 1 seed/1 match，並列入 acceptance。
  實際強度仍永遠 KO-first，2000 只作上限。

**最新唯一 P0 下一步**：
1. 看 [真實壓力 Spin 搜尋覆蓋率 CI](https://github.com/jush0147/tetrp/actions/workflows/rook-real-ko-public-stress.yml) 新版結果：尤其在有洞／垃圾的局面，每個 ply 真正 SRS+ 枚舉分配、futureSpinClears、HardDrop fallback。
2. 查 8 個不同 seed 的 [Kiwi baseline](https://github.com/jush0147/tetrp/actions/workflows/rook-ko.yml) 和 [最新 acceptance](https://github.com/jush0147/tetrp/actions/workflows/rook-bot.yml) 是否成功，列清 KO/capped/invalid，絕不提前宣稱。
3. 如發現 spin 繼續手被 generic forecast 低估，設計**受控的真正 SRS+ 未來分支擴張**，不是單純再從 9 加到 24 probes；在同預算的新獨立 seeds KO 衡量。
4. 若未來 reachability 並無致命缺口，優先查長期 attack/garbage value model，不再試孤立的洞數 penalty。
5. 仍保持 PR #6 Draft，記錄未完成的 CI，未經 Kiwi KO 實證不合併 main。


### 2026-10-10 07:15：真正 SRS+ 搜尋在末層歸零，但均分仍未改選

本輪不是新 KO 勝率，而是利用已保存在
[Actions #37949389406](https://github.com/jush0147/tetrp/actions/runs/37949389406)
的 22 個真實玩家公開 snapshot，
搭配 [source snapshot #37954752567](https://github.com/jush0147/tetrp/actions/runs/37954752567)
在本地重新執行 ROOK 判斷（只有 2 個獨立 seed；
沒有新增 Kiwi 對手運算，也沒有隱藏資訊）。

在原 5 ply／beam 48／maxNodes 24K，全部 22 個公開盤面
的真正 `enumerateReachable` 未來 SRS+ 探測：
後續第 2／3／4／5 層分別 **66／63／63／0 次**，
因 `ceil(9/(5-1)) = 3`、前三層用完 9 個
`futureReachableProbes`，最後一層只剩廉價
Hard Drop 與既有 bounded Spin forecast。
同組局面額外找到的 `futureSpinClears` 累計 7 個
候選，另有約 77 個原 spin-forecast 產生的潛在旋轉消行候選。
**這兩者只是搜索候選計數，不是權威場上實際打出 7/77 次 Spin。**
這解釋為何更多 depth 不一定有相同比例的 SRS+ 戰術覆蓋。

新增可選 `chooseMove(...,{futureProofSpread:'balanced'})`，
原版默認 `'legacy'` 不動；仍共用最多 9 次 genuine
future reachability 探測，不提高 cap、不偷看不可見 NEXT：
5 ply 時以 **2／2／2／3** 取代
**3／3／3／0** 的逐層分配。首次真實盤面已確認
`[0,3,3,3,0,0]` → `[0,2,2,2,3,0]`。
在同樣 22 個公開真實盤面使用 5×48/24K
測試後，後四層 genuine probes 總計
由 **66／63／63／0** 改為
**44／42／42／63**，實際枚舉到的 SRS+ moves
由 4014 → 4177，**但 0/22 局面改選**；
`futureSpinClears` 仍累計 7，
`forecastedSpinClears` 仍累計 77。
所以這是一項確實修正搜索**覆蓋位置**的 opt-in 實驗，
**尚未證明提升戰鬥力，也未改正式預設**。

新增 `test/rook-future-proof-spread.test.js`：
- 確認 `legacy` 顯式指定和原預設完全相同；
- balanced 5 ply 真的延伸到最後公開 ply，
  且全部 probes 合計 <= 9、eval <= 24K；
- 不讀／不修改玩家公開 Current／Hold／NEXT5；
- 非法模式會明確拒絕。

新版 [real KO public-state stress workflow](https://github.com/jush0147/tetrp/actions/workflows/rook-real-ko-public-stress.yml)
也加入 balanced-vs-deep 的第 4 個候選，比對
每層 future reachability 和 Kiwi root 同手次數；
結果必須待最新 CI 確認。

**新的優先結論**：只有最後一層的 SRS+ 搜尋未覆蓋，
**不足以在已觀察的 22 個公開局面改變最佳第一手**。
不能因程式上找到一個配額缺口，就宣稱那是 Kiwi
0:8 的原因。下一步應轉向真正長期攻擊價值／
B2B 和可延續 Spin 戰術的評估與搜尋；
比對樣本應增加新 seed，避免在這兩個已反覆使用
的 seed 上過度擬合。

[ROOK vs pinned Kiwi 單場/種子正式對戰工作流程](https://github.com/jush0147/tetrp/actions/workflows/rook-ko.yml)
已設定 `SWAP_ROLES=0` 和 8 個不同 seed；
結果排隊期間不得宣稱新版打敗 Kiwi。

## 2026-10-10 最新 P0 交接：CI 清理、8 個 Kiwi 種子、垃圾 Belief 排名修復

**CI：** 上輪曾達 81 queued / 7 in progress。縮減已完成的消融
workflow 的 push 路徑、避免 feature branch 上 Phase 1
重複 push+PR、加上 concurrency 與來源篩選後，
最新查詢已是 **0 queued**，不過新的測試可能仍在執行。
主要修正為 a72e1a9、2a7f868。舊任務大多是由
GitHub 完成／取消，不是我們逐一手動取消。
後續只在必要實驗時啟用昂貴的矩陣，不要每次修改核心
程式又重跑十多個已完成的消融。

**Kiwi 新基準驗收通過：**
https://github.com/jush0147/tetrp/actions/runs/38002025362
8 個不同 seed (67020 至 67027)，每 seed 只打一次，
真實同步 KO-first、2000 鎖 safety cap。
**ROOK 0 勝、Kiwi 8 勝**，全部真 KO，0 capped。
這是獨立種子擴張，不是新版 ROOK 強度提升；
兩側 Kiwi 200K nodes 與 ROOK 6K eval 不等 CPU。

**有關未知垃圾的深度錯配：** 在保存的 22 個 Kiwi KO
公開局面中（只有 2 個不同 seed），用舊版程式重播：
4×24 和 5×48 各有 3 個盤面的 final beam 包含提前
停止的根候選，其中 1 個真的選中有 unresolvedGarbage
的較淺路線（seed 67020, turn 8, forecastTank=2，
第 2 層停止，而搜尋原定 4 層）。
真實原因是未公開的垃圾洞位不能猜測；但不同深度的
總分直接比較仍可能造成價值偏差。
be6240f 在壓力診斷加入 selectedLeafPly、
finalRootsTerminatedEarly、selectedUnresolvedGarbage 以重驗。
22 個局面並非 22 場獨立對戰。

**一項真正的程式排序 bug：** 在 opt-in
garbageBelief=true 模式中，信念預測重新寫入 evalScore，
但 beam 實際按照舊的 beamScore 排序。066ba4e
修正兩者同步更新，保留既有 intermediate shaping delta，
並新增測試驗證差的 belief score 真的會讓候選排名下降。
正式預設垃圾 belief 仍是 false，並未證明強度上升。

**最新實測任務：** c5e6b4d 在真實
https://github.com/jush0147/tetrp/actions/workflows/rook-real-ko-public-stress.yml
加入 3 個 pending>0 公開局面的 opt-in belief A/B：
統計 beliefEvaluations、overBudget、選棋是否改變、
搜尋 CPU 及與 Kiwi 決策差異。這不是 KO 強度證據。
結果須確認 CI 完成後才可解讀。

**下一個唯一 P0：** 查看最新公開壓力診斷和 ROOK
acceptance 是否成功。若 belief 的期望值在多種未知垃圾情境
仍無法帶來好決策，再研究長期攻擊、B2B、T-Spin
策略的 valuation，不再盲目增加搜索寬度或 tweak holes。
PR #6 保持 Draft，main 未合併。

### 同日補充：修復後 belief 在真實公開垃圾局面並未改選

[Action #38015275950](https://github.com/jush0147/tetrp/actions/runs/38015275950)
已成功執行（commit c5e6b4d），其 22 個真實玩家公開局面
中只有 **3 個** pending > 0。
修正後 garbageBelief=true 在這三局都實際完成了
3 次 belief 評估，**沒有情境超出上限，
但第一手 0/3 改變，0/3 與 Kiwi 同手**。

細節：
- seed 67020 / turn 8：pending=4、holes=0，
  仍選擇 occupied Hold，且
  selectedUnresolvedGarbage=true。
- seed 67020 / turn 20：pending=2、holes=7，
  仍選擇 T Full-Spin 擺法，非 Kiwi 同手。
- seed 67023 / turn 8：pending=1、holes=1，
  仍選擇 occupied Hold，非 Kiwi 同手。

新增追蹤未完成搜尋葉片的指標也確認：
在 22 個位置中，4×24 與 5×48
**各有 3 個** final beam 含未達目標深度的根；
其中一個局面的最終選擇確實落在提早停止的節點。
因此下一個核心假說更明確：
**不是多估一次未知垃圾機率就能補足不同 horizon
的路線評價**。需調查在 hidden-hole
資訊邊界處採用玩家公開可觀察到未來後重新計畫的
條件式 continuation/expectimax，而非單純固定
beliefRiskWeight；並正式以足夠獨立 seed
的完整權威 KO 驗證。

此結果僅 3 個公開受壓局面，且來自 2 個 seed，
不能據以宣稱 belief 策略對所有局面無效；
目前尚無能採納的勝率證據。

### CI 成本控制再修正（2026-10-10）

GitHub pull_request path filters 在同步提交時看整個 PR diff，
因此即使新增的 commit 只有文件，也可能重新跑 Phase 1 和
Viewer/Playwright，這是 81 筆排隊的殘餘成因。
commit 10c6990 已為 engine-tests.yml 與 pages.yml
加入 job-level draft-PR guard：當 pull_request.draft=true，
不跑這兩套完整 build；同時把 ready_for_review 加入
PR 事件觸發。對 main 的 push 與非 Draft PR，
仍維持正式測試，ROOK acceptance 仍會在 feature branch
上的 src/test/scripts 相關變動時自動驗收。
此措施旨在降低重複 CI 成本，不取代正式測試。


### 2026-10-10 P0 continuation: common-horizon public garbage rollout

**Experimental feature (opt-in only; PR #6 remains Draft; main untouched)**:
- src/analysis/rook.js supports beliefCommonHorizon=true. Each public possible garbage-hole outcome gets its own bounded SRS+ continuation through the ordinary beam's target depth. An incomplete final ply, another hidden-hole event, or NEXT exhaustion cannot be treated as an equal-depth leaf; failed revalues retain the old candidate rank.
- Separate cost accounting: beliefHorizonEvaluated (including abandoned evaluations), beliefHorizonAborted, beliefHorizonAbortReasons (budget / secondGarbage / publicNext). Configured beliefHorizonNodes is per scenario and separate from the main search maxNodes. Default behavior remains unchanged.
- New regressions in test/rook-belief.test.js check the default policy, private-information exclusion, budget validation and rejected partial depth. The current acceptance result must be verified before claiming the new commits are green.

**VERIFIED FIRST PUBLIC-STATE RESULT**: [Action #38021068515](https://github.com/jush0147/tetrp/actions/runs/38021068515) succeeded. On 22 archived public positions from 2 independent seeds (3 pending-garbage positions), at horizonNodes=140 the opt-in policy changed 0/3 choices, matched Kiwi 0/3, incurred 1,260 extra evaluated moves, and all 9 attempted uncertain-root revaluations aborted. Legacy belief also changed 0/3. This did not exercise a successful matched-horizon comparison, let alone any full-match KO.

**SECOND CONTROLLED STRESS RUN SUBMITTED**: increase only conditional budget to 900 evaluations per scenario and beam=2, retaining ordinary 4x24/6K and the same archived public positions. New CI asserts the total cost envelope and posts abort causes, per-position time and decisions to Issue #8 on success. Commits c732494, 99c4a9a, d97d697, d875997, afb79e5, 2587652, ee127a3 and follow-up CI fixes.

**Next P0 gate:** read the second run's abort counts by cause and whether any complete scenario made a different decision. If still all abort, stop increasing budget blindly and work on the public-conditional search architecture. If it completes and changes moves, use 2,000-lock full-KO ROOK self-play on fresh independent seeds; only test against Kiwi after a genuine strength gain. No opt-in policy promotion, APP claim or KO claim without scored evidence.


### 2026-10-10 P0 capacity result: complete common-horizon, no decision benefit

[Real-public stress CI #38021157031](https://github.com/jush0147/tetrp/actions/runs/38021157031) **SUCCESS**, artifact rook-real-ko-public-stress-diagnosis retained. Exact head 2587652. Same 22 public snapshots from only 2 independent seeds; 3 pending-garbage positions. The experimental conditional continuation uses up to 900 evaluated placements per scenario and beam 2, with 3 probed roots per pressured position.

- All 9 conditional root revaluations completed: 0 budget abort, 0 additional unknown garbage abort, 0 exhausted NEXT abort, 0 scenario-limit rejection.
- Conditional evaluations **15,786 EXTRA** on top of original ROOK node budget. First-choice decisions changed **0 / 3** relative to baseline and **0 / 3** vs prior one-step belief. Agreement with Kiwi stayed **0 / 3**.
- Per-position runtime from retained JSON artifact (ms):
  - seed 67020 turn 8: baseline 89, legacy belief 388, common horizon 1550 (**17.4x baseline**), 4686 extra evaluated.
  - seed 67020 turn 20: baseline 137, legacy 393, common horizon 1416 (**10.3x**), 5380 extra.
  - seed 67023 turn 8: baseline 135, legacy 445, common horizon 1649 (**12.2x**), 5720 extra.
- This is a controlled LOCAL public-position measurement, not a scored KO trial. Only 3 pending-garbage positions and 2 seeds: no population-level inference. Nonetheless, the result DOES reject promotion of the expensive opt-in common-horizon configuration and does NOT justify a full-KO 900-node variant benchmark. Existing baseline defaults remain.
- **Next P0**: shift focus from the isolated hidden-hole continuation hypothesis to structural attack/B2B/survival valuation and tactical search. Prior observed public 22-position disagreement and scored full KO 0:8 remain the real problem. Use traceRootScores, attack/survival decomposition and independent unseen-seed real 2000-lock A/B once a genuinely different decision policy exists. No arbitrary weight sweeps or more common-horizon budget increase.


### 2026-10-10: attack-forecast calibration and non-clearable material correctness

**Code committed to the experimental branch, not main:**
- [c2b78cb](https://github.com/jush0147/tetrp/commit/c2b78cb43c9ef804928144d40348a0808ea70209) fixes a demonstrable structural correctness defect: ROOK board transposition key used to represent `gbd` (permanent, uncleareable) as ordinary `#`. The canonical Tetrp `board.rowFull` explicitly refuses any `gbd`; those positions cannot be equivalent. Added distinct material key and stopped awarding `tetrisReady` or `tetrisConstruction` on uncleareable rows. It also adds `traceRootScores`-only per-ply generated/sent/cancelled/B2B/Combo forecast locks for calibration; ordinary default decision path remains unchanged on boards without `gbd`.
- [5010091](https://github.com/jush0147/tetrp/commit/501009189f331b675a0fca4b4ce006ac57cb0747) verifies per-ply trace consistency and public-only move types; [74fa4c2](https://github.com/jush0147/tetrp/commit/74fa4c2f5d0fa9870ad62303a3eea6efc4f5668b) checks distinct permanent-vs-ordinary material keys and disallows impossible Quad-construction credit.
- [23cde2d](https://github.com/jush0147/tetrp/commit/23cde2de43d947709a376912df03cceb0803f69f) adds `scripts/rook-forecast-calibration.js`, an isolated **no-opponent diagnostic**, comparing each visible-root first-lock attack projection with actual atomic Tetrp authority and the four-lock forecast with realized attack after fresh replanning. It NEVER feeds future authority details to ROOK.
- **Locally verified Node 22:** 122/122 dedicated ROOK tests PASS, including two new material correctness cases. With seed 67020 and 24 authority locks, **0/24 first-lock attack projection mismatches**, and on 21 fully observed four-lock windows the summed forecast sent=28 vs realized sent=28 (mean absolute error 0). This is an early no-opponent baseline and must not be presented as a realistic pressure/KO parity guarantee. A longer 96-lock diagnostic exceeded the local runtime allowance, so **NO data** from that run. Current GitHub acceptance run after this commit needs independent verification before claiming CI green.
- In the archived 22 real Kiwi-vs-ROOK public snapshots (2 independent seeds), **0 snapshots contain `gbd`**. Therefore the material correctness bug is **not** an established cause of the observed Kiwi 8:0 KO deficit, and there is **no claim of improved win rate**.

**Next P0, research not yet implemented:** Extend forecast-to-authority parity under real simultaneous opponent garbage arrival, then quantify prediction/realization divergence in sent attack and B2B at 4-ply horizon. With parity calibrated, experiment on long-term attack/survival continuation or leaf strategy; only advance a decision-changing candidate to independent-seed 2,000-lock full KO A/B. PR #6 remains Draft, pinned Kiwi and main unchanged.


### 2026-10-10: Real synchronized opponent-pressure forecast calibration

**Grounded implementations (feature branch, no default policy promotion):**
- [ef8823e](https://github.com/jush0147/tetrp/commit/ef8823e453d8fc840b045b20eb1b5c1f45f61dc1) adds scripts/rook-live-forecast-calibration.js. TWO Tetrp atomic authorities receive the exact same opening NEXT seed, choose independently before committing either lock, exchange genuine outbox garbage next turn, and maintain synchronous battle frames. One ROOK uses default offenseWeight 4.8, other uses *experimental* 7.2 solely to avoid trivial identical-policy symmetry. Bot inputs are exclusively player-visible snapshots; authority totals are read only after actual commits.
- [35ea282](https://github.com/jush0147/tetrp/commit/35ea2825c3de9e887586159828dc77987e1a510c) adds a deterministic 6-lock smoke regression: public information boundary, legal actions, accurate first attack projection and proper capped NOT-KO outcome. **123/123 dedicated ROOK tests passed locally** on Node 22.
- [aa19c47](https://github.com/jush0147/tetrp/commit/aa19c470f51e49852c3672aae6e5ef514acb4a29) adds an isolated CI workflow to re-run 3 distinct seeds and upload machine-readable reports. This workflow is not a full KO tournament and is narrowly path-filtered/concurrency-limited to avoid earlier Actions backlog.

**Locally observed, real opponent garbage**:
- seed 67020: both sides 30 synchronized pieces. Both send, receive and tank. First-lock attack projection mismatches 0/60. ROOK baseline 25 comparable four-lock windows, sent MAE 0.12, 2 B2B end-state mismatches. Opponent 26 comparable windows, sent MAE 0.1538.
- seed 67023: both sides 36 synchronized pieces with incoming garbage. First-lock mismatch 0/72. Baseline 31 comparable four-lock windows, sent MAE 0.3871, 4 B2B mismatches. Opponent 30 comparable windows, sent MAE 0.5.
- seed 67027: both sides 36 pieces, incoming garbage and actual tanking. Full strict first-lock parity (attack generated/sent/cancelled, piece/spin/lines, B2B/Combo) 0/72 mismatches. In 60 combined four-lock windows **38 plans diverged** after the first lock, including some calm windows with no incoming garbage. The second bot, offenseWeight 7.2, had 23/29 four-lock plans diverge; sent MAE 0.8966 and pressure-window MAE 2.1429, vs calm MAE 0.5. This is not proof that re-planning is inherently bad, but it does show why accurate first-lock attack physics does NOT guarantee future realized attack.
- **Caveats**: These 3 x 30-36-lock matches intentionally terminate at diagnostic safety caps, so ALL are **unscored capped**, not actual KO games, not Kiwi opponents. Evaluation windows overlap; their statistical counts are not independent. Comparing root-planned four-lock trajectory against subsequent re-planning measures policy stability, not pure simulator physics. No win-rate improvements claimed.

**Next P0**: Review the exact divergence onset and causes in pressure *and calm* windows. Determine whether the high-offense speculative paths depend on geometry-only future hard drops or T-spin search coverage, and compare credible verified continuations to their realized sent attack. If a candidate changes real decisions AND ROOK-vs-ROOK KO performance improves on fresh independent seeds, only then rerun full 2,000-lock Kiwi acceptance; never award capped games as KO. Preserve strict player-visible NEXT5.


### 2026-10-10: Live full-pressure plan-drift diagnosis and sticky-continuation KO gate

**CI-verified local research**: [Actions #38023750604](https://github.com/jush0147/tetrp/actions/runs/38023750604) SUCCESS for seeds 67020/67023/67027, 102 synchronized rounds / 204 genuine Tetrp authority locks. One side used normal ROOK offenseWeight 4.8, other opt-in 7.2 to break same-seed symmetry. All 204 first-lock sent/generated/cancelled, lines/spin, B2B and combo predictions exactly matched authority. This is not a Kiwi or scored KO trial.

Across 172 overlapping four-lock forecast windows, **114 drifted** during actual policy re-planning and 58 held their initial trajectory. 73 divergent windows were CALM and 41 involved real incoming/tanked garbage. At first divergence 89 were tagged with piece-order changes, 33 with line-clear changes, 15 B2B changes (tags may overlap). In 114 diverged paths, 79 had a previously proven SRS+ reachable future move, 35 were geometry-only. Across sampled future plies, 364 were verified SRS+ and 152 geometry-only. Thus missing future reachability alone cannot explain the whole receding-horizon policy drift; plan adherence is not intrinsically a strength metric either.

**Opt-in experimental mitigation; no default change**:
- [e05bb35](https://github.com/jush0147/tetrp/commit/e05bb3537d45a51daff24bbcb1363a27725030c6) exposes a selected public-only 4-ply forecast plan to explicit callers.
- [2079a89](https://github.com/jush0147/tetrp/commit/2079a89b89b3c17884cda96a31b94966c257f6bb) validates candidate continuation against unchanged public board/Hold/pending/B2B/combo/Current and re-proves a real SRS+ executable path before allowing a placement. Hidden holes or unrevealed future bag never enter the bot.
- [f264e3c](https://github.com/jush0147/tetrp/commit/f264e3c916e4e878121aea809255805a3645e9b1) tests default parity, no hidden state, legality and Hold constraints.
- [4be09ec](https://github.com/jush0147/tetrp/commit/4be09ec3b840732089f4ae97aed50ffcee536d52) and [5efbe7d](https://github.com/jush0147/tetrp/commit/5efbe7db6cad23bba05a0e5c2ada48cd68aff3d1) integrate opt-in EXPERT_STICKY=1 into actual same-seed synchronized Tetrp KO harness; optional held continuations receive fresh authority validation; invalid future candidates fall back to a fresh legal search.
- Local tests **125/125 passed** under Node 22. A SMALL, 24-lock unscored smoke (67027 at 1200 nodes) accepted 13/14 continuation attempts but sent only 2 vs baseline 6 lines. This is adverse preliminary evidence, not scored KO.
- [baa43bb](https://github.com/jush0147/tetrp/commit/baa43bb117193f1e5f299cc4508d317b877f0195) adds one strictly scoped true KO-first workflow for two NEW independent seeds 67101 and 67102, identical bag seeds on both sides, 6K nominal evaluations, full 2000-lock safety cap; no mirror games, capped/double-KO never win. Do not claim a KO or CI success until each run actually finishes.

**Decision rule:** Never promote this sticky plan solely for plan consistency. If independent fresh-seed KO evidence is negative, abandon persistence and focus on improving 4-ply value/attack strategy itself. If the plan survives real ROOK self-play, only then consider a pinned-Kiwi KO challenge. PR #6 Draft; main and baseline ROOK unchanged.


### 2026-10-10: True KO counterexamples and P0 attack deficit diagnosis

**Sticky Continuation FAILED the real KO gate**: [Actions #38024094512](https://github.com/jush0147/tetrp/actions/runs/38024094512) returned two distinct independent-seed true scored KOs, no mirrored duplicate: seed 67101 at 299 synchronized locks, baseline wins (Sticky 116 sent vs baseline 132; 186/217 continuations adopted), and seed 67102 at 513 locks, baseline wins (Sticky 222 sent vs baseline 240; 319/370 continuations adopted). Sticky **0:2**, default stays OFF; plan stability was not a substitute for tactical replanning.

**Pinned Kiwi KO authority artifacts re-examined**: eight distinct seeds 67020–67027 from [Actions #38002025362](https://github.com/jush0147/tetrp/actions/runs/38002025362). All **8 true scored KOs** were Kiwi victories after 38–81 synchronized locks (mean 61.25). Per-game mean **sent APP 0.415 ROOK vs 0.836 Kiwi**; at the first 25 locks, mean sent APP **0.260 vs 0.550**. Average garbage tanked per match **37.25 ROOK vs 13.875 Kiwi**; ROOK lost via garbage smash in 7/8 games, topout in 1/8. ROOK had already fallen behind in OFFENSE long before most KOs. Kiwi costs about **1,090ms/lock vs ROOK 288ms/lock** in these reports and search-node units differ (Kiwi 200K nodes vs ROOK 6K eval budget). These are observations, NOT matched-CPU causal evidence, and APP is not the sole goal. However, raising early consistent offensive output is a clearer P0 than passive plan stability.

**Default root-score decomposition on the 22 pinned public snapshots (only 2 independent seeds)**: 13 differing ROOK/Kiwi first-action decisions, and Kiwi's first action still appeared among ROOK's 4-ply surviving finalists in every snapshot. For these 13, ROOK's selected terminal board averaged about **1.38 less height, 1.54 fewer holes** and its forecast attack **+1.0 sent** within four known moves. ROOK's own estimated value margin averaged **+19.91** (about +6.76 projected attack reward contribution and +13.15 discounted board-value contribution). This does NOT establish Kiwi's action as superior from two seeds. It suggests a short-horizon/terminal-policy valuation gap: conservative-looking four-ply outcomes can systematically miss future attacking conversion.

**New fifth-ply finalist experiment**: [a6bce2c](https://github.com/jush0147/tetrp/commit/a6bce2cbabb498e0beff915ebd4b8511c32ce483) adds opt-in exactLeafExtension only for depth=4, evaluating the publicly known fifth move through bounded actual SRS+ witnesses for every finalist. If a hidden incoming garbage hole / budget limit prevents a fair full-horizon comparison, NO rerank. This is a one-ply *bounded reachability* extension, not a proof that prior four geometric forecast moves are executable. [b0a4cd4](https://github.com/jush0147/tetrp/commit/b0a4cd42276bac0f4db88a7e7d6fe2d606231f2e) exposes it to opt-in genuine KO harness with separate extra work accounting; [c8c6bb4](https://github.com/jush0147/tetrp/commit/c8c6bb40d6431381b29ca8147d8ba96affbed87a) adds tests. Local Node 22 ROOK suite **128/128 pass**. [CI screen #38026148441](https://github.com/jush0147/tetrp/actions/runs/38026148441) **SUCCESS**: 22 archived public positions, 19 complete, 3 unknown-hole aborts, 5 changed first actions, prior Kiwi-action agreement 8 vs 9 (NOT strength evidence), **20,311 additional candidate evaluations**. Local 24-lock capped/unscored seed 67109 early attack comparison was adverse: fifth-ply candidate sent 1 vs baseline 10, and candidate spent more CPU. Some selected reranks move from a safe/four-ply-attacking path to a higher-hole/less-attacking path solely for better best-case fifth move; a genuine research risk of horizon overfitting.

**True two-seed KO gate**: [fdcb8db](https://github.com/jush0147/tetrp/commit/fdcb8dbee6f862f833253360f3a2e75b8b8b5ed9) configured new independent seeds 67111/67112, same bag on both sides within each, full 2000-lock KO-first cap, unequal CPU cost explicitly recorded, no redundant mirrored games. At roadmap update time CI screen has passed but the two KO jobs have NOT yet been verified complete. DO NOT claim a result until it actually finishes. All fifth-ply and sticky features remain opt-in and main untouched.

**Next strategic P0**: If exact fifth-ply also fails scored self-play, stop expanding search horizon blindly. Focus attack-generating moves with real Tetris/T-spin and B2B structure, not solely avoiding board holes. Require first-lock parity (already 204/204), public NEXT5 only, and ultimately verified full-KO performance vs pinned Kiwi at transparent and eventually comparable CPU.


### 2026-10-10 P0 next-step verification: attack opportunities on authentic public boards

[Lightweight real-public opportunity CI #38026665237](https://github.com/jush0147/tetrp/actions/runs/38026665237) **SUCCESS** using the stored 22 immutable player-visible real Kiwi-vs-ROOK positions from **only 2 distinct source seeds**. [f9615b9](https://github.com/jush0147/tetrp/commit/f9615b93e5e00d61e4821a21672f8b4a6f946d62) enumerates legal current/Hold SRS+ moves and projects *actual immediately attainable* public Tetrp attack, rather than inferring it from a surface score. 7/22 positions had any immediate attack-sending placement; ROOK originally chose Place 17 and Hold 5. In only 2/17 direct Place root decisions, the root sent less immediate attack than some other legal root (Hold outcomes explicitly unknown until re-analysis).

**Policy-produced board differential in the same small cohort:** ROOK-owned public boards offered immediate attack in only **1/12**, vs Kiwi-owned boards **6/10**; their average maximum one-lock attack opportunities were **0.083 vs 1.000 sent lines** respectively. Observations overlap heavily and only 2 distinct seeds => these are NOT independent match-level rates. The key P0 hypothesis is therefore **board construction that actually makes attacking possible**, not greedy reweighting of immediate sent attack.

[ c145439 ](https://github.com/jush0147/tetrp/commit/c145439ec5e3a076744cb2dbc628cdfd311595e9) enhances **future** ROOK-vs-Kiwi full-KO telemetry with canonical actual TSS/TSD/TST, Mini, Quad, ordinary clear, AllClear and maximum B2B event counts, without feeding authority state into either bot or changing selection. [812498e](https://github.com/jush0147/tetrp/commit/812498e82a31dcb12e5af028433ccf9606c292f9) regression smoke confirms it distinguishes capped from KO and uses the same simulator. **Local Node22 dedicated ROOK suite 129/129 PASS.** A single locally attempted exact-200K Kiwi 25-lock rerun exceeded the runtime cap and produced no valid telemetry. Do NOT claim retrospective TSD/Quad counts for the eight archived Kiwi KOs.

As of this checkpoint the separately configured verified-fifth-ply KO-first workflow [#38026148441](https://github.com/jush0147/tetrp/actions/runs/38026148441) had a successful public screen, while seed 67111 was still in progress and 67112 queued. This is NOT a KO result. Candidate is opt-in, costs additional CPU, and a tiny early pilot underperformed. Sticky 0:2 actual scored KO also rejected. Keep both off; PR #6 Draft, main untouched.

**Future acceptance**: develop a repeatable offensive construction signal (reachable T-spin/Tetris/B2B opportunity from public pieces, without fake attack credit), show it influences choices from low-opportunity ROOK-owned boards, then validate on truly independent 2,000-lock KO-first ROOK self-play, and finally pinned Kiwi. Do not substitute count of board templates for generated/sent attack or KO wins.


### 2026-10-10: Fifth-ply experiment 2-0 full KO, compute-matched follow-up

**Confirmed independent-seed genuine full KOs**: [Actions run #38026148441](https://github.com/jush0147/tetrp/actions/runs/38026148441) completed success for **both** matches, seeds 67111 and 67112, one same-bag-seed synchronized 2.5 PPS 24-frame-per-lock KO-first match per independent seed (NOT mirrored), 2000-lock limit only as safety cap. **Verified fifth-ply defeated ordinary 4x24/6K ROOK 2:0**, both genuine scored KOs:
- 67111, 628 synchronized placements, candidate sent **356** (sent APP 0.5669) vs baseline sent **295** (0.4697), +717,895 additional certified evaluation operations over entire match; candidate CPU **700426ms** vs baseline **233246ms** (3.00x).
- 67112, 118 synchronized placements, candidate sent **77** (0.6525) vs baseline sent **64** (0.5424), +141,337 extra operations; CPU **96469ms** vs baseline **27791ms** (3.47x).
- Combined extra future SRS evaluations **859,232**, and observed objective strength signal is real wins, **but in unequal CPU conditions**; two seeds remain much too small to claim robustness, and Kiwi was NOT the opponent.
- The early 24-lock pilot losing 1:10 sent was a misleading local signal; genuine KO-first verification correctly overrules short capped attack snapshots as a strength proxy.

**Compute comparator calibration (local, Node 22)**: on five independent public-position *snapshots from existing two seeds*, the original 4x24/6K policy took about 277ms per decision, fifth-ply certified 4x24/6K+5000 extra evaluations around 753ms, 5x48/24K forecast ~398ms, 5x72 ~472ms, 5x96 ~578ms, and 5x128/120K + 15 full-reachability future probes ~842ms. Samples are limited, timings fluctuate, and this is not equalized compute on each actual match. The depth-five control gets *more breadth and more future SRS proof effort*, not exactly the same search-unit budget.

**New genuine near-CPU A/B gate**: [runner control change a1325e9](https://github.com/jush0147/tetrp/commit/a1325e9c81e5e2d02ecb3d9e4b23856700b2e1b9) adds independent `ROOK_BASELINE_FUTURE_PROBES` and companion candidate settings, defaulting to the prior untouched 9. Independent budget bounds validated; 2-lock genuine synchronized local smoke seed 67119 confirmed the experimental fifth-ply 4x24/6K+5K vs higher CPU comparator 5x128/120K/15 probes, both choose legally and cap is unscored, no mirrors. [Workflow 72461ee](https://github.com/jush0147/tetrp/commit/72461eeed83396ee77558fd11a3ddb56f2390bb9) schedules full scored KO-first A/B on **two NEW distinct seeds 67121 and 67122**. One match per seed, max-parallel 1, 2000 synchronized locks cap, per-side measured CPU, total evaluated work and actual sent. It reports winner only for real single-KO endings. Neither control has demonstrated a KO result as of this entry; don't promote the candidate based on small seed sample or unequal CPU.

**Implication:** fifth-ply accurate next move may provide value, but the next uncertainty is whether this advantage survives a substantially larger, nearer-CPU legacy search. If not, the correct conclusion is “spending more useful compute improves ROOK”, not “a special fifth-ply scoring rule beats a fair opponent.” Both production policy and pinned Kiwi remain unchanged; PR #6 stays Draft.


### 2026-10-10 near-CPU control: 22-position timing and reproducibility

**Local Node22 CPU calibration on the pinned real public observation cohort**: 22 overlapping public decision snapshots from just 2 independent original Kiwi matches. On this same machine, fifth-ply certified 4x24/6K plus up to 5K additional SRS work required roughly **18,691ms** total (849.6ms/decision) versus deeper 5x128/up-to-120K with 15 full future SRS probes roughly **18,000ms** total (818.2ms/decision). Candidate/deeper aggregate CPU ratio **about 1.038** (+3.8% candidate); much closer than the prior ~3.0–3.5x candidate advantage against cheap 4x24/6K. Important: the first 20 observations were captured in one local batch that reached the execution time ceiling near completion; last two observations were individually rerun, so these aggregate times are approximate, not a single controlled benchmark run, and both settings may scale differently inside an actual match. This is NOT an enforced per-decision CPU limit.

**Reproducible GitHub-owned comparison**: [d9ed5d6](https://github.com/jush0147/tetrp/commit/d9ed5d6900def4c4f7c39b345a153e60fde4cdad) adds a portable public-only 22-position CPU and differing-first-root diagnostic; [ce9461e](https://github.com/jush0147/tetrp/commit/ce9461e46dc9d21562d49d98354fbf463c2c9837) adds an isolated, narrow-trigger CI run that reads only the previously archived player-visible observations, checks budgets/mutation/privacy, saves the full JSON and reports measured times into Issue #8. No Kiwi search and no actual KO are run in this calibration workflow. Results were not yet verified at the time this handoff was written. The two NEW independent-seed full KO-first near-CPU matches 67121/67122 remain the decisive gate; report their **actual CPUms** and winning/KO/cap classification separately. No PR promotion.

**Negative local side study, not shipped as production policy**: weighted next-known-piece SRS-certified attack-readiness on four-ply finalists changed only 1/22 historical root actions while consuming 20,311 extra evaluations, with unchanged Kiwi-action agreement 8/22. The expensive quick-and-dirty score is not promising enough for another giant KO matrix. No claims that it solves offensive construction.


### 2026-10-10 P0 follow-up: direct pinned Kiwi KOs reveal full-TSD production gap

**Scored new-seed direct pinned-Kiwi 200K games:** [Actions #38037511025](https://github.com/jush0147/tetrp/actions/runs/38037511025), four new distinct independent seeds 67131-67134 configured; each is one nonmirrored same-bag synchronized TL game up to 2000 locks. When this entry was written, three runs had completed with actual single KOs, all won by Kiwi; seed 67134 was still in progress. Using opt-in ROOK fifth-ply 4x24/6K plus separately bounded 5K future SRS:
- 67131: Kiwi wins in 66 locks, ROOK sent 26 / APP .394 vs Kiwi 56 / .848, ROOK full TSD 1 vs Kiwi 7, search CPU R/K ratio .839.
- 67133: Kiwi wins in 56 locks, ROOK sent 15 / APP .268 vs Kiwi 50 / .893, ROOK full TSD 0 vs Kiwi 4, CPU ratio .819.
- 67132: Kiwi wins in 273 locks, ROOK sent 108 / APP .396 vs Kiwi 231 / .846, ROOK TSD **1 vs Kiwi 26**, ROOK Quads **16 vs Kiwi 8**, ROOK ordinary Singles **61 vs Kiwi 18**, Kiwi longest B2B **10 vs ROOK 5**; CPU ratio .645.
These are true KOs and actual authority classifications, **not comparable CPU** and do not establish that more compute alone fixes strategic TSD production. A local fifth-ply 2-0 against cheap ROOK and 1-1 against nearer-CPU deeper ROOK had not translated into beating Kiwi at this checkpoint. **Do not count seed 67134 until verified complete.**

**SRS+ performance improvement without policy change:** [6bccca4](https://github.com/jush0147/tetrp/commit/6bccca4da42e0d6084200b06cfaedfd9a3d20671) replaces copying the entire BFS input path for every queued move with predecessor-index chains, only materializing the exact path for confirmed landing witnesses. The original FIFO traversal order, spin classification, public input, landing choices AND legacy path-tie policy are preserved. From 22 historical public states (2 source seeds), 44 identical reachability calls with 1195 original landings had byte-for-byte identical results; a 44-case × 8 alternating-order microbenchmark measured old 6234.5ms vs new 5344.3ms (**0.857 ratio; about 14.3% isolated search savings**, NOT a full-match CPU or KO improvement). Before this refactor the local ROOK suite passed 125/125 and afterward passed 125/125. [35885a5](https://github.com/jush0147/tetrp/commit/35885a5c3e8ad68449743dd9ccd522adce840133) pins five exact pre-refactor SHA-256 SRS path/rotation fingerprints across empty, pocket and garbage boards.

**Optional public-only TSD trajectory evidence:** [4de0af8](https://github.com/jush0147/tetrp/commit/4de0af83eee452439c26816f542daaa26e7229ec) records last six original publicly visible board/current/Hold/NEXT5/attack snapshots before each actual authority-confirmed full TSD for either side. Not enabled in normal policy; private Kiwi search / hidden bag / RNG excluded. [fe6cf0c](https://github.com/jush0147/tetrp/commit/fe6cf0c44452cac6113a2837f10680f3272b19c3) measures geometric TSD scaffold availability zero to five locks prior to an actual TSD; crucially a geometric scaffold is NOT automatically awarded attack without a genuine full SRS+ proof. [dbd013f](https://github.com/jush0147/tetrp/commit/dbd013f07bead8d4ec995a33aa175cdf7dcc524a) launches a **single existing seed 67131 deterministic explanatory replay** against original Kiwi 200K, strictly not counted as a new independent KO seed. No trace findings are claimed until this run finishes and passes its authority-parity validations.

**P0 priority:** distinguish *formation of repeatable efficient Full TSD slots* from *merely executing an already-ready TSD*. Ordinary Quad frequency alone is not enough. Examine the public precursor trajectories and whether current shape heuristics detect them 2–3 locks before the T arrives; use demonstrated public constructions to improve tactical search while preserving Hold, public NEXT5, B2B, garbage survival and proper all-Mini rules. Demand independent fresh-seed true KO improvements before policy promotion. Current policy stays research opt-in, pinned Kiwi and main untouched, PR #6 Draft.


### 2026-10-10 evening: all four pinned Kiwi losses, TSD precursors, false positives, and source gap

**Final direct score**: [Kiwi 200K KO Actions #38037511025](https://github.com/jush0147/tetrp/actions/runs/38037511025) completed four independent same-bag-seed, nonmirrored 24-frame synchronized actual KO-first games; pinned Kiwi **4:0** against opt-in bounded fifth-ply ROOK. Each ended by real KO, none capped; independent seeds 67131,67132,67133,67134. Total: ROOK managed only 4 confirmed Full TSDs (1+1+0+2) while Kiwi completed **58** (7+26+4+21). This is not a matched-CPU comparison, and high TSD count alone is NOT the ultimate objective. However persistent TSD setup/B2B is now a well-observed first-order bottleneck, not an abstract heuristic preference.

**Authoritative public-only TSD precursor sample**: [#38037975841](https://github.com/jush0147/tetrp/actions/runs/38037975841) replayed existing 67131 (NOT another independent match). 7 Kiwi actual TSDs and 1 ROOK TSD. Geometric TSD scaffold potential existed on 7/7 Kiwi boards exactly two locks before true TSD and 6/7 three locks beforehand. These are *success-selected* histories only, so sensitivity alone is not enough to adopt the geometry heuristic.

**False-positive controls over ALL real public boards**: [#38055352753](https://github.com/jush0147/tetrp/actions/runs/38055352753), 66 synchronized locks * 2 sides, 132 public-only snapshots from the SAME historical seed 67131; each lock labeled retrospectively by authority. On the 64 Kiwi boards with the next two actual outcomes observable, TSD in next 2 was present in 14 (21.9% base rate). The existing any-scaffold geometry indicator had TP14 FP31, **31.1% precision / 100% recall**, including a very large false-positive pool; the stricter max-one-missing indicator had TP12 FP12, **50% precision / 85.7% recall**, and full geometry TP10 FP10, **50% precision / 71.4% recall**. A geometric TSD slot was present in 22 of 132 board snapshots; 12 did not have an *immediately SRS-proved current-T* TSD, which does not mean an unavailable future T cannot complete it later. **Never convert raw scaffold counts directly to guaranteed generated attack.** [f800f39](https://github.com/jush0147/tetrp/commit/f800f39dd23fb4d94db71570b716c3b4a45c6605) records all public pre-lock boards, [0641f2a](https://github.com/jush0147/tetrp/commit/0641f2a245d1d210f08a7b0a0c04cbf59d49f563) computes full confusion matrices at 1/2/3 locks, and [506a2b0](https://github.com/jush0147/tetrp/commit/506a2b040872bbbab2b9d62006a73f8954b46ad9) validates them in a single-seed CI.

**Search coverage from genuinely successful Kiwi boards**: [#38055586168](https://github.com/jush0147/tetrp/actions/runs/38055586168) evaluates the 7 Kiwi true-TSD precursor states at 1, 2 and 3 locks lead using the unchanged default 4x24/6K ROOK root-score search with public NEXT5. Surviving best-root four-ply path predicted a Full TSD **7/7** at lag1, **5/7** at lag2, **4/7** at lag3, 16/21 overall, each predicted TSD has SRS+ witness and the 16 scored routes had no preceding geometry-only movements before the proposed TSD. This means ROOK CAN recognize many useful continuations on Kiwi-prepared boards, although no conditional future garbage or actual multi-ply follow-through is certified merely by a trace. [f660c2b](https://github.com/jush0147/tetrp/commit/f660c2b960ebee6fde4c3f5ddde9100cc1b3a3cf) supplies reproducible diagnosis; [83b3915](https://github.com/jush0147/tetrp/commit/83b391596c4f97ef2f7d7877f16025b5ed358175) provides CI validation on the archived public-only artifact.

**ALL real boards, regardless of outcome**: [#38055697788](https://github.com/jush0147/tetrp/actions/runs/38055697788), 66 ROOK-made and 66 Kiwi-made public boards from the same one reference seed, identical 4x24/6K ROOK search run on both: ROOK boards had a positive geometric TSD scaffold in **10/66** vs Kiwi **46/66**; full geometric scaffold **1/66** vs **21/66**; best ROOK 4-ply surviving root forecast any TSD **2/66** vs **28/66**, and when requiring all-prefix SRS-witnessed path **2/66 vs 27/66**. Actual authority TSDs on those boards were 1 vs 7. Replays are correlated, one-seed descriptive only, not generalizable rates. This is direct evidence that the major gap is **constructing the offense-friendly boards themselves**, not only spotting a TSD once one already exists.

**Rules defect fixed**: [733e9f9](https://github.com/jush0147/tetrp/commit/733e9f97077e648fe328bf7e57ee2f6523a62c31) excludes target rows containing un-clearable permanent `gbd` from candidate Full TSD scaffolds. Previously those rows could earn phantom geometric setup credit, despite Tetrp `board.rowFull` never clearing `gbd`. [7c421e8](https://github.com/jush0147/tetrp/commit/7c421e8deb706105e6b0a748ec5de94d6c81c043) adds the regression. Original synthetic Full TSD fixture and all existing TSD tests passed locally after the change. Not an explanation for the historical seed 67131 (the source replay did not establish a `gbd` error).

**Newly submitted root-setup-choice audit (outcome must be independently verified before citing numbers)**: [ac69594](https://github.com/jush0147/tetrp/commit/ac695940e2a19decb88ad8cf611f769d11d9b795) runs all genuine SRS+ Current-piece legal placements on each public board, replays one clear through Tetrp board authority and compares best possible geometric scaffold improvement versus default ROOK chosen direct root. [c277e44](https://github.com/jush0147/tetrp/commit/c277e443a29cf9d455057f8a050c881e2f7d8af1) creates a narrow one-reference-seed reporting workflow. This determines whether low TSD readiness is already avoidable in ONE legal lock (value/ranking issue) or requires TWO-PLUS known public-piece construction moves (search/reachability issue). One-lock geometric progress is NOT guaranteed later TSD or KO. **No win or policy promotion** without measured actual full KO improvement.

Next exact task after this audit: decide between properly extending generation of *legally verified multi-lock TSD setup candidates* and revising root/leaf valuation of existing concrete setup options. No arbitrary large unconditional scaffold bonus, no copying Kiwi's hidden state or extrapolating NEXT6, and no treating 132 correlated boards as independent 132 games. All new experimental policies remain disabled by default; main and pinned Kiwi unchanged; PR #6 remains Draft.


### 2026-10-10 late: target the MISSING two-lock Full TSD construction opportunity, not just TSD weight

The default ROOK policy remains untouched. New TSD evidence is still **one independent source seed** (67131), and all boards are overlapping and policy-distributed. From [the identical-public-board 66-vs-66 audit #38055697788](https://github.com/jush0147/tetrp/actions/runs/38055697788), the same ROOK four-ply search saw a forecast TSD in its best final candidate on ROOK-created boards **2/66** times, vs Kiwi-created boards **28/66** times. Source policy's actual Full TSD events: ROOK 1 vs Kiwi 7. This strongly points to maintaining offensive board structures as a bottleneck, but does not establish a multi-seed population rate.

**Immediate construction-vs-selection diagnostic**: [#38055841412](https://github.com/jush0147/tetrp/actions/runs/38055841412), genuine canonical SRS+ enumeration for every legal Current-piece placement on each public board. On 66 ROOK-created boards, 21 had *some* legal one-piece move increasing geometric TSD-scaffold potential; only **2/66** had a legal move that could immediately create **complete** geometric TSD readiness. Of 62 chosen direct Place moves, 15 selected a lower *purely geometric* scaffold score than another legal placement (not evidence the other move would improve KO). On 66 Kiwi-made boards, 32 had a legal one-piece move improving scaffolding and 30 had a move creating full geometric setup. Therefore a single root-scaffold bonus is not enough to fix the starting-state gap; credible multi-lock plan generation is necessary. [ac69594](https://github.com/jush0147/tetrp/commit/ac695940e2a19decb88ad8cf611f769d11d9b795) contains the diagnostic and [c277e44](https://github.com/jush0147/tetrp/commit/c277e443a29cf9d455057f8a050c881e2f7d8af1) its isolated successful CI.

**First bounded genuine two-lock SRS TSD candidate generator**: [69d7586](https://github.com/jush0147/tetrp/commit/69d758618cd1c3364b326c2911817a7bc1a63e95), with exact SRS+ proof for root CURRENT placement and a second SRS+ **Full T-Spin that truly clears 2 lines** using only publicly visible NEXT[0]=T or already-held T. No hidden bag or opponent garbage hole. The static intermediate board assumes no surprise incoming garbage during the second placement, so plans are *conditional*, not actual guaranteed future authority attacks. [c21bcb6](https://github.com/jush0147/tetrp/commit/c21bcb6551e29231462307f9fe42991ff83473b7) tests a synthetic O-setup → actual TSD by executing both placements through the Tetrp atomic authority; [CI #38056074031](https://github.com/jush0147/tetrp/actions/runs/38056074031) succeeded. Among the 66 ROOK boards, 12 publicly had the known next/held T and the *geometry-prescreened, SRS-proved* constructor found a two-lock Full TSD in **1/12**; among Kiwi boards, 28 had known T and **21/28** yielded genuine static two-lock TSD witnesses. However the constructor used a **restricted horizontal geometry template** (and candidate count capped on 14 Kiwi boards), so failure to find a witness was NOT evidence of genuine nonexistence.

**Geometry prescreen negative control (research-only)**: [e47bcf5](https://github.com/jush0147/tetrp/commit/e47bcf5c3759b44f5a0e96bbf9e2fe2d33acb948) now allows `geometryPrescreen:false` to try legal SRS+ future T on *all* first-move candidates, with explicit `secondProofCap` and truncation accounting. Previous template mode remains the default to preserve historical benchmarking. [b982d61](https://github.com/jush0147/tetrp/commit/b982d619621e81c4c2c0f58d9e89541f7ad170ff) tests caps/default parity and public-only behavior. [15ebc58](https://github.com/jush0147/tetrp/commit/15ebc5877b7aa9ee28cefda9f7c918651310ea02) audits the **12 real ROOK-owned public T-available states** against template and geometry-free bounded SRS, and [workflow 2cccea5](https://github.com/jush0147/tetrp/commit/2cccea51ff20ddcbdb23ef4b354e1dcd86eabdd1) validates this without rerunning Kiwi 200K or doing fake capped KO. The new result is **not yet verified** at the time of writing.

**Decision rule**: if geometry-free SRS reveals more real TSDs, improve template coverage before adding scores. If it still rarely finds two-lock full TSDs, prioritize **multi-piece formation of a constructive board state** under the same public NEXT5 and dynamic garbage information. Do NOT reward an unproved TSD setup as if it sent attack, and do NOT promote any new scorer until different fresh-seed full 2000-lock KO-first self-play and later pinned Kiwi improve at transparent CPU. PR #6 remains Draft, pinned Kiwi and main unchanged.
