# 剩餘資源估值：單一候選離線實作

2026-10-06，使用者授權「繼續」。實作[第一版設計](RESIDUAL_VALUE_DESIGN_2026-10-06.md)，沒有更改公式或增加arena。accepted、production不變，source僅在Actions隔離checkout套用。

## 實作邊界

- `residual_value` cfg開啟才走新leaf；cfg off原有計算與報告保持。R0、H1/H9/B2B保持；base G抽取副本用於real/template差值；單模板／collision guard／正資產折減。未增加movegen、GameState.advance、forecast.resolve或nodes。
- fresh snapshot Freestyle建立時，預計算每層post-transition suffix的第一個T位置及長度。現有模型每次advance消耗一個known layer；empty-Hold active代理與occupied Hold共用reserve，reserve T都表示供給上下一lock可用；否則suffix第j顆T最早第j個lock可用。這只是供給表，不證明中間可安全放置。用實際advance的empty／nonempty Hold fixtures驗證，未做未知empty Hold額外reveal模型。
- generic/persistent及speculate模式不啟用此candidate；snapshot fresh finite DAG才用此預計算表，避免persistent queue變動造成cache stale。
- forecast新增唯讀due摘要，lock deadline採elapsed+frames_per_piece×d−1的saturating版本，stationary維持原clock。最多讀既有16packet，不生成future。
- `residual_trace`另編譯離線observer，每snapshot最多24個正資產leaf witness；timing binary不含observer。Observer report須與on完整一致。

## 固定驗證

控制：accepted pin2e243242 + run36387270053 landing patch；原frozen Linux binary run36849221714 sha386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb。

1. JS transform fail-closed／無新增transition檢查，本機2tests及真實source anchors已過；JS syntax與20request preparation已過。Rust本機無toolchain，交Actions編譯，不宣稱已通過。
2. Rust snapshot tests及新leaf fixtures：供給位置、實際Hold transition、折減單調性／範圍、模板activation、bag不影響值、board不變、due inclusive／elapsed／stationary。
3. 固定12 perf +8 Surge PublicSnapshots，off完整report必須精確等於accepted；trace完整report必須精確等於on。每組保留實際snapshot、policy、witness及mismatch訊息。新評分不要求on等於off。
4. on top1經Tetrp certificate與actual lock；Hold先commit再依新visible snapshot重分析，禁止fallback。人工附加的隱藏suffix不進原request；Hold之後只揭露authority實際提供的下一顆，不能宣稱此synthetic restore是原replay future。此步是有限fixture parity，不是全域正確性證明。
5. warmup後三輪交錯，總60組pair；包含prepare、stdio/report、normalize、placement certificate的完整request計時，未含冷啟動。總時間、中位數、p95全部不高於off才過初篩，保存每輪每state；未過就停止candidate，不轉效能支線。observer另編譯並排除在timing外。這是Linux初篩，不是browser證據。
6. 需要正資產witness與至少一個top1變化才有實際activation；無變化不調大力度。即使所有gate過也不自動開arena或promotion。browser及KO仍待後續明確階段。

單job25分鐘技術上限；完成／失敗ntfy `just_a_kiwi_for_tetrp`。dispatch後停止監看，等待使用者回來驗收。若gate顯示成本不合格但workflow success，那是實驗完成，不是候選通過。
