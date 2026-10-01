# Request-local movegen cache — bounded experiment

2026-10-01。這是效率插入工作；參數主線仍為 visible-T → H9-off → H1-off。沒有啟動 arena，也沒有修改 evaluator、200k node budget、24-frame cadence 或 production WASM。

## 唯一假設

搜尋中的不同節點可能重訪相同 movegen 輸入。只在一次 analyze_text request 內，重用完整 Board（10 個 columns 與 garbage_rows）、piece、allow_clutch 完全相同的結果。BTreeMap 做完整 key equality；FIFO 上限 512 entries。保存完整且同順序的 (Placement, u32 cost)，不做落點或 provenance 簡化。

RAII guard 在 parse 前建立、離開 request 時清空，包含 parse error。沒有跨 request 的搜尋資訊；獨立 Hold reanalysis 會重新建立 cache。既有 air-prefix cache 維持原樣。診斷統計可在 request 後讀取，但不回流 decision。

## 預先固定的驗證

- 同一個 job 分別建 accepted、visible-T 的 off / on / verify kernels，總計六個 WASM；原始來源固定 2e243242 + accepted landing-final.patch。
- off build 必須與既有凍結 artifact 完整 report 相同；on 與 verify 也逐一對照該 policy 的凍結 artifact。不要求不同 policy 做相同決策。
- verify 每次 cache hit 重新呼叫原 movegen，核對整個有序結果（包含 spin / cost）。驗證版不參與計時。
- native Rust 跑現有 movegen、snapshot fixtures，加上 cache key / FIFO / scope / parse-error / ordered-result tests。
- 固定既有 12 個 PublicSnapshots，200k/request；完整 request 包含 prepare、search、normalize 與 placement certificate。三輪交錯 off/on，計時之外檢查 request、warnings、完整 report、action、proof、輸入未被修改。
- 診斷 calls / hits / misses / evictions / peak entries / peak stored payload bytes。payload bytes 不包含容器、allocator overhead；不冒稱是 WASM 全部記憶體。每 request 清除 entries 不表示 WASM linear memory 會縮小。
- 每個 policy 分別報告完整 request 減少比例，至少 10% 才通過工程保留門檻。任何 parity 差異先判失敗。沒有收益就封存，不掃容量。

本機已在隔離 checkout 上套用 accepted patch、visible-T transform、cache transform，確認所有 source anchors；Node transform test 與語法檢查通過。本機沒有 Rust toolchain，Rust 編譯與測試交由 CI，不宣稱已通過。

## 執行與結果

### 已完成：淘汰快取，不 promotion（2026-10-01）

Run 36844153120 成功，job 7 分 43 秒，ntfy step 成功。結果資料保存於 MOVEGEN_CACHE_RESULT_36844153120.json；下載後重新核對六份 WASM hashes、樣本／計時數、cache counters 及門檻。

| Policy | 完整 request 耗時變化（on / off） | Cache 命中 | 判定 |
|---|---:|---:|---|
| Accepted | 增加 5.85% | 2,187 / 103,555 = 2.11% | 淘汰 |
| Visible-T | 增加 1.11% | 2,357 / 103,514 = 2.28% | 淘汰 |

兩個 policy 各 12 個 public states × 三轮 paired timing；各 108 次完整輸出比較，合計 216 次零差異。verify build 的 4,544 次 cache hit 均重算並通過有序 placement / spin / cost 一致性。Rust 每個 policy 的 movegen 13 tests + snapshot 8 tests 全過，共 42 test executions。此證據限定於 fixtures 與固定 corpus，不是新的 arena correctness 報告。

Accepted 三輪分別慢 5.38%、5.30%、6.86%；Visible-T 分別慢 1.24%、1.51%、0.58%。沒有任何一輪達到預定至少 10% 耗時減少。兩個 policy 各約 95,000 次 eviction；peak stored payload 約 197,040 / 199,848 bytes，不含容器和配置器成本。

解讀：本次固定 512-entry FIFO exact-key 設計的重用率太低，整體收益不足以抵銷查找、插入、複製與淘汰的成本；没有再分解這些 overhead，不能指定某一項為已證實的唯一原因。也不能從這個負結果推論所有快取都無效。

決定依事前規則封存，不改容量或換 eviction policy 續追數字；production 與 arena 繼續使用原凍結 WASM。保留已通過的 root 枚舉優化（先前本機完整 request 約減少 15%，不保證 arena 同比）。本輪效能插入工作結束，下一項回到 visible-T 固定樣本 KO 比較的批次配置，不再新增搜尋效能假設。200 場提案與舊 48 場草案均未啟動；需先把前者的配置、成本與結果判讀落實，不能誤發舊草案。參數順序 visible-T → H9-off → H1-off 不變。

已由 commit `e2873dd55c1dc712d8e6d39181846d166f069cef` 的 push 啟動 [run 36844153120](https://github.com/jush0147/tetrp/actions/runs/36844153120)。建立時確認 in_progress；尚無結果，不持續輪詢。另有既有 engine CI 隨 push 正常觸發，並非第二場實驗。

workflow `kiwi-movegen-cache.yml`：單一 runner，上限 45 分鐘，固定有限 corpus；完成或失敗透過既有 ntfy topic 通知。artifact 保留 patch、六份 kernels、reports、逐 request 計時與統計。本次不自動 promotion、不排 arena、不持續監看。

這個微基準只回答快取是否值得保留；不證明 arena 整體加速比例，也不代表 bot 強度改變。
