# Deferred asset v1：固定200 KO直接比較

**已結束：[run37452163955結果](RESIDUAL_VALUE_KO_RESULT_37452163955.md)104–96，未確認改善。Correctness過，維持accepted，不promotion／追加。以下為原預註冊計畫。**

2026-10-06，使用者明確接受本候選約3%中位耗時增加，授權一次強度驗證。此項覆蓋先前因cost gate停止的執行決定，**不改寫原cost fail結果，也不一般性放寬未來候選成本限制**。

## 唯一候選與對手

候選為run37444591656的snapshot-on，sourcebfdbd87806fbc2dc79b1a8a5de606a903d7fc710，SHA256 `c7dbab7b3a0c5d570b062561f763038ab19409c584a047b00ebb521b8c8d5ba1`。對手為已對齊CC2 accepted，run36849221714，SHA256 `386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb`。

兩者都是CC2-based Linux executable，不是失敗的Native v0；本批不直接對Legacy。重用二進位，不重編、不改公式／weights、不做加速修補。尚無candidate browser證據；本批只能證明native arena相對強度，即使通過也不直接上線。

## 預註冊設定

- 100個新seed blocks，換邊兩局＝200個decisive KO。不是200個FT7。
- seed=2026210001+block×100，block0..99；simultaneous KO整對不計，按+attempt×4重打整對，最多25attempts。技術失敗不得换seed或重試成勝局。
- 同局雙方相同piece seed，hole streams seed+1/+2隨seat交換平衡；每局fresh state。
- 雙方200k nodes、固定24 virtual frames/placement；Tetrp tl-placement-v1 authority、snapshot-only、NEXT5、zero silent fallback。並行分析join後才推進virtual time，不因wall-time較慢晚送攻擊。
- 無一般gameplay frame cap，只有360000 watchdog，撞到屬technical failure、不計輸贏。先KO才得分，不用APP、height或存活時間判勝。
- top1／Hold reanalysis／pose／cells／spin／clear／lock-frame parity；保存完整public snapshot、request、policy、certificate／actual events與failure dump。
- 100 seed clusters配對近似95% CI；2–0／0–2 blocks做exact two-sided sweep sign test。預先固定單一候選alpha=.05，勝率>50%、CI下界>50%、exact p<=.05三條同時符合才支持本批改善。不沿用舊兩候選Bonferroni=.025。
- 未確認改善不等於等效或無用；不加樣本追顯著、不續調bonus救候選，不自動promotion。整批correctness必須先過，才解讀KO結果。

## 執行與範圍

沿用既有confirmation match／retry／score流程，複製為獨立residual-arena entry points，避免修改歷史兩候選實驗。identity gate驗證二進位SHA、原preflight完整summary SHA、source與authority／adapter／arena runtime沒有漂移。原20snapshot的已驗收證據沿用；只補兩個seat的48frame orchestration smoke（不計強度、正式對局仍maxFrames=null）。smoke seed2026209901獨立於正式seeds。

單一有限workflow：gate→100 pair jobs→aggregate。max-parallel16，沿用現有runner容量；每job兩局並行、每局兩個bot。pair job90分鐘、對局step80分鐘，逾時是技術異常，不裁勝。正常有限專案regression，無持續負載／新帳號／繞過平台限制。summary與build保留30天，完整trace3天；發送至既有ntfy `just_a_kiwi_for_tetrp`。完成或失敗通知，派送後不監看。

本機測試涵蓋score、seat、seed/retry唯一性、拒絕fallback／技術失敗／錯誤cadence、單候選統計門檻、成本例外不能跳過correctness。Linux frozen binary smoke待Actions。run另記dispatch。
