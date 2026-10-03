# 第2項續：真實 charged snapshot 診斷

在Boolean-off 200KO結果不確定後，保留accepted全部權重。使用者指示繼續。本次只有8個snapshot的離線診斷；不建立新candidate或arena，不修改production/search。

## 固定取樣及已完成證據

資料來源run37114400655的**block0**兩局candidate座位（policy為B2B leaf-off，不冒充accepted trajectory）。只依公開raw B2B>charge_at篩選，再各取按時間均勻分布4個。leg2共有820 requests／69 charged，leg3為275／32；共8份snapshot。選樣不讀action、score、winner。原壓縮trace hashes、公開snapshot hashes記在[SURGE_PUBLIC_INPUTS.json](SURGE_PUBLIC_INPUTS.json)。

`node scripts/kiwi-surge-inputs.js`重現選樣。snapshot-only不帶raw replay或future；authority局部分支的synthetic hidden suffix不傳進任何policy。沒有以piece history推bag。

已將captured report內全部288個ranked candidates（其中Hold不作placement）逐一當獨立counterfactual，對place驗path/provenance並於frame+23由authority commit。不是arena fallback，也沒有替換實際選擇。結果見[SURGE_CAPTURED_ROOTS.json](SURGE_CAPTURED_ROOTS.json)。sent/generated/cancelled為完整該手transaction，並非只有Surge packet。

| State | raw B2B | captured top1 | reported最佳release rank（0起） | 該手sent |
|---|---:|---|---:|---:|
| b0-l2-charged0 | 5 | place保留 | 無 | — |
| b0-l2-charged22 | 8 | Hold | 無 | — |
| b0-l2-charged45 | 7 | place保留 | 2 | 0 |
| b0-l2-charged68 | 9 | place保留 | 無 | — |
| b0-l3-charged0 | 5 | Hold | 無 | — |
| b0-l3-charged10 | 5 | Hold | 5 | 1 |
| b0-l3-charged20 | 8 | place釋放 | 0 | 0 |
| b0-l3-charged31 | 8 | place釋放 | 0 | 5 |

「無」只表示該report列出的place candidates中沒有release，不證明所有可達動作／Hold後都無法釋放。Hold需重新分析，不把它當ordinary no-clear。以上尚不是原設定的排序，也不是決策優劣或KO因果證据。

## 接續的單次Actions診斷

凍結accepted source及binary，原設定+0.5保持。每個snapshot先跑frozen accepted，再跑只有`cfg(surge_observer)`記錄的accepted；**除額外observer欄位外，完整report必須相同**。同200k nodes、原scenarios與finite-visible queue。

只讀observer計算所有evaluated nodes的branch/scenario/depth統計，分release、bank-held、other、terminal。每組只保留前兩個release/bank-held witness：實際selection path、placement、remaining queue、post-state B2B/base bank、下一手lock multiplier、sent delta、pending before/after、完整leaf eval/edge reward。輸出具體量值，不用抽象「bank有價值」代替資料。

source規則交易與reward公式均不變。此observer的path是DAG selection的一個witness，**不是root最優backed-up continuation**；部分budget邊界eval可能未publish。`atKnownQueueFrontier`表示normalized known queue全部用完，不代表所有尚未展開DAG葉。不得用抽樣的好continuation宣稱root一定把它評錯，也不把下次multiplier當當次release multiplier。bankBaseUnits是未乘multiplier的量，不是sent。

對accepted report的每個listed place同樣做authority immediate root audit，分列best release／best keep；Hold只記required reanalysis，不假設未知新next。輸出所有snapshot、request、report、observer及root交易，足以確認search是否實際到達release／charged known frontier，以及既有leaf到底給多少。

## 判讀與下一個假設限制

- 若search已有大量release：推翻「完全沒建模Surge」；仍不代表短視問題已解決。
- 若確實到達charged frontier且H3為0：可證明該明確bank沒有獨立數量leaf價值；不能直接推論加值必勝。
- 若隊列frontier根本沒到：優先檢查有效horizon，不能用bank bonus掩蓋未取得的證據。
- generated全部cancel的真實root，指出bank與sent不同；它不是cancellation額外reward該啟用的勝率證據。
- 不比較bank權重，不同時打開charge+bank，不將Boolean不顯著當刪除依據。要建立後續單一候選，必須先依本診斷定義其單位／兌現條件／重疊與限制。

單一Actions job上限40分鐘，artifact30天，成功／失敗ntfy `just_a_kiwi_for_tetrp`；不持續poll，不自動arena。Rust編譯及完整report parity仍待run，不以本機插樁檢查冒充通過。
