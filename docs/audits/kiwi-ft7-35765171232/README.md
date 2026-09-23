# Native 0–7 decision audit

日期：2026-09-23。對象：[Actions run 35765171232](https://github.com/jush0147/tetrp/actions/runs/35765171232)，commit `e868148a597259cdb16227f22ffb7a8775cc6463`。

結論：這次 0–7 通過目前 placement-arena execution contract，可當作這組設定、種子與對手下的 strength evidence。所選 decision states 顯示 **search horizon／未知垃圾 frontier 與 leaf value 的交互作用**。已證實 geometry budget 能改變早期 Mini 選擇；尚未證實「已搜到後續 TSD，卻被 evaluator 排在 Mini 之後」。不能由這五個 state 推論全部敗局都由同一原因造成。

本次沒有修改 production policy、evaluator、weights 或 arena，沒有新增對戰。新增的是離線 observer、回歸測試與報告。

## 1. Correctness verdict

|檢查|結果|
|---|---|
|比分／結束條件|Native 0–7 Legacy；7 局全部實際 KO，Native 死因皆 garbage smash|
|Technical failures|0；每局雙方 failures 均為 null|
|Silent fallback|0；程式使用 strict top-1，沒有 candidate retry；所有 rank counters 為 0|
|Placement parity|712 / 712，100%|
|Hold parity|178 / 178，100%|
|Piece / x / y / rotation / cells / spin / lock frame / clear|712 次 commit 的聯合 invariant 全部通過|
|Unsupported rules / certificate failure|0；這些 rejection 走 technical-failure 路徑，會中止且不計分|
|Cadence|双方每 placement 24 frames，virtual lock 在 request frame +23、subframe 0.5|
|Seats／seeds|逐局交換 seat、重新 piece/hole seed|
|一般 frame cap|無；沒有 watchdog 結束或 simultaneous KO 計分|
|Source identity|artifact 的全部 sourceHashes 與本地 production source 相符|

原始 `result.json` 沒有每手完整 trace；不能宣稱原 run 已逐手保存所有證據。它保存 aggregate parity，對應程式在每次 commit 執行 fail-closed 聯合檢查，而非僅在賽後抽樣。Hold 也驗證 authority transition，再用 fresh snapshot 重新分析。

本次以相同版本／設定／seeds 重建第 1、3 局，**winner、reason、frames、KO、deathReasons、pieces、totals、parity、holds、decisions、sent、transportStats 全部與原 artifact 相同**，再保存公開 snapshots 與逐手 parity。下文 decision traces 是這次 deterministic reconstruction，並非原 Actions 留下的逐手紀錄。每個 snapshot 的原 top-1 又與加 observer 後的 production search 比對相同。這是 execution correctness，不是 compact search model 全語意正確的全面證明。

原始 manifest 副本：[run-result.json](run-result.json)。Native 356 placements、63 Holds；Legacy 356 placements、115 Holds。

|全 7 局合計|Native|Legacy|
|---|---:|---:|
|Generated|134|333|
|Cancelled|69|16|
|Newly sent|66|317|
|Tanked|228|42|
|Generated / placement|0.3764|0.9354|
|Newly sent / placement|0.1854|0.8904|

所以此 artifact 的 generated APP 不是 0.54；畫面中的數字可能使用不同統計窗口或定義。這裡不以 APP 判強弱。Opener defense 可以額外 cancel，因此 generated 不必等於 cancelled + sent。

## 2. 如何讀資料

五個 JSON 含完整 PublicSnapshot、所有 published ranked candidates（18／34／37／38／36 個）、各 candidate root action、逐手 continuation、逐 scenario attack transaction、L/U/H、B2B raw/count、Surge、combo、剪枝資訊、actual authority placement proof/provenance 與 lock result。

- [G1 F120](g1-f120.json)：早期 S Mini；[G1 F168](g1-f168.json)：其後斷 B2B 的 J double。
- [G1 F912](g1-f912.json)：後期 T Mini → 下一手取消 7 行的反例。
- [G3 F1032](g3-f1032.json)：J Mini；[G3 F1056](g3-f1056.json)：下一手 T single 斷 B2B。

`candidates[].immediatePlacement` 是第一個 placement 的 G/C/S 與 L/U/H；`leaf` 是 continuation 最後一步；`totalEvaluation` 是整條 trajectory 的 cumulative newly sent − leaf L − leaf U − leaf H。**不能將 immediate attack 與 leaf penalty 直接拼成總分。** `continuation[].immediate` 保留每個垃圾情境原值；摘要取等權平均。死亡 leaf 的 L/U/H 為 null，總分採死亡值，而不是假裝其 penalty 為零。

Standalone Hold 的 immediate attack 為 0、沒有 lock。Hold candidate 的 speculative held-piece placement 用於評分，JSON 有明確 caveat；不能把那一步誤稱為 Hold 自己造成的 clear。後續 continuation 的 `held` 表示該步先 Hold。Root place 的 `held` 為 null，因為 root 的 Hold 狀態已在 snapshot 中。

`btb` 為 authority raw counter；displayed `b2bCount = max(0, btb−1)`。`surgeCharge` 是 threshold/base 推出的未乘 multiplier charge，`surgeCharged` 為 raw btb 超過規則 threshold。這五組 top-1 trajectories raw btb 最高只有 2，**Surge 全程未充能、未釋放**，不能用這些案例評估 Surge 策略。

全部 state 都只把 PublicSnapshot 交給 search；NEXT 恰好 5。垃圾 holes 使用模型 scenario，不使用真實 hole RNG。重建環境知道 replay future，但沒有將它交给 policy。當手 transaction 與已執行結果的比對是事後檢查。

## 3. Search 實際限制

預設 beamWidth=32、geometryBudget=100000、nodeBudget=200000。這裡最容易誤讀的三點：

1. **每個 root 保留至少一條 branch**，再補到 beamWidth。所以 34／37／38 個 roots 時，beam 可以超過 32；不是「32 個 root 以外全部沒搜」。代價是每個 root 的 continuation 通常只剩一條。
2. 遇第一次 modeled garbage insertion／未知 activation reveal 就 terminal。已知 NEXT 還有多顆，也不再往下搜。`finite_visible` 不等於每個 root 都完成六手。
3. Geometry budget 在一層途中耗盡，整個 partial layer 不發布；已算出更高分的新節點也不參與最後排名。

|State|Reported completed depth|Top-1 有效 depth|原因|geometry states|Beam：input→kept|
|---|---:|---:|---|---:|---|
|G1 F120|2|2|geometry budget，partial depth 3 丟棄|100000|18→18；1279→32|
|G1 F168|3|2|Top-1 吃垃圾 frontier|9554|34→34；168→34；84→34|
|G1 F912|6|6|可見 horizon|2982|37→37；87→37；104→37；87→37；70→37；104→37|
|G3 F1032|3|3|吃垃圾 frontier|3000|47→38；81→38；63→38|
|G3 F1056|2|2|吃垃圾 frontier|2077|44→36；61→36|

完整 selected/dropped node IDs、TT hit／prune counts、partial-layer node IDs 在 JSON 的 `search`。TT 是 per-root/per-depth，不會把不同 root 的結果直接合併。各 JSON `alternatives.D` 另保留最高分的被剪節點；其後續未搜，不能當作「已證明更好的 setup」。

## 4. 五個實際 decision states

下表 G/C/S 是該步 generated / cancelled / newly sent；B 是 raw btb。座標是 repo 的 40-row board 座標，r=0/1/2/3。

### G1 F120：S Mini 的短 horizon 選擇

Top-1：S `(8,38,r2)` Mini Single，B 0→1、combo 0→1。Hold J locked；NEXT L,T,J,S,Z；pending 0。

|PV 步驟|G/C/S|L/U/H|B|Combo|trajectory score|
|---|---|---|---|---|---:|
|S Mini Single|0/0/0|1.4 / 0 / .20|0→1|0→1|−1.60|
|Hold J → normal Single|0/0/0|.8 / 0 / .05|1→0|1→2|−.85|

**短命 B2B 是已規劃的 continuation。** Rank 2 的 S normal Single → L Mini 葉分 −1.00；rank 3 的 S 不消行 → L Mini 葉分 −2.25。Top-1 在兩手終點因 H 較低勝過 rank 2，不是得到 Mini bonus。

- A：上述 S Mini branch。
- B：所有 legal root 的 immediate generated 均為 0，沒有 immediate high-attack alternative。
- C：partial depth 3 中找到維持 B2B 的 Mini continuation，但沒有 TSD 或 ≥4 attack。它尚未成為 published comparison。
- D：S 不消行的 root 5 **未被 beam 丟掉**；其第三手 T normal Double 可送 1 行、分數 +.75，已算出卻因 partial-layer discard 不採用。它在第二層只排第三。這是 horizon／budget failure 的直接證據，不是被 beam 完全漏掉。

離線只把 geometryBudget 改為 1000000，其他不變：實際用 383261 geometry states，完成六手，top-1 改為 S `(3,37,r0)` 不消行。PV：S0 → L Mini1 → T normal2 → J0 → Hold J0 → Z normal1；累計送 1，leaf L=.4/U=0/H=.05，score=+.55。仍包含取得後很快斷掉的 B2B，並未變成 TSD 路線。只證明選擇受 budget 影響，沒有證明 KO 勝率改善。

### G1 F168：斷 B2B 同時真正在防守

Top-1：J `(8,38,r2)` normal Double；Hold T locked；pending 4。

第一步 G/C/S=1/2/0，L/U/H=2/0/.2，B 1→0。**Generated 1、cancelled 2 是合法 opener defense。** 下一步 J0 吃剩下垃圾，frontier leaf 平均 L/U/H=2.4/.8/.8，score=−4.00。

Rank 2 是 J normal Single → T normal Single → S0，score=−8.65。保留 B2B 的 no-clear root 直接吃 4 行，平均 L/U/H=5.8/3.6/3.2，score=−12.60。

- A：這是早期 Mini chain 的實際 break 決策。
- B：Top-1 本身就是唯一有正 immediate attack 的 root。
- C：搜索範圍內沒有先維持 B2B 再高攻擊的 branch；保 B2B 分支先撞上垃圾 frontier。
- D：没有證據證明被剪 setup 更好。不能因為 break B2B 就判這手壞。

當手 authority 實際 transaction 同樣為 1/2/0，並收到新的 1 行；這個 incoming 不是先前 snapshot 可以預知的資訊。

### G1 F912：Mini 是 7-line cancellation 的入口

Top-1：T `(6,21,r0)` Mini Single；pending 7；Hold J locked。它是模型內 37 個 roots 中唯一不直接死亡的 root；其餘 roots 的已評估情境全為死亡分數。

|PV 步驟|G/C/S|B|score|
|---|---|---|---:|
|T Mini Single|0/0/0|0→1|−61.85|
|I Tetris|7/7/0|1→2|−44.35|
|Hold J0 → I0 → L0 → L normal Single|均 0/0/0|最末 2→0|−45.95|

六手 leaf L/U/H=14.5/17/14.45。最末仍保 B2B 的同 root 六手 alternative 分數 −50.55，L/U/H=15.5/17/18.05。這是可見 horizon 中 board score 勝過 B2B residual 的例子，但不能證明維持那個更高盤面能活得更久。

- B：當下所有 roots generated 都為 0；沒有 immediate 高攻擊。
- C：**A 自己就是 Mini → Tetris 高 attack 的 branch。** 重建實際下一手 F936 也確實 generated 7、cancelled 7、sent 0、B 1→2。
- D：沒有找到優於這條保命路線的可證明 setup。

這一例否定「Mini 一定沒有轉為有效攻擊」；sent 為 0 也不代表攻擊沒有防守效果。

### G3 F1032：J Mini 已經計畫下一手 break

Top-1：J `(7,29,r0)` Mini Single；pending 1；Hold O unlocked；NEXT T,Z,S,O,J。

PV：J Mini1 → T normal1 → Z0 吃垃圾，三步 G/C/S 全 0/0/0。B 0→1→0→0；combo 0→1→2→0。逐步 L/U/H：11.2/11/8.45 → 10.6/11/7.2 → 11/12/9.8，最終 score=−32.80。

Rank 2 root 是先 Hold O、不消行，立刻吃垃圾，depth 1，score=−35.45。**在已選 Mini 的同 root 下**，第二手改 Hold O、不消行可以保 B2B，但提早在 depth 2 吃垃圾；L/U/H=11.6/12/9.8，score=−33.40。

所有已評估 nodes 都沒有 generated >0，更沒有已搜到的 TSD 被拒絕。存在維持 B2B 的 branch，但它的 offensive continuation 在垃圾 frontier 後面，模型沒看。A 與 C 的分數差 .6 全來自 L，而且比較的是不同有效深度的停止點。D 無已證明較好的 setup。

### G3 F1056：actual break 的 .6 分來源

Top-1：T `(8,29,r0)` normal Single，B 1→0、combo 1→2。接 Z0 進入垃圾 frontier；score=−32.80。

|分支|有效 depth|累計 sent|leaf L|leaf U|leaf H|score|leaf raw B|
|---|---:|---:|---:|---:|---:|---:|---:|
|T Single → Z0|2|0|11.0|12|9.8|−32.80|0|
|Hold O → O0|1|0|11.6|12|9.8|−33.40|1|
|T no-clear|1|0|11.6|13|9.8|−34.40|1|

B：所有 searched nodes generated=0，没有立即高攻擊 alternative。C：保 B2B 的 Hold branch 存在，但後續攻擊未被搜索。D：沒有證實被剪掉的 TSD/setup 更好。

只放大 geometryBudget 到 1000000，仍只用 2077 states、depth 2、同一 top-1／同分數。這不是算力 budget 耗盡，單加 budget 無法解決。當手 authority 也是 G/C/S=0/0/0、B 1→0。

## 5. Failure classification 與 dynamic defense hypothesis

**最有證據的分類是 mixed：search 截斷 + leaf value 的有限視野。尚無本組 state 的 rule transaction mismatch。**

- Search failure 已有因果證據：G1 F120 只改 geometry budget 就改 root；更好的第三手分數本來已在 discarded layer 中。這裡的「更好」指現有 evaluator 的分數，不等於更高勝率。
- Garbage frontier 是另外一種有效 horizon 限制：G3 F1056 加 budget 無效。Root-preserving beam 只留極少 continuation 也是風險，但本次沒有把它證明成主要原因。
- Value interaction 已明確量化：G3 F1056 的 .6 完全由 L 決定。每新增一顆再單消，material 淨減 6 格，即 L 減 .6。無未實現 B2B value，後面的 offensive option 無法回補它。這證明**它為何選 break**，未證明另一路線勝率更高。
- U/H 太重？這對 G3 F1056 前兩名不能成立，因 U/H 相同。G1 F120 兩手前兩名差 .15 確實來自 H；但尚沒有相同完整 horizon 的勝率證據支持改 H。
- 沒有找到「search 看見更好的 TSD/high-attack，仍故意選低攻 Mini」的 Case 2 強證据。有限搜尋內找不到不是數學上的不存在；ordinary-regime movegen 也非所有 provenance 的完全枚舉。
- 五個 selected root 的 modeled G/C/S 與 authority 實際 G/C/S 全一致；G1 下一手 7/7/0 亦一致。這排除了這些手的基礎 attack transaction 錯算，不代表證明了所有未來 timing、垃圾情境或 movegen 完整性。

「目前完全忽略 offense 的防守價值」**不成立**：cancellation 已減少 pending，因此降低 L；活下來與吃更少垃圾的後續 U/H 也可能改善。G1 F168、F912 是具體反例。Pending 每少一行，在其他條件固定下 L 少 .9，不是零收益。

較窄的 hypothesis 仍成立為待驗證方向：**frontier 之後、尚未實現的 attack/cancellation capability 沒有 residual value；未來未知 incoming 也沒有壓力模型。** 在短 horizon 下，少 6 格 material 是立即可見的 .6，B2B、Hold／offensive geometry 的防守選擇權可能完全沒有被估值。這可能是 decomposition 的缺口，但本次不能用五個相依狀態證明它造成整場 0–7。不得據此直接加 Mini penalty 或 TSD bonus。

## 6. 下一個最小實驗

**先只測 geometry budget hypothesis，不動 evaluator、beam、garbage model。** 這是目前唯一已有干預證據、且可用現成 config 隔離的因素。

1. Candidate 僅 `geometryBudget: 100000 → 1000000`。本次兩個離線 probe 已完成：G1 F120 改 top-1，G3 F1056 完全不變。完整結果：[G1 probe](g1-f120-geometry1m.json)、[G3 probe](g3-f1056-geometry1m.json)。不把這個 budget 自動升為 production default。
2. 若下一步進 arena，沿用同一 authority、24-frame cadence、strict top-1/parity、snapshot-only，預先固定 paired seeds + side swap。先小批量對 Legacy，再與舊 Native 對照；不能因看過比分而反覆挑 seeds。唯一 strength criterion 仍是 KO win rate，APP／depth／cutoff frequency／latency 只是診斷。
3. 只有改善能跨配對重現且 browser latency 可接受才考慮升級。小型 FT7 僅是 smoke evidence，不是強度認證。若沒有改善，不能補加 B2B bonus 讓這個實驗混入第二個 hypothesis。

這個實驗**不預期修好 G3 的 frontier 問題**。若要解釋那一類狀態，應另開獨立的 snapshot-only、garbage reveal 後短 continuation 診斷，不能混進上述 candidate；更不能把真實後續 queue／hole 偷放入 decision。

## 7. 重現與 observer 驗證

```sh
node --test test/kiwi-audit.test.js
node scripts/kiwi-audit-search.js docs/audits/kiwi-ft7-35765171232/g1-f120.json .cache/g1-f120-trace.json
node scripts/kiwi-audit-search.js docs/audits/kiwi-ft7-35765171232/g1-f120.json .cache/g1-f120-budget-probe.json 1000000
```

Observer 在 production search 的副本插入只讀 hook，使用精確 source anchor、source hash 與五個 real-state differential tests 防止變更搜尋順序／budget／排名。若 production source 改動，source pin test 應失敗，需要明確更新 audit baseline。測試比較 candidates、node counts、completed depth、completion、geometryStates、TT hits/entries，以及原重建 top-1 與 snapshot 不被 mutate。
