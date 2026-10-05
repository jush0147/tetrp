# bounded-v2 離線驗收：提交修好，wall cost 不合格

Run [37309709343](https://github.com/jush0147/tetrp/actions/runs/37309709343)，source `3c61cdb25f12d914c9998cff30671e1b8b37f484`，workflow success，單 job 約 18m58s，通知成功。無 arena、无強度結論。數值與 hashes 見同名 JSON。

## 已驗證

- 三個 binary 的 Rust snapshot／tail tests 通過；20 frozen accepted vs rebuilt control reports 一致。
- candidate／shadow 共 40 authority placement commits、14 Holds 通過。本機另以保存的 public snapshot、action、certificate 重播全部 40 locks／14 Holds，proof／actual 全部一致。
- 初次及 post-Hold requests 的每 allocation spent ≤ floor(budget/5)、request ≤200k、probe ≤40k；所有 completed == published。
- candidate 初次 20 requests：788402/4000000 transitions 用於 tail，19.71005%；2987 complete，2987 published，沒有 v1 的 completed probe 被取消 parent 丟棄問題。
- published 仍非 unique TT states 或 best continuation usage。尚未完成每個 hypothetical probe transition 對 Tetrp authority 的全面 parity，不能稱全部 search model 已驗證。

## 決策變化

| 比較 | 首選不同 |
|---|---:|
| shadow vs accepted | 0/20 |
| candidate vs accepted | 2/20 |
| candidate vs shadow | 2/20 |

兩個 state 均有 published probes：`leg20/request493` accepted/shadow 放 T，candidate 選 occupied Hold（141 published）；`leg20/request788` accepted/shadow Hold，candidate 放 L（158 published）。

此批支持「套用新估值會改變決策」，排除了這 20 個 root 上 shadow 工作本身造成 top-1 改變的現象；不證明選得更好，也不代表 candidate/shadow 搜尋軌跡、深度或實際成本完全相同。不是 win-rate evidence。

## 成本失敗

初次 20 requests、同 runner 單次固定順序，中位數：

| 模式 | 中位數 |
|---|---:|
| frozen accepted | 657.17ms |
| rebuilt control | 665.89ms |
| shadow | 16776.71ms |
| candidate | 17127.52ms |

candidate 約 accepted 26.06 倍；這不是 browser benchmark，但已足以拒絕本版本直接進 strength arena。

candidate 有 1,431,972 calls，只有 2,987 completed，1,428,985 admission rejected；shadow 類似。原始碼只在 allowance==0 時早退，否則先生成七種 piece moves 才比較完整成本。quota 留下很小的正餘額時，後續大量 frontier 仍可能反覆枚舉再被拒絕；這些 movegen 沒被 transition quota 限制。紀錄未分開 zero-budget rejection 與實際枚舉 rejection，也未 profile 精確 wall time 歸因，因此不能把全部 rejected 次數直接當實際 movegen 次數。

這是 bounded-v2 的 admission 工程缺陷。20% 限制了 transition work，沒有控制總計算成本；不能宣稱效能修復成功。

## 最小下一步

維持單層 tail／既有 R0、V0／200k／20%／shadow，不調參數、不開 arena。先讓每 allocation 在第一次完整 probe 放不下時關閉後續 probing，避免反覆昂貴 admission；加上 attempted-enumerations、zero-budget skip、disabled skip 與 first-rejection counters，驗證預算尾端不再重複枚舉。這會改變哪些 leaf 能接受 probe，必須重新量 top-1 和 published，不能承諾語意完全不變。

下一版通過成本檢查後，仍須補 hypothetical transition authority 與 browser gate，才能討論 arena。此回合只驗收／記錄，未修改實驗程式、未 dispatch 新 run。
