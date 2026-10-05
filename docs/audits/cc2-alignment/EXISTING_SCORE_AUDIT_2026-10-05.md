# 現有分數拆解：沒有足夠新證據選定 evaluator 修改

2026-10-05。使用者要求分析時間不能增加；尾端模擬已停止。本次只讀保存的 accepted source／reports／observer 與參數實驗，不執行新搜尋或 arena、不修改線上 bot。

重現：`node scripts/kiwi-existing-score-audit.js`。輸出同名 JSON，包含四個 PublicSnapshots、完整 root 排名、12 階段分數範圍、固定規則選出的節點路徑與分項、來源 hashes。讀入既存 `.cache/eval-run-36551709585/` 和 `.cache/tail-preflight-37309709343/` artifact，不需要 Rust 或網路。

## 版本與可驗證範圍

- accepted freestyle SHA `9fe27a686c21515eb729af2ec73c4b99cd0ad6201b783fd35319a93c265f03d1`。
- 四份 observer-on report 各自精確等於 observer-off、accepted WASM reference，以及最近 bounded-v2 run 中的 frozen accepted report。這是同一個 accepted 行為，沒有混入 tail candidate 或 Native v0。
- 729 個既有非 terminal 節點，逐筆核對 stages 加總、selected path／depth／known queue、row transition 公式與 cleared-board invariant。
- observer 每 branch/scenario 只取前 24 board rewrites、8 template-only、4 controls。這是有偏取樣，不是全節點、隨機 corpus 或最佳路徑。
- 排名分數是搜尋回傳值；局部節點的 Eval + 當步 Reward 不能直接當成該 root 的最終分數。DAG 可有多個 parent，selected path 也不等於回傳時選出的最佳 continuation。

## 四個實際 root 排名

落點為 CC2 bottom-up 座標；分數不是攻擊行數或勝率。完整其餘候選與 PublicSnapshot 見 JSON。

| Snapshot | 首選／mean | 主要 alternative／mean | 可核對的解讀 |
|---|---|---|---|
| leg0/request346 | I west x2 y1／−52 | I east x2 y2／−52；I west x0 y5／−58.400 | 前兩個 orientation 同分，不能把這算策略優勢。原始 exact top-1 沒有保留 descendant；rank2 有5筆，含 depth6、prefix sent7。 |
| leg4/request419 | occupied Hold／−77.400 | T west x4 y12／−85.100 | Hold 高7.700；保留12筆 post-Hold samples，但不是最後最佳鏈，不能將差額全歸因保留T。 |
| leg12/request383 | T west x9 y5／−56.900 | Hold／−66.400 | Place 高9.500；此 top-root 有3筆 samples，depth6 witness prefix sent1、leaf −72.800，不等於root −56.900。 |
| leg20/request493 | T south x3 y5／−61.060 | Hold／−61.330；T east x3 y5／−61.930 | Place 只高Hold .270；10個scenario的mean優先。top-root有79筆保留samples，含 depth5 prefix sent7。 |

prefix sent 是沿該條記錄路徑的 forecast.sent 減公開起始 cumulativeSent，不是「這一手送7行」，也不是每個 root 的最大可送量。四個 snapshot 的所有保留路徑中，prefix sent 最大值分別7、2、1、7；不能把它們視為完整搜尋的攻擊上限。

## 具體分項證據

1. `leg0/request346` sample0，rank3 root 的 depth1：well +1.2、height −3.2、transitions −65，Eval −67，Reward 0。該 root 最終回傳 −58.4，已表明單步局部值不能代替搜尋延續。
2. `leg4/request419` sample36，post-Hold depth1：H9 −6、holes −15、coveredness −9.6、height約−9.7、transitions −67，Eval約−107.3；普通single shaping −2、當步sent0。最後Hold排名−77.4，不能把−107.3当作它選Hold的理由。
3. `leg12/request383` sample8，首選root的depth6：T-slot +.1、holes −1.5、coveredness −.6、well +1.2、height −4、transitions −68，Eval約−72.8；此步Reward0，路徑已送1行。
4. `leg20/request493` sample16，首選root的depth5：T-slot +.1、holes −3、coveredness −.8、well +1.2、height −2.8、transitions −68，Eval約−73.3；當步Reward0，prefix sent7。
5. 同一 snapshot sample274，首選root的另一條depth4路徑：當步 newly sent +2、legacy shaping −1，Reward +1；prefix sent3、Eval約−63.8。這證明真正交易和 shaping 同時存在，不證明減掉該 shaping 會增加KO率。

所有小數以記錄的 f32 累積差為準，表格有四捨五入。

## 排除幾個看似明顯、實際不成立的修改理由

### 「transitions 約−70，遠大於 attack，所以必須刪掉」不成立

公式以64-bit column和兩側實心牆計數。每個沒有滿行的 row 至少有2次橫向轉換，64列基底是128；權重−.5形成共同−64。已逐筆驗證729個evaluated board沒有滿行，公式重現紀錄。此批 transition 實際差異約0到−9，不能把共同−64當成它壓制攻擊的證據。這也不是主張權重一定合適，或建議真的加64改程式；死亡／未初始化值另有語意，不做全域平移修改。

### 「取消沒加分，所以沒算防守」不成立

accepted cancellation_reward=0，但 forecast先cancel後處理incoming；H1讀post-transaction remaining，後續board／terminal也受影響。H1與base相同概念重疊，實際是pending條件化權重，不能僅因重疊就刪除。沿用H1語意驗收與common-seed測試，不重跑。

### 「看到送2卻只加1，clear shaping就是bug」不成立

這是清楚的人工偏好，但不是TL交易少算1行。clear三表off已直接對accepted確認108–92，未達事前改善判準；本節點也沒提供配對的更佳KO結果，不能重新包裝同一假設再測。

### 「T-slot在沒T時預支，所以改掉一定更強」不成立

已知synthetic bag假設與cutout會改寫base評估盤面。visible-T候選97–103對accepted，未證明改善；這次没有新增最佳鏈證據。保留原結果，不再從同一 witness 宣稱發現新突破。

H9 off80–120支持暫保留−.5；well .6確認96–104、其他Boolean/Surge/clear/B2B改動的探索結果也不支持把點估計較高者直接拼成候選。原參數測試順序保持封存，不自動重啟。

## 結論與交付限制

本次沒有選定 evaluator 修改（JSON selectedModification=null）。沒有找到新、已證實的 active TL交易錯配，也沒有證明是哪個feature把更有利KO的分支壓掉。不能用「有攻擊卻沒選」替代勝率標準。

先前承諾「拆出最後為何排成這個順序」超過既存資料能力：這次交付的是已驗證排名及局部分項，**完整最佳延續回傳歸因仍未完成**。前三個snapshot的保留節點甚至沒有當步sent>0，但prefix記錄證明途經攻擊；這直接展示取樣缺漏，不能說搜尋没看到攻擊。

若再繼續，唯一具體資料缺口是：在debug-only build的既有200k搜尋完成後，讀出top-2各scenario最終backprop chain，保存edge Reward分項、terminal Eval分項並重建root分數。只讀現成搜尋樹、不新增節點、不改ranking、不納入production；off/on完整report須一致，不能把任意selected path冒充best chain。這是尚未實作／未dispatch的診斷提議，不是本次已完成的結果。取得資料仍不自動證明KO更強，若沒有可辨識的新假設就不派arena。

成本限制保持：線上分析時間不退步，不能以相同node budget替代同環境wall-time中位數／慢端驗證。本次無新workflow、無arena、無權重變更。
