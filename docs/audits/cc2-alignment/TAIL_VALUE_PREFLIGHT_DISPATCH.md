# Tail value preflight：已啟動

2026-10-05 [tail-value preflight已驗收](TAIL_VALUE_PREFLIGHT_RESULT_37291859932.md)：Rust/public root gate成功，20certificate/lock與9Hold，本機另重播20authority commits。probe吃94.07% nodes，12461完成但僅8613隨parent提交；4/20 top1變化中2個published=0，不能歸因新value。此版不開arena；先解決budget/publication與歸因，完整逐probe/browser gate仍未完成。不增加預算／tail深度／不切其他方向；本次沒有新run。

2026-10-05，[run37291859932](https://github.com/jush0147/tetrp/actions/runs/37291859932)。source短SHA `3a5ed32`。

只有單一40min offline job：compile control/candidate、Rust snapshot／tail tests、20固定PublicSnapshot、原accepted report parity、200k accounting、候選root authority parity與成本統計。無arena jobs，沒有改正式bot；不是Native v0。

本機5 checks與實際accepted evaluator植入錨點成功，Rust與真實執行待Actions，不預先聲稱成功。輸出artifact `kiwi-tail-value-preflight`（30天），主要 `audit.json`／兩binary／source-delta／source.patch。

完成或失敗ntfy `just_a_kiwi_for_tetrp`，不持續監看，使用者回報後再分析。重點驗收：baseline完整report一致、published相對completed probe、probe transitions佔nodes比例、top1改變、root/Hold/certificate parity與wall ms。若只有大量計算而parent expansion被丟掉，不能聲稱已帶來有效決策影響。

完整逐probe authority fixtures及browser latency gate尚未完成；此run成功也不能派strength arena或宣稱更強。參見TAIL_VALUE_PREFLIGHT_PLAN.md。
