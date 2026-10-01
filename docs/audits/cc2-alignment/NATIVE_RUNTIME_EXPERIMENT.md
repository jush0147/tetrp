# Native release versus WASM — offline execution experiment

已由 commit `1c8eebba342335e71abf737f9671318f6d7f10ea` 啟動 [run 36849221714](https://github.com/jush0147/tetrp/actions/runs/36849221714)。建立時 queued，尚無結果。另有普通 engine CI 隨 push 觸發，不是額外 arena。已通過本機 protocol / publication 共 7 tests；Rust compilation 和跨 runtime parity 尚待 CI，不持續輪詢。

2026-10-01。使用者不同意因一次快取失敗就接受目前 arena 耗時，授權比較同一核心的 native release / WASM。前一輪「效率插入工作結束」已撤回，並不是回頭救快取。原參數順序 visible-T → H9-off → H1-off 不變，200 場與 48 場均不啟動。

## 固定比較

- accepted：2e243242 + landing-final.patch；visible-T：同源加既有 default-off visible-T transform，只有該 profile 開 snapshot_visible_t。
- 不套被淘汰的 movegen cache，不改 evaluator、規則、200k nodes 或搜尋演算法。兩個 profile 各自與原凍結 WASM 比較。
- Rust 1.90 release binary 只新增 JSON-lines stdin/stdout entry point，呼叫原 analyze_text；typed Report 直接序列化，避免 serde_json::Value 把 f32 顯示轉成 f64。沒有新增 native gameplay engine。
- Node 用常駐單一程序，一次僅一個 pending request；輸入只有 prepareKiwi 的公開 request。無 stdin hidden sequence、無累積決策歷史。stderr 不進報告。
- protocol malformed / crash / timeout 都是 technical failure，不 fallback；request 明確拒絕可回傳 error，但 benchmark 只針對刻意送出的 invalid input 預期此行為。

## Gate 與量測

既有 12 個固定 PublicSnapshots，accepted / visible-T 各三輪交錯順序。先 warm up，再量完整 prepare → search（含 native IPC）→ normalize → certificate 耗時。排除程序冷啟動；記錄分段耗時，不能把這個 steady-state microbenchmark 當完整 arena ETA。

完整 request / warnings / report / action / proof 必須 exact deep equality，包含 report score、nodes、ranked actions；不放寬浮點 tolerance。每個 profile 比較 12 warmup + 72 timed calls + 1 process restart = 85 次；遇到 mismatch 保存兩份完整資料並停止，不用不等價的速度來宣稱可遷移。每個 native profile 的 snapshot Rust regression tests 另跑。

事前工程保留門檻：全部 parity 通過且該 profile 完整 request 耗時至少減少 10%。通過只代表值得接入離線 arena adapter；尚需實際 arena 的 authority / Hold / lock parity 驗證，不自動 migration。Browser/PWA 繼續 WASM。若不足門檻，據實記錄，不能靠縮搜尋量換速度。

workflow `kiwi-native-runtime.yml`：單一 runner、30 分鐘 watchdog、完成／失敗 ntfy 通知。只啟動一次、不持續盯跑。輸出 source patch、新增 runner source、native binaries、完整 reports、量測、環境和 binary hashes。
