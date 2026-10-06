# 固定線性模型：160局訓練／40局保留結果

依[驗證前固定計畫](LINEAR_VALUE_HOLDOUT_PLAN_2026-10-06.md)完成。**預測訊號門檻未通過，停止目前22項特徵直接預測最終勝負的方案；不接bot、不追加資料、不調參補救。** 不代表所有線性模型或學習方法無效，也不是bot強度實驗。

## 資料與設定一致性

- 使用既有run37452163955全部200正常KO，233,417 requests。160局／80 paired seed groups訓練，40局／20 groups保留。
- 訓練14,724筆，保留3,416筆；抽樣、每場等權／每側各半、training-only標準化與22項特徵完全沿用pilot。
- 原先3,918筆pilot抽樣逐項相等。對照commit baf160a的AST，features／objective_gradient／fit／predict／metrics／finite_difference_check均未改動。
- 每場result與已驗收aggregate相等、現有auditGame通過、各側report數等於requests。零failure／fallback／rejection／parity mismatch為來源摘要gate；沒有再重播233,417 requests的authority。
- 模型在計算保留組預測前已存檔；存檔SHA256 `2ffd009d0a569a21214f6e26c80977d7a6fdf93ca779a28c6b8a01671b418086`，預測前後相同。沒有用保留組調模型。
- 所有訓練／保留seed互斥；同seed雙方與換位局同組。保留組沒參與前次pilot擬合，但先前已看過整批勝負總表及block90 terminal Hold，因此不是歷史上完全未接觸的盲測資料。

## 保留結果

下列是每場等權預測誤差，越低越好，**不是KO勝率**。

| 模型 | 全部保留log loss | Brier | 前20秒log loss |
|---|---:|---:|---:|
| 固定50% | 0.693147 | 0.250000 | 0.693147 |
| 高度／holes／pending | 0.690696 | 0.248802 | 0.693736 |
| 完整22項 | 0.688775 | 0.247849 | 0.694755 |

前20秒共550筆，以同一模型評估、重新按各場及各側等權，沒有重訓。

完整模型相對基準的log-loss降低量，以20組paired seeds計近似95% t區間：

| 對照 | 平均降低量 | 近似95%區間 | 改善的seed groups |
|---|---:|---:|---:|
| 固定50% | 0.004373 | −0.001242～0.009987 | 10／20 |
| 三項模型 | 0.001921 | −0.000940～0.004783 | 10／20 |

兩個區間都包含0；early結果仍不如常數。故未通過「兩改善區間下界>0且early不劣於常數」的預設門檻。這些是小樣本cluster t近似區間，不是snapshot級顯著性檢定或KO CI。

訓練log loss：constant .693147、simple .690736、full .688544。train與holdout數值接近，但不能僅以此證明沒有overfit、資料量已足夠、或唯一問題是feature不足。此結果不足以區分資訊不足、coarse features、線性形式、遠期label噪音或局面分布等原因，本輪不追加診斷分支。

## 成本與驗證

- 本機i5-1135G7／約16GB RAM，NumPy CPU，沒有安裝套件或使用GPU。
- 訓練資料讀取／audit約64.88秒，保留組約15.06秒；兩次fit合計0.354秒，整支程式80.42秒。均不含artifact下載。
- 兩份float64特徵矩陣共3,192,640 bytes，約3.04MiB；不是程序RAM峰值。
- simple 94步達1e-7梯度早停；full固定500步、最大gradient約1.09e-7，沒有追加步數追結果。
- 原型4項測試及本次2項測試通過；涵蓋幾何／資訊邊界、梯度、training-only scaling、模型JSON存取預測一致性與按20seed groups計區間。Python編譯及diff whitespace檢查通過。

下載使用4條既有artifact連線；沒有新Actions、arena或ntfy任務。Production／accepted evaluator保持不變。

## 保存與停止

完整manifest、各group指標、模型係數／標準化、來源hash見[JSON](LINEAR_VALUE_HOLDOUT_RESULT_2026-10-06.json)。本機原始資料位於 `.cache/linear-value-pilot/traces/`，凍結模型與逐筆保留預測位於 `.cache/linear-value-holdout/`。

重現命令：bundled Python執行 `scripts/kiwi-linear-value-holdout.py`；來源讀取、原型抽樣與aggregate均需保留。脚本可啟動唯讀rg／Node子程序。新模型沒有接進搜尋，root→leaf分布及win value／既有edge reward契約仍未解決。

目前方案到此結束。不得把平均誤差略降描述成bot變強，也不自動以加feature、改lambda、加樣本或換NN延續。
