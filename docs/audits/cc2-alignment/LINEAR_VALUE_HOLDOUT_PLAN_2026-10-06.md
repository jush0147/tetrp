# 固定線性模型擴大驗證

使用者已授權使用既有200局，沿用22項特徵與訓練方式，不新開對戰、不調參。以下在擬合及讀取保留組feature結果前固定。

- run37452163955 block0–79的160局訓練；block80–99的40局保留。20組paired seeds為評估獨立單位，不能把snapshot當独立樣本。
- 沿用pilot原函式：features、抽樣、各場/各側權重、training-only標準化、L2=0.01、500步上限、梯度步長、三項及常數對照。沒有新特徵／超參數選擇。
- 先完成訓練並保存模型，再計算保留組預測。訓練集上的性能只作擬合診斷，不能用來採用候選；不依holdout再改動。
- 核對來源aggregate／auditGame／requests、piece seed與cadence、failure/fallback/parity摘要。缺失不換seed。下載80組既有artifact，至多4條下載工作並行；不使用Actions算力。
- 報告保留組每場等權log loss及Brier，及同一模型在frame≤1200子集的等權結果。
- 將「完整模型降低log loss」以每paired seed group相對常數／三項模型的差值報告；用20組差值的均值±2.093×標準誤作近似95% t區間（非snapshot級檢定，非KO CI）。只有兩個改善區間下界皆>0，且early log loss不高於常數，才稱值得進一步研究的預測訊號。這是本次設計門檻，不是強度promotion門檻。
- 若未通過，不接bot、不調feature／lambda救結果、不追加資料。這僅結束目前22項線性outcome predictor，不證明其他學習方法無效。
- 保留組未參與pilot訓練/CV，但整批200局勝負總表先前已被驗收，block90還曾因terminal Hold被人工查過；所以它不是從未被接觸的盲測資料。此次只保證不參與模型擬合與超參數選擇。
- 即使通過，也仍缺root→leaf分布、value與既有edge reward契約、browser成本及公平KO驗證。本次不自動實作候選。

原計畫：[pilot](LINEAR_VALUE_PILOT_PLAN_2026-10-06.md)；來源及弱訊號：[pilot結果](LINEAR_VALUE_PILOT_RESULT_2026-10-06.md)。
