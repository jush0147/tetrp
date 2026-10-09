# ROOK：完整對戰優先的技術策略與驗收契約

版本：2026-10-09。狀態：**重新確定研發方向；這是設計／稽核，不是已完成功能的聲明**。
GitHub Draft PR #6：<https://github.com/jush0147/tetrp/pull/6>。
早期反向建槽研究保留在 `docs/ROOK_REVERSE_ATTACK_PLANNER.md` 與 Issue #7，
但**不是接下來的主路線**。日後上下文遺失，**先讀這份文件**。

## 唯一最終目標

在相同的 Tetrp TL 現代規則、公平的玩家可見資訊、可比較的計算資源下，
**整局的 KO 勝率超越目前固定版本 Kiwi**。不是解出幾個 T-Spin Puzzle，
不是堆出 20 TSD、單場 APP 最高或讓某個 seed 好看。

使用者的準則：**高 APP 不必然是強 Bot，但強 Bot 必須有持續且足夠的攻擊產能。**
必須追蹤真正 sent APP、generated APP、garbage cancelled、
對手壓力下的存活與實際 KO；不能只提高 Full TSD 次數。

不要要求「每個 Bag 一顆 T 就要一個 TSD」：
20 TSD 是極限建構挑戰，實戰需要根據局面選擇 Full TSS／TSD／TST、
T-Mini、其他 All-mini、Tetris、PC、Combo、維持 B2B 或引發 Surge、
downstack、Hold、清空危險垃圾及整理堆疊。可以為了後續更好攻勢
**放棄當下 T-Spin 機會**，也可以在合理情況不把 T 用於 Spin。
**可持續的決策品質 > 任何一種攻擊花式。**

使用者對執行方式的更正：**SRS+ 合法且可達的最終位置即可直接鎖定**，
不要求 24 frame 內真的完成按鍵序列。24 frame / piece 僅供雙方相同
2.5 PPS 的垃圾、ARE 與 attack multiplier 對戰時鐘，不是輸入操作上限。
這項規則已由 `BotDemo({placementMode:'atomic'})` 的權威驗證實作。

## 不要把三種不同能力混為一談

1. **規則與狀態模擬 (world model)**：某個落點合法嗎？Full 或 Mini？
   這次 TSD 實際送多少？B2B/Combo/Surge/All Clear/垃圾抵銷之後會怎樣？
   24-frame 戰場時間推進後狀態是否一致？這一層要與 Tetrp 權威引擎比對，
   不能靠通過少數 fixture 便聲稱完整。
2. **落點產生／搜尋 (action generator + search)**：所有七種方塊在
   SRS+ 下有哪些真正可達位置？包括 Full TSS/TSD/TST、T-Mini、
   All-mini 及普通消行、未消行；Hold 分支與 NEXT5 公開順序；
   不是只列出 Hard Drop，也不是只針對特定 T-Slot。
   每個候選需要實際可達的正向 witness，且最終落子由權威引擎處理。
3. **完整對戰決策 (policy/value)**：應該打哪個 Spin、何時保 B2B、
   何時用 Surge、何時挖垃圾、怎樣保持下一個 T 有效、何時降低堆高？
   能找到一條 TSD 路線，不代表它值得走。決策應比較**整條進攻＋防守
   軌跡的預期價值**，不是只比較本手是否消兩行。

## 實際程式覆蓋稽核（2026-10-09，勿將勾選誤解為世界級）

| 能力 | 當前驗證情況 | 重要不足／證據 |
| --- | --- | --- |
| 七塊 SRS+、末次旋轉 Spin、合法直接鎖定 | **已接上真實權威；部分 fixture 驗證** | `src/analysis/rook.js:enumerateReachable`, `src/analysis/demo.js`；BFS 有 maxStates / maxSteps，上限可能漏掉合法路徑 |
| Current／Hold／NEXT5 可見資訊 | **根節點契約有測試** | `visible-state.js`、`rook-session.js`；Hold 必須獨立交給引擎並取得新的公開 NEXT，不能假設未知牌 |
| Full TSS/TSD/TST vs T-Mini、Z/L/S/J/I 等 All-mini | **引擎可判；搜尋不完整** | `rotation.js` 與 `spins.json`；`rook.js` 後續 ply 主要使用 `forecastHardDrops`；僅少量 `forecastSpinClears`，不能稱全局 Spin 搜尋；O-spin 實戰證據欠缺 |
| TSD、B2B、Combo、Surge、All Clear、垃圾抵銷基礎計算 | **單次 hypothetical lock 呼叫官方結算；差異測試涵蓋部分情境** | `rook-combat.js` 呼叫 `attack.js:resolveAttack()`；假想多步未完整模擬 ARE／時間／來襲事件，不可稱完整整局模型 |
| B2B 延續／主動斷鏈換 Surge | **可計算本手效果，沒有成形的長程策略** | 葉節點只給小額 btb/Combo 分數；缺完整攻勢節奏及 burst/damage 評估 |
| 普通堆疊、Tetris 與攻擊 | **已有前向 beam 與表面評分** | `surface/evaluateBoard` 權重高度依賴井、洞、粗糙度，偏 Tetris；過度平滑可能淘汰有價值的 Spin 支撐 |
| Hold 與已知未來六塊 | **Root/部分 lookahead 有** | 需檢驗空 Hold 轉移、未知 Next、保留 T 的長期機會成本；不能推想第七顆 |
| 受垃圾壓力的 downstack、topout／復原 | **只有粗略 penalty 與局部恢復實驗** | `rook-recovery.js`；`pending` 隨 search ply 大多只靠抵銷變化，並非真正每 24f 正向推進、入場／抬盤 |
| 對手策略與 KO | **真實兩人對戰腳本存在，Bot 策略無完整對手模型** | `scripts/rook-vs-rook.js`, `scripts/rook-vs-kiwi.js`；絕不可讀對手未來，但允許明確定義的公開對戰資訊 |
| 高 APP、高勝率的通用策略 | **尚未達成** | 當前版本在相同 seed 常見約 0.5 solo APP，曾經對 Kiwi 0-4；不能靠單一開局 test 修成世界級 |

上表說「權威正確」是 **Engine 承擔最終落子／攻擊**，
不代表 `chooseMove` 的假想未來完全等價於引擎。
`forecastHardDrops` 多數未來 ply 不含旋入、踢牆、下移；
這是目前最值得先補的系統性不足之一。

### 已量測的反證（需保留）

- 早期使用 TSD 專家的兩組 120 顆自然種子：
  TSD `0/240`，合計 120 攻擊（約 0.5 APP）。
- 空盤 exact-cover TSD 專家確實能讓選定的七袋開局前六顆產生
  24 行攻擊／72 顆、6 次 TSD（原版 0）；但完整 seed 1 的
  120 顆從 `64 attack/0.533 APP` 降為 `61 attack/0.508 APP`。
- 真正 ROOK baseline vs 開局專家，2 場已判 KO
  **baseline 2 : opener 0**、另兩場 capped 不能算勝；
  <https://github.com/jush0147/tetrp/actions/runs/37869509642>。
- 回收垃圾的不同小型 KO 實驗，8 場有 6 場判勝負：
  **baseline 3 : recovery 3**、2 場 capped；
  <https://github.com/jush0147/tetrp/actions/runs/37869537566>。
  沒有可推廣的強度優勢。
- ROOK vs pinned Kiwi 既有 4 場 scored **0 : 4**，
  注意 6k ROOK eval 與 200k Kiwi nodes **不是同等算力**。
  本文不推定本次最新 ROOK 版本的 Kiwi 勝率。

**解讀：** 有效生成局部攻擊的能力可以上升，但若後續盤面、
抵銷、surge/damage、存活及機會成本變差，KO 就可能下降。
開局 TSD／Perfect Clear／垃圾復原均應是輔助候選，
不再主導整個專案。

## 新主線：先建「所有合法行為」與可信的全局搜尋，再談技巧專家

### P0：規則／可見狀態的正向模型同一化（第一個工程門檻）

- 定義 `ROOK state = board, current, hold+lock, NEXT5, btb, combo,
  public incoming packets with activation timestamps, time,
  public rule profile`。對手隱藏未來、隱藏垃圾洞與 bag RNG 不屬於輸入。
- 把一手放置＋消行＋攻擊＋垃圾時間推進、Hold 揭露、
  ARE／topout／clutch 等做成**受測的權威投影**。
  以 engine 實際 rollout 差異測試：給定合法 witness 時，
  board、下一顆（只比較已知者）、B2B、Combo、sent/cancelled、
  public pending、KO 都必須一致。未知隨機到來者不可假設已知。
- 建立規則矩陣：Full TSS、TSD、TST、Mini Single/Double、
  All-mini 的多方塊、Quad、PC、Combo、B2B 延續／斷鏈 Surge、
  garbage blocking / Hardened / ARE、垃圾挖掘、Hold 與 topped-out。
  每個功能要有**全局決策受影響的測試**，不只引擎本身有實作。
- 對垃圾：**不要看見即將到的 garbage 就自動取消 T-spin 計畫**。
  真正需判斷的是該路線在已知時間／來襲條件下是否仍可達及有利。
  可做機率／保守 rollout，但不得偷看隱藏洞。

### P1：全方塊、全已知時間視窗的搜尋（核心性能修復）

- 建出可重用且高效的 SRS+ 合法落點列舉器，涵蓋七塊在所有
  已知 NEXT ply 的 Full、Mini、普通 Hard Drop、Tuck／Kick；
  每個候選保留 witness，並用 `Engine` 差異測試。
  不再用「未來大部分只是 Hard Drop」當無限期的核心策略。
- 用 bounded beam/beam+quiescence 與 transposition table 搜
  完整公開 `Current + NEXT5`（必要時有限選擇性加深）。
  依可達消行、垃圾風險、局面複雜度分配算力；
  在固定 wall-clock／memory budget 下量測品質，不偷偷增加算力。
- Hold 是合法且可能改善整條序列的 **選擇**，不是拿 T
  就必須做 TSD。未知 post-Hold 預覽須於真正 Hold 後重算。
- 反向 TSD/PC 專家只能提供根候選 **不保證採用**；
  必須在統一的前向戰鬥價值評分中競爭。

### P2：從「形狀漂亮」改成「未來攻防能力」的策略價值

一次決策可考慮：
`sent攻擊 + cancelled防禦 + 有效爆發節奏 + B2B/Surge選擇權
 + 可用T/其他piece的未來攻擊效率 - 生存/堆高風險
 - 被掩蓋垃圾的下挖成本 - 轉型成本 - 計算負擔`。

**不是立即手動給 TSD 特權**。價值必須取決於完整分支的預期
攻擊／存活，最後以 KO 做評價。

至少並行留存四種策略性根候選：
正常高效堆疊、現成 Spin／短期攻擊、堆高受限與 downstack、
長期建構型候選。用共同的戰鬥回報排序；
不讓高 Beam 表面分數完全壟斷候選，也不預先塞固定 T-Slot
或開局路線。針對已知輸入內的 future combo/B2B/surge，
以實際模擬和落點可達性證明計分。

### P3：訓練／調參，但禁止只用自己的弱招當老師

有足夠的權威 rollout 與多種局面採樣後，
可用自我對戰、對手多樣化池、自動權重搜尋或
policy/value 網路學葉節點價值。目標是提高
*匹配對手與新種子上的 KO*，不是模仿 0.5 APP 的舊 ROOK。
不要直接複製 Kiwi 的權重／內部搜尋；Kiwi 是外部競爭基準。

### P4：每個階段必須通過的強度門檻

1. **合法性**：所有提交落點都有 SRS+ witness，
   真引擎鎖定／Full/Mini 判定與 forward model 一致，
   私有資訊隔離測試永遠通過。
2. **產能**：跨非挑選種子記錄 generated APP、sent APP、
   TSS/TSD/TST/Mini/Quad、PC、Combo、B2B/Surge 與垃圾挖掘。
   「TSD 多了但 APP 掉了」不可稱提升。
3. **生存**：峰值高度、被蓋洞、有效垃圾解除速度、
   capped/不合法局／真正 KO 分開呈現。
4. **計算公平**：兩邊相同公開資訊、24f 時鐘、
   固定 seed 與先後交換、候選節點數**外加 CPU 實測**。
   不要把 Kiwi 的 nodes 和 ROOK evals 直接當同一個單位；
   優先使用可比較的每決策 wall-clock budget。
5. **整局 KO**：先對上一版 ROOK 多 seed / swapped slots
   持續取得有意義的勝率，再在多 seed / swapped slots 與
   固定 Kiwi 做真實 KO。未決定的 capped 不算勝。
   最終目標是對 Kiwi **有統計支持、可重複的超過 50% KO 勝率**，
   且在合理算力下維持高攻擊產能；單次 1 勝絕不是終點。

## 開發流程與停損

**優先工程工作**：規則 parity 表與前向 transition、
可重用高效 SRS+ 所有方塊／未來 plies 的搜尋，
再做統一戰鬥價值與自動調參。**停止新增另一個
「某某特殊招式 Expert」來代替這些基礎能力。**

所有分支功能要有 A/B：同 seed、同公開資訊、
攻擊＋KO＋CPU＋場景分布。不能因為某個 fixture
有一個漂亮 TSD 就標記成「更強」。

此文件取代「下一個任務是再造 TSD 建槽、TSD→PC 專家」
作為整個專案的主優先順序。保留所有既有研究程式和回歸測試，
但維持 optional flag OFF，直到公平完整 KO 試驗有正向結果。

## 下次交接

先讀本文件，再讀 `docs/ROOK_INFORMATION_CONTRACT.md`，
查看最新 `feat/rook-independent-bot` SHA、PR #6 與 Issues；
尤其是 `rook.js` 的 `forecastHardDrops`、
`rook-combat.js` 的非時間序列 transition、
`rook-session.js` 的 Hold 可見邊界和
`scripts/rook-vs-kiwi.js` 的真實同場 KO 評測。
**不要把這份待辦文件誤說成已完成的核心升級。**


## 2026-10-09 延續實作：前向時鐘與未知垃圾情境（尚未完成 P0/P1）

- `src/analysis/rook.js`: public NEXT future plies 有限額分配 SRS+ 正向
  `enumerateReachable`，不限 T 或 Spin。仍採 Hard Drop 備援，**並非完全枚舉**。
  `tsdTacticalProbes` 預設 0，特定戰術須主動 opt-in。
- `src/analysis/rook-combat.js`: 每次假想鎖定前按 atomic battle cadence
  推進 24 frame，依公開 `activeFrame` 啟動已知 packets，
  依引擎次序計算 garbage multiplier；`projectCombat` 仍呼叫官方
  `resolveAttack`，並回傳 blocking。預測入場量不讀取隱藏洞。
- `src/analysis/rook.js`: 當鎖定會引發未得知洞位的 tank 時，
  目前將該搜尋分支標記為 `unresolvedGarbage` 並停止假想後續。
  **這是防止錯誤規則模擬的保護，不是合理的最終對戰策略**；
  垃圾可能成為挖掘／反擊機會，絕不可永久將其當成失敗或
  自動放棄 T-Spin。
- `src/analysis/rook-garbage.js`: 新增不讀取隱藏 RNG 的「**條件式**
  垃圾情境列舉」。給一個或兩個可入場 packet，列出所有可能
  hole-column 組合，條件盤面由 Tetrp 的 `tank` 和 `pushLine`
  運算，能核對真實權威在該洞位的盤面／封包變化。多 packet 情境
  超出計算上限會明確報錯，不假裝完整；目前**尚未接入通用 beam
  的 belief-state value**，所以不是勝率提升。
- `test/rook-clock.test.js`、`test/rook-garbage.test.js`、
  `test/rook-future-reachable.test.js`：公開資訊、24f/倍數與
  packet activation、single-lock 對戰結算、隱藏洞位的
  conditional authority parity、future-ply 预算與 ablation。

下一個必要步驟：讓 beam 對**每個公開資訊相容的垃圾情境**評估，
而非假設某個隱藏洞位；依真實權威做多 lock 的
board/attack/clock/packet differential rollouts，然後再比較
同 seed / swapped KO 與 CPU。ARE／continuous garbage、
高情境數的預算裁剪、多包垃圾的 belief 權重尚未完整驗收。
**不要把目前的 rollout cutoff 說成已完成垃圾攻防。**


### 下一個實作增量：垃圾的條件式 NEXT 再規劃（實驗旗標，未通過強度驗收）

- `src/analysis/rook-belief.js`: `evaluatePublicTankBelief` 對公開資訊
  相容的所有洞位情境取加權平均與最差情況，`beliefRiskWeight`
  設定風險折衷，輸出 `topoutProbability`。目前以列舉洞位等權
  作為未知道路的**模型假設**，並未知道權威隱藏 RNG。
- `src/analysis/rook.js`: `garbageBelief: true` 時，對有限數量的
  `unresolvedGarbage` beam 候選，依每個可能洞位重新列舉公開
  NEXT 落點、評估下一手的最佳權威攻擊投影和盤面。
  這是**一層 conditional replanning**，不是多回合完整 belief
  tree；高維情境超預算會明確記錄 `beliefOverBudget` 並回退。
  `beliefAttempts`、`beliefEvaluations`、`beliefOutcomes`
  可用於追查實際花費。為免在沒有 KO 證據時降低已知 baseline，
  **正式預設仍為 `garbageBelief:false`**。
- `test/rook-belief.test.js`: 檢查所有洞位權重、風險取值、
  無隱藏資訊的決策一致性、原始 checkpoint 不變，以及 Tetrp
  root placement 證明。已納入 ROOK CI。
- `scripts/rook-vs-rook.js` 新增 `EXPERT_BELIEF=1`，
  配合 `EXPERT_OPEN=0 EXPERT_RECOVERY=0` 可讓對戰雙方
  只差 belief 旗標。另有 `.github/workflows/rook-belief-ablation.yml`
  的同種子交換先後、短場 KO smoke；capped 場不列勝。
- 此搜尋的局限：二次進場的 packet 隱藏洞位關聯、累積
  opponent pressure、不同隱藏後續、multi-packet > 預算、
  有 ARE 的完整 state transition、root 排序穩定性與
  同量 wall-clock CPU 均未解。不可稱已擊敗 Kiwi。


## 2026-10-09 整局 KO 驗收契約修正：雙方同 seed、同步鎖定、打到有結果

**使用者指示：禁止把 8／24 顆 capped smoke 當強度證據。**
要正式比較 Bot 強度，每場雙方使用**完全相同的初始 seven-bag seed**，
在各自真實、公開的盤面資訊下做決策，兩邊都提出合法 placement 後，
由 Tetrp atomic authority 同時推進相同的 24-frame 戰場時間。
實作採先準備雙方動作、再依序提交至彼此隔離的引擎、
**最後**才交換本回合產生的垃圾封包，因此一方不能偷看到對手本回合落點。
在提交前後都檢查兩個引擎的 frame 相同；Hold 仍需由權威獨立執行。

一個 seed 是一場**雙方同 seed**的比賽，不再以 `SEED_A`/
`SEED_B` 當作兩名玩家不同的方塊序列。
`SEEDS` 或 `SEED_A,SEED_B` 表示**多個獨立對照 seed**；
每個 seed 都會交換雙方 slot 再打一場。
Hold 與實際垃圾／消行會使雙方後續可見序列與盤面分歧，這是正常的實戰結果。

- `scripts/rook-ko-protocol.js`：共享的 seed 列表、同一 frame
  與初始 NEXT5 驗證、KO／double-KO／capped／invalid 分類。
- `scripts/rook-vs-rook.js`：預設每場**最多 2000 次雙方同步鎖定**；
  ROOK opener、recovery、belief 實驗和 baseline 都使用同一協議。
- `scripts/rook-vs-kiwi.js`：預設 2000，正式 Kiwi workflow 同樣設定
  **2000 次雙方同步鎖定上限**，兩邊初始 seed 一致，並交換先後位置。
  Kiwi 與 ROOK 的 node 計量不等價，仍需看每決策 CPU。
- 計分**優先於 cap**：即使恰好最後一回合發生單方 KO，
  仍算有效 KO；雙方同時陣亡只算 `double-KO`；
  截止仍未分勝負為 `capped`，絕不給任一方虛構勝利。
- `test/rook-ko-protocol.test.js` 驗證上述重點，包括在安全
  上限當回合的 KO。配對 workflow 驗證兩名玩家 piece count
  和公開 clock 一致、不讓 2 場同 seed 的 slot swap 漏跑。
- `rook-belief-ablation.yml` 用 2000 鎖；`rook-selfplay.yml`
  和 `rook-recovery-ko.yml` 用 400 鎖；
  `rook-ko.yml` 以 4 個不同 seed（每場雙方相同 seed、交換位置）
  各自打到 KO 或 2000 鎖。以前的小 smoke 不能聲稱強度驗收。

仍需保留 `scoredKO`、`capped`、`doubleKO`、generated/sent APP、
收到/抵銷/坦掉的垃圾、KO 原因、CPU／牆上時間等。**沒有 KO 時，
結論是尚無勝率證據，不是勝率 50% 或實驗通過。**
最後判強度仍須大量不同 seed、swap 和算力比較，不能單次 KO 就升級。

### 2000 鎖 KO-first 正式安全上限（同日使用者更正）

所有 ROOK vs ROOK／Kiwi 正式強度對局統一每名 Bot 最多 **2000 次鎖定**；
這是防止極端弱對局永無結果的安全閥，**不是實驗預定長度**。
雙方繼續同步出牌直到單方 KO、double-KO 或達 2000 鎖上限。
即使在第 2000 次雙方落子當回合出現單方 KO，也算正式勝利。
只有仍都存活時才是 `capped`；沒有 KO 的 capped 不得算勝率分母。

`rook-ko-protocol.js` 共用 `DEFAULT_KO_LOCK_CAP=2000`；
`rook-vs-rook.js` 已移除原本 `limit>1000` 的硬性拒絕，
兩支對戰腳本允許最高 10000 鎖以便單獨做極限實驗。
四套 KO CI 工作流程設定 `MAX_LOCKS=2000` 並將每個 match job
的 wall-clock timeout 提高到 330 分鐘（GitHub Actions 仍可能受服務
本身的資源／配額限制）。**CI job 因時間／外部資源中止，不算 capped
或 KO**，需明確標記為未完成，不能選勝方。


## 2026-10-09：以 Kiwi 同局面決策差異決定下一步（診斷中）

放棄「再塞一個招式 expert」的開發模式；第一次明確量測
**ROOK 是看不到較好的落點，還是看到了卻選錯**。

- `src/analysis/rook-disagreement.js`：在**相同公開盤面**比對
  Kiwi 經 Tetrp 權威驗證的第一個合法動作與 ROOK 根候選。
  Identity 包括相同 piece、四格座標、Full/Mini/None 的旋轉判定；
  Hold 另外作為獨立動作，不偽裝成已揭露的下一顆方塊。
- `scripts/rook-choice-diagnostics.js`：在相同 `visibleState` 分別
  呼叫 Kiwi 與 ROOK，並用 ROOK 的 `enumerateReachable`
  在一般 BFS 預算與擴大 4 倍預算下檢查 Kiwi 的實際落點。
  分類是 `agreement`、`root-bfs-budget-miss`、
  `root-reachability-gap`、`generated-but-not-ranked`、
  `ranked-but-not-selected`，以及 Hold 的專用類別。
  擴大 BFS 仍是有界搜尋，**未找到絕不等於違反 SRS+ 規則**。
- `scripts/rook-vs-kiwi.js` 的 `ROOK_DIAG=1`：
  在真實、雙方同步的整局對戰中，依固定的回合（預設
  0/4/8/12/20/30），對雙方各自當下的公開局面做 Kiwi vs ROOK
  決策比對。**絕不把其中一名玩家的盤面誤當成對手盤面**，
  也不傳送 authority 的私有 bag／garbage hole／checkpoint。
  抽樣不縮短 2000 鎖的正式 KO 安全上限。
- `.github/workflows/rook-choice-diagnostics.yml`：固定 seed
  67020、67023，Kiwi 200000 node、ROOK 6000 eval 的
  現況診斷，儲存每次差異、耗時、幾何覆蓋、Kiwi 候選 index
  和分類總表。此非算力等價實驗，也不是新 KO 強度實驗。
- `test/rook-disagreement.test.js`：動作同一性、不同 spin、
  真正搜索缺口 vs 根候選被剪 vs 已看見但未採用、Hold 契約。

解讀原則：`root-bfs-budget-miss` 優先改善 reachability 預算與
搜尋品質；`generated-but-not-ranked` 優先審查候選剪枝與
maxNodes；`ranked-but-not-selected` 優先用權威多步收益與
盤面風險檢查評估函數。**此分類只能指向研發假說，不直接證明
Kiwi 該手在長期一定更好**；尤其 ROOK 的 ranked 清單不同 ply
不一定是嚴格同分值排序。最後仍需配對 KO／sent APP／CPU 實測。
