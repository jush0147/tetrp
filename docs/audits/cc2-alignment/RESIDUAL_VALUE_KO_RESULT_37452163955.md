# Deferred asset v1：104–96，未確認改善

2026-10-06 驗收 [run37452163955](https://github.com/jush0147/tetrp/actions/runs/37452163955)，source1962147846d8ba785129f70ceb00b51aae77e2ce。Workflow success，10:48:02–12:29:56 UTC（台灣18:48–20:29），約1小時42分。唯一固定候選直接對aligned accepted，不是Legacy或Native v0。

## 正確性

本機重新執行原auditGame／summarize，核對全部100blocks的plan、planHash、source commit、二進位身分、seed／seat、24frames、200k budget、KO-only／no frame cap等設定，統計與線上aggregate完全一致。

- 200正常decisive KO，無simultaneous KO／重打／watchdog裁勝。
- 233417 requests，169286 placement parity、64130 Hold parity；零technical failure、零mismatch、零fallback、零rejected candidate。沒有由unsupported-rule／certificate failure跳過的局。
- 64129次Hold後重新分析；唯一terminal Hold在block90/leg0/seat1（accepted），frame12984。已下載原始trace，從該decision PublicSnapshot本機重播commitHold，完全一致地得到playing=false／garbagesmash。是正常KO，不是漏分析或技術錯誤。
- 以上完整局數依執行時authority parity與摘要核對；沒有重新逐手重播全部169286 placements。唯一例外terminal Hold另有raw trace與本機重播證據。

## 強度結果

| 指標 | 結果 |
|---|---:|
| 候選 : accepted | 104 : 96 |
| 候選KO勝率 | 52% |
| 100 seed clusters配對近似95% CI | 44.82%–59.18% |
| 2–0 / 1–1 / 0–2 blocks | 28 / 48 / 24 |
| exact two-sided sweep sign p | 0.67781 |

預定要求勝率>50%、配對CI下界>50%、exact p<=.05；只滿足第一項，因此**未確認改善**。不是「已證明一樣強／無用」，也不是有證據更弱。不能將104勝單獨包裝為新champion。

## 決定

保持accepted，不promotion、不追加到顯著、不改bonus／weights救此候選、不開第二批。已使用一次使用者授權的約3%成本例外，但KO結果沒有建立值得採用的增益。

此結果否決的是當前候選的採用，不否決所有剩餘資源估值方法，更沒有定位delay、due pressure、單模板上限或base G哪一項造成结果。本批是整個機制一起比較，不能由比分做單項因果歸因。

目前沒有第二個候選或已排任務。若後續繼續，仍須參照唯一主線先提出有理由的設計，不自動轉回搜尋／效能／舊調參。大方向的價值與這個實作的結果必須分開。

精簡結果與全部100block分数保存於同名JSON。原aggregate位於`.cache/residual-arena-37452163955/result.json`，terminal raw trace位於該目錄的`trace90/`；Actions完整trace原保留3天，摘要30天。
