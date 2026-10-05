# Tail-value bounded v2：已派離線 gate

- Run: https://github.com/jush0147/tetrp/actions/runs/37309709343
- Source: `3c61cdb25f12d914c9998cff30671e1b8b37f484`
- 2026-10-05 已確認 workflow_dispatch、單一 audit job，source restore 成功，Rust 編譯／tests 正在執行；尚無結果。
- [計畫](TAIL_VALUE_PREFLIGHT_PLAN.md)：20% per-allocation cap、完整 probe admission、siblings reserve、shadow 對照，20 frozen snapshots。
- 本機 6 tests 通過、audit JS syntax 與 accepted source 錨點通過。本機無 Rust，遠端 gate 未完成前不宣稱通過。
- 無 arena、無自動後續任務、無 production／accepted 參數更改。成功或失敗以 ntfy `just_a_kiwi_for_tetrp` 通知，不持續監看。
- 驗收先看 baseline report parity、completed==published、per-allocation quota、candidate/shadow 各自 authority top-1/Hold，再分析三種 top-1 對照與成本。shadow 與 candidate 可因 adaptive search 而走不同路徑，不可當完全相同軌跡。
- 完整 hypothetical transition authority parity 與 browser 成本仍待處理；本次結果不是 strength evidence。
