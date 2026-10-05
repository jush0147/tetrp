# Finite frontier shortcut：固定預算效能候選

2026-10-05，使用者授權繼續。只做一個離線工程候選，不開 arena、不改 evaluator、不增加 200k node budget、不重啟 tail。

## 單一改動與等價性論證

原 Dag::select 在 known child 已抽樣後，重播 GameState.advance，再進入下一個 Speculated layer。finite_visible / !speculate 在該層必定直接 Failed，沒有新節點，也不再抽 RNG。候選在原本 Advance arm 內檢查已存在 next layer；若為 Speculated，提前回傳 None。保留原先 child 抽樣、root 路徑、stall 計數與預算；不跳過未展開 known node、不 force lazy layer。不改 speculate=true。

檢閱 data.rs / forecast.rs：advance 更新本地 GameState，沒有 RNG 使用。仍以完整 report equality 驗證這個推論。這只省每次 frontier failure 最後一個無用 transition；不消除前面 traversal 或所有失敗 attempts，不保證有可觀加速。82.21% attempts 不是耗時比例。

## 凍結控制與 gate

- CC2 pin 2e243242b674d57491f99b445f75e35fc48a0e26 + accepted run36387270053 landing-final.patch。
- 同一 runner/toolchain Rust1.90 建 accepted/candidate release executable。這是 CC2-based bot 的 Linux binary，不是舊 Native Kiwi v0。
- 既有 perf-snapshots.json 12 個公開 snapshot（包含前次4個診斷state），固定 SHA256 348c09730248410adb8b2e4dd96749afe809c21187bfd82399c6c9379be17261。相同200k budget、snapshot-only。
- accepted WASM 凍結 hash 為完整報告基準；兩個 executable warmup + 三輪交錯計時，每次完整 report exact equality（共96次），任何 mismatch dump 並失敗。
- 計時含 prepare、persistent stdio request、解析，不含冷啟動；相同後處理不納入。保存逐snapshot逐輪時間，不能把它說成完整browser推薦latency。
- 預先固定工程初篩：總request時間至少下降5%，且三輪總時間都下降。未過不promotion，不為了通過增加budget或更改評分。即使過也僅值得後續WASM/browser驗證，不直接改production。
- Rust snapshot tests；本機 patch anchor test與JS syntax通過。Rust未在本機編譯，待Actions。

單一20分鐘上限job，這是CI技術watchdog，不是對局裁勝。完成/失敗ntfy just_a_kiwi_for_tetrp，派送後不監看、不自動續批。
