# 兩批新seed直接確認：均未通過改善判準

2026-10-05。source `67ab40a2ce43706ec916ca764115eade3862afa9`。依[EVALUATOR_CONFIRMATION_PLAN_2026-10-04.md](EVALUATOR_CONFIRMATION_PLAN_2026-10-04.md)驗收，不追加樣本或改判準。

所有bot都是aligned CC2-based Kiwi；對手為frozen accepted，非Legacy snapshot-v3.2，也非失敗的Native v0。每候選100全新seed pairs、換邊、200 KO。

| 候選／run | 直接對accepted勝–負 | 勝率／配對近似95% CI | exact two-sided sweep p | 固定判準 |
|---|---|---|---|---|
| [井深0.6／37215234239](https://github.com/jush0147/tetrp/actions/runs/37215234239) | 96–104 | 48%；40.418～55.582% | 0.694004 | 未通過 |
| [清行三表off／37215267052](https://github.com/jush0147/tetrp/actions/runs/37215267052) | 108–92 | 54%；47.435～60.565% | 0.291215 | 未通過 |

判準原定勝率>50%、配對95% CI下界>50%、兩候選family Bonferroni exact p≤.025。兩者連未校正的.05也未通過，不是單靠多重比較門檻擋住。井深blocks 2–0/1–1/0–2為27/42/31；clear-off為26/56/18。井深兩seat勝場53/43；clear-off51/57。

兩批都沒有確認比accepted更強；不能據此宣稱等效、無用或井深0.6必定更弱。clear-off仍有正向點估計，但不足採用。舊112–88是對Legacy的不同seed探索，不能與本次直接對accepted分數合併，也不能說舊结果已被本次證明為噪音。

## Correctness與證據範圍

重新驗證全部200+200 game summaries、PLAN/hash、commit、每座位binary SHA、完整config、source與repeated gate、兩座位smoke；重新計算所有統計並與artifact完全一致。102 jobs／批全success，兩批皆200正常KO，zero technical failures／silent fallback／rejected candidates／parity mismatches／sim-KO retries。

| 候選 | requests | placements | Holds | reanalyses | terminal Holds | pending snapshots |
|---|---:|---:|---:|---:|---:|---:|
| well-double | 228590 | 166078 | 62511 | 62510 | 1 | 61486 |
| clear-off | 278960 | 200992 | 77968 | 77968 | 0 | 80838 |

合計367070 placements、140479 Holds，runtime top-1 pose/cells/spin/lock-frame/clear與Hold parity全通過。無unsupported-rule rejection或placement certificate failure。唯一terminal Hold：well block42/attempt0/leg0，seat1 accepted於frame14328 top-1 occupied Hold後playing=false、hold.locked=true，無後續該seat decision，該局winner=seat0；已查原始events，屬正常topout。完整public action/parity與trace SHA保存在well JSON。

同局相同piece seed、hole seeds+1/+2，24 virtual frames、200k nodes、PublicSnapshot-only、tl-placement-v1 authority、maxFrames=null、360000watchdog。不是24frame鍵盤transport能力測試。完整raw traces未逐局重跑；本次重算summary、hash與gate，另查terminal Hold raw trace。

兩gate皆20 frozen/control reports、20 candidate placements、7 policy Holds、3 changed top-1，explicit empty/occupied Hold通過；雙執行檔48frame smoke成功且不算strength。二進位均與原成功build相同，新gate沒有重新編譯Rust。

## 身分與耗時

- accepted SHA `386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb`。
- well candidate SHA `956e0573bff5e8668455adfa0fd642f9aeb0b06a9bb6e51a8ed7ead8f5ad8e82`；result SHA `1b1191a290c6fff3590f7978de24e9ad1c04f966fd8498dda252b55a47317846`。
- clear candidate SHA `a80397591038c6cf19202e81cd0327ea5fd0293804c0fd3f885a4e9a35860257`；result SHA `ffe42b4a1e026615c3dfc7afc286964191059e72c873180981af5fe3603d2481`。
- well：UTC16:01:49～17:36:45，1h34m56，23.3422 runner-hours。
- clear：UTC17:36:47～19:29:13，1h52m26，26.9572 runner-hours。
- 兩批依序無重疊，共wall3h27m24；runner-hours不是帳單金額。

機器驗收紀錄：`EVALUATOR_CONFIRMATION_WELL_37215234239.json`、`EVALUATOR_CONFIRMATION_CLEAR_37215267052.json`。

## 收尾

維持accepted井深0.3與原清行三表，無promotion、無追加局数。使用者最後明確要求不影響原兩批：沒有第三批combo、井深1/1.5，也沒有新queue。參數盤點與兩批獨立確認均結束。

本次不能定位成search failure或evaluator failure，更不能當重寫evaluator一定有效的證據。另設evaluator、組合或更高井深僅屬討論，未實作或派送；下一步另決定，不自動啟動。
