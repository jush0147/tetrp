# 兩個正向候選：新 seed 直接確認

2026-10-04 使用者授權兩批排隊，完成／失敗 ntfy `just_a_kiwi_for_tetrp`，不需持續監看。舊參數盤點已結束，這是固定候選的獨立確認，非追加舊批樣本。

## 候選與對手

1. well-double：tetris_well_depth 0.3 → 0.6，其餘 accepted 不變。
2. clear-off：normal_clears／mini_spin_clears／spin_clears 三張額外獎勵表歸零；仍計算真正攻擊，井深仍0.3，其他 accepted 不變。

兩批都直接對 frozen aligned CC2 accepted `review_h9_h12`。全部都是 CC2-based Kiwi；native 一詞只指 Linux 編譯執行檔，**不是已失敗的 Native Kiwi v0**。也不是直接對 Legacy snapshot-v3.2；不能以本次結果宣稱已胜過 Legacy。

選這兩個是因為前輪皆112–88、相對共用104–96控制為+4pp的探索線索。其餘+2pp候選暫不擴展；不得把本次兩項合併。舊結果不進新統計。

## 固定樣本、規則與判準

- 各100個新seed、每seed換邊一次＝200個decisive KO；共400新KO。兩候選使用同一份新seed清單，對手固定。
- seed `2026200001 + block*100`，block 0..99。simultaneous KO整對不計、用`+attempt*4`重打，最多25 attempts；同局雙方piece seed相同，hole seeds=seed+1/+2。
- 每方200000 nodes，24 virtual frames/placement，Tetrp tl-placement-v1 authority；snapshot-only、未知tail有限visible，不讀未來。並行分析在join barrier後才推進虛擬時間。無一般frame cap；360000 watchdog屬technical failure，不能判勝。
- top-1／Hold／cells／spin／pose／lock-frame／clear parity；任何technical failure都中止，不換seed掩蓋，不fallback。保存public snapshot、policy report/action、certificate、actual events。
- 100 seed clusters的平均分與配對近似95% CI；對2–0與0–2 blocks做exact two-sided sweep sign test，1–1不進sign test。
- 預先固定兩個確認假設，Bonferroni family alpha .05：每個候選須勝率>50%、配對95% CI下界>50%、且exact p≤.025，才算本次支持改善。95% CI仍是單項描述，不標成family-adjusted區間。
- 未通過＝未確認改善，非等效／無用證明；不追加到顯著，不自動promotion。通過也先驗收，不自動混搭或更換production。

## 執行與身分

Reuse已成功編譯、同state數值測試與arena驗收的原二進位，省掉重編譯，不改bot本體。

| 版本 | 原build run | SHA256 |
|---|---|---|
| accepted | 36849221714 | 386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb |
| well-double | 37200443114 | 956e0573bff5e8668455adfa0fd642f9aeb0b06a9bb6e51a8ed7ead8f5ad8e82 |
| clear-off | 37173465050 | a80397591038c6cf19202e81cd0327ea5fd0293804c0fd3f885a4e9a35860257 |

新gate驗證原manifest／gate／完整config／binary SHA，authority與adapter對原source commit無變動，再重跑20個public snapshots（含frozen/control完整report比較）、explicit Hold，最後兩座位的雙執行檔48frame orchestration smoke。smoke只驗執行，不計強度，專用seed2026190001；正式arena沒有48frame cap。原Rust測試採原build證據，新gate不聲稱重編Rust。

`kiwi-surge-residual-gate.js`後來新增其他variant的分支，並非authority/runtime；新gate實際重跑clear-off驗證，不要求該測試腳本與舊commit byte相同。src/vendor與arena/client/pool等執行語意仍要求commit無diff。

工作流程 `.github/workflows/kiwi-evaluator-confirm.yml`：僅workflow_dispatch跑gate及對戰；push事件只註冊workflow、全部jobs跳過。兩批同concurrency group，先井深、後三表，cancel-in-progress=false；先確認第一批in_progress再送第二批，避免pending相互取代。不再排第三批。

每批100 pair jobs，max-parallel16、每job兩局／四個bot processes。gate40min、pair job90min（對局step80min）、aggregate15min；job timeout是技術中止，不是遊戲勝負。summary/build30天，完整trace3天，符合明晚驗收需求。以正常有限的專案correctness與regression實驗執行，不繞過平台配額或timeout；若平台限制則停下通知。

新summary artifact `evaluator-confirm-result`，build `kiwi-evaluator-confirm-build`，pairs `evaluator-confirm-summary-{block}`，traces `evaluator-confirm-traces-{block}`。內部binary命名仍有surge-residual，variant／SHA才是身分，並非在啟用Surge。

本機：well-double環境12 checks、clear-off環境7 checks通過；Linux真實binary gate待Actions。run與source commit另記dispatch。兩批後停止，明晚再驗收與決策。
