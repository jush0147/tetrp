# 離線線性勝負預測：本機原型結果

依[預先固定計畫](LINEAR_VALUE_PILOT_PLAN_2026-10-06.md)，僅使用已完成的[run37452163955](https://github.com/jush0147/tetrp/actions/runs/37452163955) block0–19。沒有新 arena／Actions、沒有模型接進 bot、沒有參數或特徵追加實驗。

## 判定

**本機算力可行；這批資料上的預測訊號很弱，尚不足以支持新 evaluator。** 不將 log-loss 微小改善當成 KO 勝率改善，不宣稱線性模型或 outcome learning 已被否定。

## 資料與防洩漏

- 本機原先只有8個標準 `reports.jsonl.gz`，包含為查 terminal Hold 特別保留的樣本，不能以其代表一般局面。另有舊版／不同格式的 jsonl；本輪未混入。
- 新下載固定20個既有 artifact，40正常KO、20 paired seed groups，49,290 requests；reports壓縮後約101.7MB（另有events及result，訓練不讀events）。不依勝負／局長挑樣本。
- 每場 result 與已驗收的 aggregate 完全相等，再呼叫現有 `auditGame`；零技術異常／fallback／rejection／parity mismatch的來源摘要gate通過。每側reports行數與requests相符。這不是重新執行每手authority lock。
- 固定每8 pieces取一筆、每側最多64筆、排除Hold reanalysis，共3,918 snapshots；每場等權、兩側各半。40局不是3,918個獨立勝負樣本。
- 5折按block modulo5分組；每折16組訓練、4組留出。每場雙方及seat-swap均同組；標準化只用訓練fold。
- 模型只用當時PublicSnapshot的22個固定特徵；沒有bot身分、seed、seat、report評分、actual action、hidden future、piece history／bag inference。winner僅為離線label。Metadata中的seat只用來配對label及加權，不進入X。
- `are`與`hold_available`在本次樣本為常數，係數為0；這不代表這些概念對所有TL局面都無用。

## 預測結果

每場等權，越低越好；數值不是勝率。

| 模型 | 留出log loss | 留出Brier | 前20秒log loss |
|---|---:|---:|---:|
| 固定50% | 0.693147 | 0.250000 | 0.693147 |
| 高度／holes／pending三項 | 0.691594 | 0.249229 | 0.695114 |
| 完整22項 | 0.690777 | 0.248890 | 0.695645 |

完整模型相對常數只降低0.002370 log loss，相對三項模型只降低0.000817。20組中11組優於三項模型；5 folds中3折優於三項、2折較差。只看前20秒的554筆時，兩個模型都不如固定50%。這不支持「已學到穩定的早期資源價值」，也不能由早局結果推導某一feature因果無用。

前20秒評估使用原模型，重新按各場／各側等權；沒有為該子集重訓。這只是公開frame下的探索檢查，並非根據距離KO時間去選樣本，亦不能保證所有early state遠離死亡。

## 本機成本與數值檢查

- CPU：Intel i5-1135G7，8 logical processors；實體RAM約15.8GiB。
- 使用既有bundled Python／NumPy，未安裝任何套件。4項測試通過：top-down board geometry、額外identity/history/future欄位不影響features及NEXT5檢查、數值梯度、solver與training-only scaling。
- 數值梯度最大誤差約2.01e-10。
- 資料處理含40次現有Node gate：約15.13秒；5fold×2model共10次fit：約0.372秒；總執行約15.55秒，**不含GitHub下載時間**。
- float64特徵矩陣689,568 bytes，約0.66MiB。這只是X大小，**不是程序總RAM峰值**。
- 完整模型5折均執行固定500步上限；final maxAbsGradient約2.2e-7～5.64e-6，未全部達到1e-7早停門檻。每一步loss單調下降；不聲稱精確最佳化收斂，本輪不追加步數或改regularization追結果。

訓練本身非常輕。此結果不能直接外推百萬資料的時間，也沒有測任何線上Kiwi延遲。

## 結果如何使用

本輪完成「可讀資料→分組→訓練→留出評估」的原型。係數／predictions只是診斷，不輸出production evaluator。root snapshot和搜尋leaf的分布不同；既有bot continuation的勝負關聯不是action因果價值；勝率／logit與既有attack reward也尚無接線契約。

目前沒有值得直接開KO的候選。若繼續，需先討論資料訊號與value/reward契約，不能拿此結果當成授權自行下載剩餘160場、增加feature、掃正則係數或開新arena。

## 重現

原始資料位於 `.cache/linear-value-pilot/traces/`；抽樣特徵及out-of-fold prediction位於 `.cache/linear-value-pilot/output/sampled-features.jsonl`。完整40場manifest、每場uncompressed report SHA256、各fold係數／標準化／metrics、20組metrics、來源hash與硬體見[結果JSON](LINEAR_VALUE_PILOT_RESULT_2026-10-06.json)。

```powershell
& 'C:/Users/jush/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' test/kiwi-linear-value-pilot_test.py
& 'C:/Users/jush/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/kiwi-linear-value-pilot.py
```

腳本會使用本機已驗收 `.cache/residual-arena-37452163955/result.json`；原始trace若缺少任一固定block會失敗，不會換seed。部分受限環境需允許Python啟動唯讀rg／Node子程序；本次由執行環境批准後完成。
