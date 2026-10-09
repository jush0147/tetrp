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
| ROOK 6K vs pinned Kiwi 200K nodes | **0 勝、8 敗**；只有 4 個獨立 seed，各交換一次 slot；Kiwi 38–81 顆 KO。ROOK Sent APP 約 0.408，Kiwi 約 0.840。 | 需要巨大改善；兩者 nodes/evals 單位不同，非等 CPU。 https://github.com/jush0147/tetrp/actions/runs/37876960250 |
| 提高「未來 SRS+ 探測」9 → 24，非整體 maxNodes | 4:4（4 個獨立 seed 各交換 slot）；實驗搜尋耗時約 +67%。 | **不能**據此推論加大 ROOK 整體搜尋預算無效。 https://github.com/jush0147/tetrp/actions/runs/37886562562 |
| Focused Beam 保留 8 個根，其他空間給其深入分支 | 實驗 2:6，實驗耗時約 +13%。 | 舊 root-diverse beam 仍為預設；新策略不提升。 https://github.com/jush0147/tetrp/actions/runs/37899764227 |
| 攻擊送出 reward 權重 4.8 → 7.2 | 4:4；實驗 Sent 1582 vs baseline 1650。 | 不提高預設 4.8；不再隨意亂調單一權重。 https://github.com/jush0147/tetrp/actions/runs/37924464189 |
| Hold 後沿用最初已搜索的合法第一手 | 4:4；搜尋耗時 1,249,219ms vs 1,650,970ms，約 **省 24.3%**；1446/1446 預定步通過權威驗證，0 拒絕。Baseline 1548 次 Hold 重搜中 196 次（12.7%）選了不同一步。 | 有**效率收益**，目前**沒有強度證據**；保留 opt-in，並非已升級預設。 https://github.com/jush0147/tetrp/actions/runs/37933085621 |
| 相同公開盤面的 Kiwi vs ROOK 決策診斷 | 22 個抽樣，8 次同手，5 次 Kiwi 落點已在候選但沒選，5 次 Kiwi Hold 而 ROOK 不選，4 次 ROOK Hold 而 Kiwi 不選；根候選未觀測到 SRS+ 漏招。 | 原始抽樣少，不能推論所有局面；要進一步拆解分數與搜尋深度。 https://github.com/jush0147/tetrp/actions/runs/37886668563 |

**特別注意**：交換 slot 的兩場仍是高度相關的相同 seed，不能把 8 場當 8 個獨立樣本。固定種子用於迴歸測試，正式驗收要增加之前未調參的獨立 seed。

## 2. 下一階段：優先順序與決策關卡

### P0 — 先測 ROOK「算力換強度」曲線（第一個要實作的工作）

- **禁止把 6K 當最終上限**。先用同一批只含公開資訊的局面做 6K、12K、24K、48K evaluations 的預算擴張，若有收益與資源則再試 96K／更高。這是 ROOK 自身 maxNodes，不是 Kiwi 的 200K node；兩者不可直接比數字。
- 先補齊**獨立預算**的比較工具：目前 scripts/rook-vs-rook.js 的 ROOK_NODES 同時套用實驗組及基線組，**不能**直接用它驗證 48K vs 6K。要讓兩個 slot 能指定不同預算（如 candidate 48K vs baseline 6K），並保留相同 seed、slot-swap、共同 clock、同樣公開資訊與權威落點驗證。舊 scripts/rook-vs-kiwi.js 已可用 ROOK_NODES 調整 ROOK，自 Kiwi 固定 KIWI_NODES=200000。
- 在既有公開局面上先做**無 KO 聲稱的剖析**：每次實際 evaluated 數、可行根候選數、各層 beam 的 unique root 數、best action 是否改變、effective depth、搜尋耗時（平均／中位／P95）、記憶體／CPU 增幅、Sent/Generated APP。先確認增加 maxNodes **真的擴大有效搜尋**。如果到 6K 其實就不再用滿預算，擴大數值沒有意義。
- 先用 4 個互不相同的 seed、各交換 slot 做預試的**真 KO 對照**，2000 鎖上限。不因單次 4:4 就下結論；有改善跡象才擴到至少 16–32 個獨立 seed，之後保留新 seed 作 confirmatory 測試。
- 區分搜索配額擴張與搜索架構：固定 4-ply / beamWidth 24 時，若 maxNodes 增加後 best action、實際 evaluated 或 attack 幾乎不變，應改測 beamWidth / horizon / candidate allocation 和 transposition 效率，而不是只加大上限。
- **輸出決策**：算力提升是否能換來真 KO 勝率、持續攻擊與存活品質的上升？優先尋找 ROOK 的「離線強度上限」；即時運行先不綁死 400ms。

### P1 — 找出 ROOK 評估／規劃的結構性盲點

- 利用已提交的 src/analysis/rook.js 之 traceRootScores / explainBoardEvaluation，以及 scripts/rook-choice-diagnostics.js，對 Kiwi 和 ROOK 在**同一可見局面**的候選比較：即時 generated/sent/cancelled、累計 reward、終點 board score、holes、covered、高度、Tetris 建槽、T-spots、B2B、combo 和風險。
- 新版對照會輸出公開的當局觀察資料供重播，且只許 NEXT5；新 root-score workflow 的**最終報表目前尚未確認完成**，恢復工作時先查最新 Actions status 和 error，再做數據解讀。
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

## 3. 下一次直接要做的事情（優先照順序）

1. 檢查最新 branch、Issue #8、PR #6 和 root-score CI：
   https://github.com/jush0147/tetrp/actions/workflows/rook-choice-diagnostics.yml
   確認通過且讀取公開局面及分數拆解報表；若失敗先修 CI/邊界測試。
2. 實作 scripts/rook-vs-rook.js「候選／基線獨立 ROOK_NODES」與獨立策略選項的可重現配對 KO 接口，附驗證其採用不同 budget 的測試（不可改 baseline 默認值）。
3. 建立 **ROOK budget response** workflow：先 6K / 12K / 24K / 48K 公開局面 profiling，回報使用率與延遲；再挑有效 budget 做完整 4 seed x swapped KO 試點，Kiwi 固定 200K 作外部基準。
4. 看到成績才決定擴大到 96K、優化 beam/depth 或開始修 value model；不能直接宣稱大預算比較強。
5. 每輪把 commit、實驗 seed、KO/result、CPU、採納/否決決策寫回**本文件 + Issue #8**；PR #6 維持 Draft，達到強度與規則驗收再討論合併 main。

## 4. 技術入口與現有預設

- Core search：src/analysis/rook.js；chooseMove 默認 depth=4、beamWidth=24、futureReachableProbes=9，通用 maxNodes 默認 8000，但**目前對戰腳本預設實驗 budget = 6000**。不要混淆函式預設與 benchmark 預設。
- Kiwi 同 seed 完整 KO：scripts/rook-vs-kiwi.js；環境變數 ROOK_NODES、KIWI_NODES、SEEDS、MAX_LOCKS；預設 6000 ROOK eval / 200000 Kiwi nodes / 2000 lock cap。
- ROOK 自我 A/B：scripts/rook-vs-rook.js；目前 ROOK_NODES 是**雙方相同** budget，EXPERT_* 僅控制特定實驗 side；要跑 48K vs 6K 前必須先加分側 budget。
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

> 目前交接結論：**不要再迷信 6000 evaluations 是不可突破的限制。下一步先實作預算分側及規模效益研究；root-score 診斷作為平行證據；有強度趨勢才優化效能。**


## 2026-10-09 P0 實作紀錄：獨立候選／基線搜尋預算

- `scripts/rook-vs-rook.js` 已新增環境變數
  `ROOK_CANDIDATE_NODES`、`ROOK_BASELINE_NODES`，均預設
  fallback `ROOK_NODES`（舊版同一 budget 的 workflow 不變）。
  搜尋呼叫前按該 side 選取 maxNodes；swap 後 budget **跟
  Bot 身份走，不跟 slot 走**。每局 JSON 另顯
  `candidateNodeBudget`、`baselineNodeBudget`、
  `budgetsByKind`、`slots[].configuredNodeBudget`、
  `searches`、`budgetReached`、`deepestPly`。
- 此處只是 benchmark 設施，不是已證實 48K 比 6K 強；
  `nodeBudget` 舊欄仍代表 `ROOK_NODES` fallback，
  **預算不等時以 candidate/baseline 欄為準**。
- 下一步：跑相同公開盤面 6K/12K/24K/48K 的
  actual evaluations／best action／depth／ms profile，
  再做不同 budget 的同 seed/slot-swap 完整 KO。
