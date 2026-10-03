# B2B Boolean × Surge residual：補第四格與兩個 1

2026-10-03 使用者明確授權：先啟動剩下的一格，再 queue 兩個參數都是 1 的版本。暫停第3項 clear shaping。不是 production promotion。

## 固定候選與順序

1. `boolean-off`：has_back_to_back=0、h3_surge_bank_value=0.5。
2. `both-one`：has_back_to_back=1、h3_surge_bank_value=1。

兩版各自從 frozen accepted 建立，其餘配置完全相同；不把前一版的勝負當第二版的啟動或選參依據。Surge residual 維持 gross `weight * floor(chargedBankBaseUnits * publicNextLockMultiplier)`，不新增 charge progress 或 pending 扣除。第一版補 2×2 缺格；第二版是使用者事先指定的聯合數值探索，不是用來估計原 2×2 interaction 的第四格。

## 原 2×2 與分析

| Boolean | residual | 資料 |
|---|---|---|
| 0.5 | 0 | accepted，run37026070707，104–96 |
| 0 | 0 | run37114400655，100–100 |
| 0.5 | 0.5 | run37124649645，101–99 |
| 0 | 0.5 | 本次第一批，200新KO |

每格同100個seed blocks，各兩座位對同一 frozen Legacy。主要報告第四格相對 accepted 的配對 KO 勝率差；另在每個共同 block 計算 interaction：`[winrate(0,0.5)-winrate(0.5,0.5)]-[winrate(0,0)-winrate(0.5,0)]`，由100個block的差計算配對 t 近似95% CI。不是將四個獨立CI相減。正值表示 residual 開啟後移除 Boolean 的效果變得更有利；不等於第四格一定強於 accepted。

每次simultaneous KO仍按原規則整block換seed；如新舊批次重打導致block seed不同，不能當同seed交互作用，須披露並分開分析，不能悄悄補作匹配。先前三格無重打。

第二批主要比較(1,1)與accepted；對(0.5,0.5)的差可另報探索比較，不能分別歸因Boolean或bank。既有資料已觀察、多候選探索，CI不是多重比較校正後的promotion證據；不追加到顯著，不再掃其他權重，任何採用前另議新seed確認。

## 執行與公平性

沿用 Surge residual workflow，dispatch input 綁定唯一 variant、plan hash、manifest、配置與binary SHA。每批各自 gate：192 authority交易fixtures、Rust full evaluator bank單位／Boolean差值／terminal／release reset、frozen完整report parity、20 public snapshots含8charged、Hold與top1 authority parity、charged top1 activation。失敗不開該批arena，不降低門檻。

每批200新candidate KO（100blocks×兩座位），accepted200局原控制重用並驗SHA／環境／每個game。正常合計400新局，不是400個FT7。同局同piece seed、24frames/placement、200k nodes、snapshot-only、Tetrp唯一裁判、zero fallback/parity mismatch；無一般frame cap，watchdog僅技術失敗。

兩個workflow run共用既有concurrency group，cancel-in-progress=false。先確認第一批已進入in_progress再送第二批，第二批pending不佔對戰runner；只提交一個pending，不再派第三批以免替換pending。第二批在第一批結束後獨立執行自身gate，即使第一批失敗也不共用未驗證artifact。每批最多16runners×2局，每job限90分鐘。沒有idle runner等待迴圈。

兩批各有ntfy完成／失敗通知到just_a_kiwi_for_tetrp。依上一批1h45m僅作粗估，兩批約3.5–4小時加排隊，非保證。不持續監看；run ID另記dispatch。此授權僅此兩批，不自動啟動clear家族。
