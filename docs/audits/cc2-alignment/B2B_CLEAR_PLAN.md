# 第4項：當次 B2B clear 額外 reward 1→0／2

2026-10-04 使用者明確授權先跑0，再queue2。兩個候選獨立從原accepted建立，不疊加clear-off或Surge候選。

## 語意與固定變更

accepted source `GameState.advance`將`tetrp_b2b_transition.normal_bonus`寫入`PlacementInfo.back_to_back`；`legacy_clear_reward`在此旗標為true且不被PC override遮蔽時，加`back_to_back_clear`。這是此次交易的額外edge Reward，並非post-state Boolean leaf，也不是Surge存量。

候選 `btb-clear-off` 將1→0；`btb-clear-double`將1→2。兩者只改此係數。normal／mini／full-spin三表原值、has_back_to_back=.5、bank/charge leaf=0、H1=1、H9=−.5、sent=1、combo shaping=1.5、wastedT=−1.5、PC=15及override=true保持。PC override=true時此筆額外分數被遮蔽；實際sent不被遮蔽。Authority B2B／Surge／cancel／attack transaction全部不變。

只在review profile加cfg配置覆寫，evaluator函式byte-identical，不帶Surge multiplier改寫。沿用已有runner的surge-residual內部路徑/cfg，但manifest.variant及完整配置／planHash識別不同實驗，名稱不代表啟用Surge資產分。

## Gate

- Rust default與candidate snapshot tests、完整配置核對唯一差異。
- 720 full-evaluator合成組合：spin三類×lines0–4×PC×override×combo0/2/5×B2B交易旗標×terminal。預期delta只有未topout、B2B交易旗標true、未被PC override遮蔽時等於candidateWeight−1；leaf完全不變。合成組合不是合法落點證明。
- 固定20 public snapshots：12既有perf＋8charged；rebuilt control與frozen accepted完整report一致，candidate top1 placement／Hold／再分析與空/非空Hold均驗證。至少1個真實top1改變，非Surge-specific charged門檻；不通過停止，不擴樣本到過關。
- 每個候選獨立gate，成功才200新KO。失敗不判強度、不降低門檻，ntfy通知。

## 公平arena與分析

各200新KO（100seed blocks×兩座位），兩批正常共400新局，重用原accepted200局104–96。每局雙方同piece seed、24frames/placement、200k nodes、PublicSnapshot-only、Tetrp唯一裁判、top1 zero fallback/parity mismatch。無一般frame cap；watchdog是技術異常不計；simultaneous KO整block換seed重打並記錄。

依次dispatch，共用concurrency group；先確認0已in_progress再排2，第二批pending不佔runner，第一批結束後獨立過自身gate。第一批失敗也不影響第二批獨立gate；兩者不共用未驗證candidate。每批最多16runner×兩局，job90分鐘。只有一個pending，不queue第5項。不輪詢監看，完成或失敗ntfy至just_a_kiwi_for_tetrp。

主要分別報0-vs-1、2-vs-1的KO勝率差，用100seed clusters配對t近似95% CI，披露重用已知control與兩個探索比較，非多重校正確認證據；0-vs-2可另報探索結果，只有相同seed才配對。不能用三個值找出最高分便宣稱最佳權重；不自動promotion、不追加到顯著或展開更多權重。完成後第5仍為Tetris井深。

本機15項含provenance通過，兩個variant回歸及實際accepted source安裝核對通過。Rust本機不可執行，由Actions gate驗證。run ID另記dispatch。
