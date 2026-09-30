# 從語意盤點轉入最小機制比較

此表整理目前已取得的證據；不是已啟動的 arena，也不是自動調參授權。所有比較以固定 accepted baseline 為控制組，不能默默疊上前一個未證實改動。

| 順序 | 唯一改動 | 要回答的問題 | 現況與必要前置 |
|---|---|---|---|
| 1 | T-slot 額度換成 remaining known T + reserve T | 不預支未知 T 的完整 policy 是否更強？ | native 與 WASM/Worker gate 已通過（run 36702845823）；下一步四 seeds × seat swap 的八局 KO pilot，dispatch 前固定完整配置；未啟動 |
| 2 | accepted profile 僅 H9 weight=0 | 洞穴連通性懲罰是否提供其他現有 features／search 之外的 KO 收益？ | 語意已清楚，不是 holes/coveredness 的同一 scalar；尚未建立獨立候選，不換成新 downstack feature |
| 3 | accepted profile 僅 H1 weight=0 | incoming 條件化盤面懲罰是否改善 KO 勝率？ | shared coefficients、cap16、低乾淨盤面零值已確認；不另加 cancel bonus，不改 cap/timing |

順序反映候選準備程度與已有證據，不代表已知道 feature 重要性排名。每次只前進一項；單項優劣與多項交互作用是不同問題，單項勝出也不自動累積成新 champion。

## 不再拖延的界線

語意盤點不能回答勝率，不能無限要求更多離線 witness。現在先完成第一項 WASM／browser gate；之後提出具體、小規模的 paired KO arena 配置供下一階段執行。不得因本文件存在就一次排三組大量對戰。原使用者要求完成後 ntfy、不要持續盯跑，保持不變。

任何 arena 均沿用既有 snapshot-only、Tetrp referee、top-1 parity／zero fallback、24 frames cadence、shared piece seed／seat swap 與 technical failure 不計分的契約。檢驗強度只用 KO 結果；APP、H1/H9 項目值、風格只作 diagnostic。先鎖定相同 seeds／match protocol 與計算 budget；不能看完勝負再挑有利 seeds 或任意續跑到贏。

小型 pilot 只足以篩查技術問題和大幅退步，不能因贏一場 FT7 宣稱進步。後續比較總量需在實際 browser／arena 成本明確後固定；目前不虛構 power 或需要幾局的精度。通過測試的變體也保留獨立版本與證據，不直接取代 production。

## 本輪以外的項目

既有 inventory 的 clear shaping、wasted T、B2B Boolean、PC override、well、transitions、height 等仍保留。它們不是「已證明重要」；本輪沒有足夠 outcome evidence 判定無用，也不新增 TSD／mini／Hold bonus。不同 shared coefficient 的作用域已記錄，之後調參前須重看；不把本輪變成全參數 sweep。
