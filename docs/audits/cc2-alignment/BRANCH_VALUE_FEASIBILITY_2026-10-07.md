# 分支續局到新評分：端到端可行性決定

本輪授權是設計，不是派送實驗。沒有修改 bot、訓練、開 arena 或 workflow。

## 決定

**不啟動上一則提議的小批固定 root A/B KO 續局。** 這種工程已存在，而且以前的複驗未建立穩定方向；新增少量相同資料不會自行補上 search leaf 的學習契約。上一則建議未先核對這段歷史，是提議的疏漏。

分支續局在技術上可行。它最直接支援的是「root action value／根候選重新排序」，不是原定的「替代搜尋 leaf evaluator」。若採這條路，需要明確同意改接入點及資料預算，不能在製作 trace 時默默換方向。目前不建議支出這筆新對戰成本，也沒有把其他實驗排為自動下一步。

## 1. 已有實作與反證

- `scripts/kiwi-arena-core.js::match` 已有 `startCheckpoint`，以及 delivery 後、兩邊決策前的 `onBoundary`。無須重造 arena。
- restore 要求雙方 ready、subframe=0、仍存活、同 frame、cadence 邊界及空 outbox。任意 anchor 並不等於此邊界：anchor 可能尚有在途 delivery。必須重播到 boundary 或完整保存 delivery，不能只複製兩個 anchor state 就宣稱正確。
- 現有 `scripts/kiwi-root-ko.js` 及 `test/kiwi-root-ko.test.js` 已處理指定第一手、續打與鏡像檢查。本輪只讀 source，沒有重新執行這些測試。
- [原 pilot](../kiwi-root-ko/RESULT.md)：24 matches，3 roots × 2 synthetic futures × A/B × mirror。
- [複驗](../kiwi-root-ko/REPLICATION_RESULT.md)：48 matches，3 roots × 4 新 futures × A/B × mirror，沒有重現穩定方向。mirror 不是獨立樣本。那時 A/B 是 Native／Legacy 的固定第一手，後續雙方都是 Legacy，不能冒稱目前 aligned CC2 的實驗。

以前使用 IID synthetic tail，不是完整 SevenBag 條件分布。本次不可沿用這個替換方式再稱「真實 TL 分布」。以前失敗也不證明所有 action-value 學習不可能；它否定的是再做同規模校準就能可靠產生標籤的期待。

## 2. 若重啟，唯一直接接得上的完整路徑

```text
公開 root → 凍結 accepted 搜尋一次 → 固定 top 2 不同 action
                                 ↓
                 離線：同一私有雙方 boundary 分 A/B
                 指定 root action → 此後雙方 accepted 重分析至 KO
                                 ↓
                 (root, action, 當時搜尋摘要, outcome) 資料
                                 ↓
                 學 root action value，按來源 seed 分組驗證
                                 ↓
                 線上：原搜尋 → top 2 value 比較 → 提交新 top 1
                                 ↓
                 成本／authority parity → 全局 KO 比較
```

這是條件化到固定 continuation 的 `Q(公開 root, action; accepted, accepted)`，不是最優策略的 Q。部署後每手都重新排序會改變 continuation，必須用完整候選 bot 的 KO 驗證，不能把離線第一手效果直接外推為強度。

一次干預的意義是建立局部受控比較，不是宣稱一顆決定整局；兩分支後面都能打幾百顆且對手重新決策。一次 A 贏 B 輸只能記為一個樣本，不能把 A 命名為正確答案。同勝同負也保留，不能只挑有差異的 pairs。

### 輸入與接入點

- 可使用本次 PublicSnapshot、候選 action，以及這一次公開搜尋已計算的數值；禁止私有對手 board、原 replay winner、真實 hidden future、history／bag inference。
- 先限定 top 2，原因是控制動作覆蓋與離線成本，不是認為 rank 3 以後無用。這個範圍無法修好沒進 top 2 的好招。
- 已有 report 的候選 score 可作 baseline；它不是完整 leaf 或攻擊時序。若模型需要 best-chain／分數拆解，必須先證明輸出成本，不能假定免費。
- 不重啟已停止的 22-feature 模型。新模型特徵／形式目前沒有足夠證據定案；資料 schema 本身不代表已有可信的模型設計。
- 根重新排序在 policy 內完成，輸出自己的 rank 0。記錄原始搜尋 rank 與最終 policy rank，authority 僅驗證提交的 action；失敗即 technical failure，不能再換候選。
- Hold 是 standalone action；若指定 Hold，authority 執行後的 reanalysis 由凍結 continuation 處理，不預先鎖定未 reveal 的 landing。部署模型是否涵蓋 hold-locked request 必須與資料支持一致。

### 為何不能直接接 leaf

root A/B labels 只覆蓋經 authority 執行的 action 與後續 policy。CC2 模擬 leaf 沒有對手新 incoming，scenario 是假設，且路徑並非逐次 reveal 後的政策。不能把同一 root action 的終局 label 複製到它下面所有 leaf。

強迫執行六手計畫也不會自動解決：新垃圾可能改掉合法落點，empty Hold 會揭露新 piece，計畫可能提前失效。改為 replan 就變成另一個 continuation policy；不准 replan 則衡量開迴路計畫。必須定義完整方案，不能用 fallback 隱藏此差異。

因此這條 root reranking 路徑**不是** [zero-reward／leaf utility 契約](WIN_VALUE_SEARCH_CONTRACT_2026-10-06.md) 的實作；既有搜尋內部仍保留 accepted 評分。原 leaf 路線缺合格 F 的狀態沒有改變。

## 3. 離線公平性與資料規格

最小可辯護的取樣方式是使用既有真實 authority boundary 的原 hidden state，A/B 複製完全相同雙方 state 和在途交易邊界，不重新 seed 中途 bag，不讓 bot 讀私有資料。這給每個 root 一個實際 hidden context；跨許多獨立來源 seed 才涵蓋不確定性。同一 checkpoint 原樣重跑是重複，不是新 future 樣本。

原同 seed 雙方序列的關係要保留，不能因為兩邊抽取進度不同而把 queue 強行改成相同字串。若日後需要同一公開 root 多個有效 SevenBag futures，須另外定義條件抽樣器；本輪不新增這項研究工程。

資料每列至少包含 source group、root hash、公開輸入 hash、候選來源與 action、accepted binary hash、實際 authority parity、終局及異常。source IDs、private checkpoint、對手私有資訊只能在 audit metadata，不能進模型。A/B、兩 seats、同源不同時點全部同 split；若模型用同一 hidden state 產生的訓練資料，不可把其 sibling 留給 holdout。

technical failure／watchdog 無 label，整對不得當有效配對。simultaneous KO 單獨記錄，不能硬貼 0 或 .5；固定 checkpoint 原樣 retry 可能永遠相同。若排除含 simultaneous 的 pair，只能報告條件化結果和排除率，不能聲稱無偏的實際 arena utility。

## 4. 成本帳與為何現在不開跑

本輪由既有 run37452163955 aggregate 的 200 筆 `wallMs` 重算：每場平均 **11.453 分鐘**、中位 **11.404 分鐘**、p95 **21.293 分鐘**；sum game wall time **38.178 小時**。這是該次 runner 併行環境的每場經過時間加總，不是 CPU 時間、計費 runner-hours，也不是新批次完成時間。

令獨立 roots 為 N、每 root 候選 2 個、各續局平均 t 分鐘：總 match elapsed workload 約 `2Nt`。下表僅按上次完整對局均值做尺度示例，不是已批准樣本數或完成時間承諾；中途續局可能較短，也可能分歧後更長。

| roots | A/B 續局 | 按舊均值加總的 game-hours |
|---:|---:|---:|
| 16 | 32 | 6.11 |
| 128 | 256 | 48.87 |
| 512 | 1024 | 195.47 |

並行可以降低 wall time，但不會增加統計資訊或消除這個總工作量。此處還沒計算候選蒐集、correctness、模型驗證及最終全局 KO 的成本。16 roots 只能查管線，不能當成足夠的強度或學習證據；512 也不是保證足夠的樣本量。需要的量取決於效果量、pair discordance、分布與模型複雜度，目前未知。

既有 root 工程已證明管線能運作；再花 32 續局重證一次，並不能回答新模型是否值得做。因此本次不以小 smoke 開始，亦不直接承諾 1024 場能學出更強 policy。

## 5. 若未來採用，停止條件必須一次固定

1. 先凍結一個模型、所需輸入、訓練目標、來源分組、資料上限和成本上限。缺任何一項就不蒐集新 KO 資料。不得把「開始蒐集後再想模型」稱為端到端計畫。
2. 離線比較必須與 accepted root 排序比較，不只測能否猜原局勝負；以 held-out 配對結果估計選擇的 policy utility，按來源 seed 分組給不確定性。單筆 outcome 不是 oracle 最佳動作。離線過關也不等於全局變強。
3. 僅一個凍結候選做 correctness、paired wall-time／browser 檢查。200k nodes 不代表成本相同；不增加線上搜尋、仍須符合使用者不再變慢的限制。
4. 合格才另訂完整 KO 比較與一次性統計門檻；不自動 promotion、加資料、换 feature 或擴候選到 top K。離線或成本失敗就停止該候選。

目前第 1 點未滿足：尚無經理由支持的新模型／feature contract，root reranking 又超出原 leaf 替換的接入點。因此這份是**可行性審查與不啟動決定**，不是可直接 dispatch 的實驗規格。

## 6. 本次交付邊界

可重用 execution 已確認；資料能回答的問題、可接的位置、無法接 leaf 的原因、舊實驗及成本已串起來。结论是收回「接著再做小批 root 續局」這個建議，保留 accepted。沒有新強度證據，沒有待跑任務，也沒有聲稱原 evaluator 已被證明正確。
