# 剩餘資源估值候選：成本門檻未過，停止此候選

**後續明確授權（2026-10-06）：使用者接受這個凍結候選約3%耗時增加，允許[一次200 KO驗證](RESIDUAL_VALUE_KO_PLAN_2026-10-06.md)。原成本未過結論保持；下文停止決定為授權前狀態，不再代表當前執行狀態。**

2026-10-06 驗收 [run37444591656](https://github.com/jush0147/tetrp/actions/runs/37444591656)，source`bfdbd87806fbc2dc79b1a8a5de606a903d7fc710`。Job success，4分42秒，通知step成功；這表示實驗完成，不代表候選通過。一般CI白名單修正後run37445002303也success。

## 正確性與activation

- Rust新語意測試5／5、snapshot測試8／8、離線trace runner1／1通過。
- 20 off reports完整重現frozen accepted；20 trace reports完整重現on。三輪timing中120次報告與各自reference一致。
- 480個有上限取樣的正資產leaf witness，本機重算delay／discount／asset／value一致。此數量是每request最多24筆，不是總activation率或搜尋覆蓋率。
- 20個actual authority locks與8個Hold在本機從snapshot再次重播，結果與artifact完全一致；含policy top1、cells／spin／clear／frame的certificate與commit檢查，無fallback。僅此fixture集合，不是全域正確性證明。
- 首選改變2／20：leg4/request167，L west x7 y7→x5 y6；leg20/request493，由Place T south x3 y5改為occupied Hold並重新分析。座標為CC2 report坐標，非viewer坐標；不能由外觀或改變率判斷強度。

## 固定cost gate

同runner、相同200k、20snapshot各三輪交錯，共60pair；包含prepare、stdio、normalize及placement certificate，cold start及observer排除。

| 指標 | off | on | 增加 |
|---|---:|---:|---:|
| 60次總時間 | 45,700.37ms | 46,415.69ms | 1.57% |
| 中位數 | 749.54ms | 772.31ms | 3.04% |
| p95 | 871.93ms | 883.62ms | 1.34% |

三輪總時間分別增加1.63%、1.75%、1.31%；本機重算60組資料與線上summary一致。三個指標均不符合預先固定的「不得高於off」門檻。

這是短期Linux樣本，不證明所有機器或browser必然慢同一百分比，也不將小幅差異宣稱為重大性能崩壞。但依既定門檻，不能事後放寬或追加到通過。

## 決定與主線狀態

停止這個「真實board + 單模板改善按供給／壓力折減」候選。不做browser gate、不開arena、不改weights、不轉去優化成本，不promotion。accepted與production不變。

它已證明能改變部分決策且通過有限fixture parity，**尚未測KO，強度未知**；不是證明剩餘資源估值無用，也不是證明現有evaluator正確或已達上限。

低成本剩餘資源估值仍是記錄中的大方向，但第一個具體候選在成本階段停止。此時沒有第二個候選、沒有待執行新任務。若後續續作，必須先明確檢討這次設計與新的具體依據，不能默默切回tail、加速、舊權重掃描或重做已完成診斷。

原始artifact位於`.cache/residual-value-37444591656/`。精簡結果、兩個changed intents、逐輪／逐state計時保存在同名JSON。
