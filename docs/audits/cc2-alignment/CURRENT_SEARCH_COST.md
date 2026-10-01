# 現行搜尋核心成本定位（2026-10-01）

接續 RECOMMENDATION_EFFICIENCY.md。沒有改搜尋、evaluator、node budget 或部署；沒有啟動 arena。

## 實際執行

擴充既有 scripts/kiwi-cc2-search-profile.js，加入 accepted 與 visible-t 兩個精確 artifact hash。保留舊 profiling modes。12 個已保存 PublicSnapshots、200k/request，各 artifact 先產生完整 reference reports，再做兩輪未 profile 計時及一輪 V8 sampling。每個 artifact 36 次完整 report parity，合計 72 次通過。這是各自對自身報告的穩定性，不是要求不同 policy 的報告相同。

兩個程序依序執行；其毫秒數不能當作候選比 baseline 快的 paired evidence。profile 僅歸因 profiledSearch 範圍，不混入 prepareKiwi。原始資料在 .cache/cc2-current-search-profile，摘要及 raw-profile hashes 見 CURRENT_SEARCH_COST.json。

## 熱點

| 成本 | Accepted | Visible-T |
|---|---:|---:|
| movegen 含子呼叫 | 43.03% | 40.65% |
| BinaryHeap pop 自身 | 12.77% | 8.49% |
| rotate_to 自身 | 10.49% | 10.27% |
| GameState hash 自身 | 8.26% | 9.74% |
| Freestyle do_work 自身 | 31.14% | 33.13% |

inclusive 與 self 有重疊，不能加總；do_work 含內聯的 selection/evaluation/expansion 等，不能把 31–33% 稱作 evaluator 單獨成本。數字是本機 V8 抽樣估計，非精密指令計數。accepted source 必須含 landing-final.patch，不能對未套 patch 的舊 movegen 再做已完成的 dense／landing 改良。

## 下一個唯一候選：request 內的完整 movegen 結果重用

考慮對 find_moves_with_clutch 的完整輸出做有界 memoization，而不是立即重寫 priority queue、改旋轉或簡化 Hash。其輸入為完整 Board（含 garbage_rows）、piece、allow_clutch；輸出是排序後的完整 (Placement, u32 cost) 清單。原有 air-prefix cache 只重用空中前綴，不是完整局面結果 cache。

這只是有待測量的假設：不同 search branches／garbage scenarios 可能重訪相同幾何輸入。profile 證明 movegen 貴，**尚未證明重複率足夠高**。不能宣稱已有 40% 的可省成本。

有限驗證方式：
1. 以隔離 build-time flag 建 request-scoped、固定容量（第一個測試值 512 entries）的 exact-key cache；request 開始清空，僅 reuse 純函式輸出，無歷史資訊。
2. 保留順序、spin、完整 u32 cost；key equality 必須比對完整輸入，不能只用 hash 當 identity。cache miss 仍執行原函式；不能裁剪合法落點或改 node budget。
3. 記錄 calls/hits/misses/evictions 與記憶體；診斷與非診斷路徑分開，計時不可使用加了重算驗證的 instrumentation build。
4. 同一套 fixed public corpus 比較完整 reports、node counts、top-1，另用 authority movegen fixtures 檢查 cache hit/miss 的 ordered placement/spin/cost parity；任何差異先判候選失敗。
5. 只有 parity 通過且完整 request 的配對收益足夠（預先以至少 10% 耗時減少作工程保留門檻）才保留；沒有收益就封存，不連續掃容量或更換機制追數字。

本輪只完成 profiling 與源碼可行性檢查，尚未實作此 cache，未開相關 CI。hash 語意、搜尋演算法、規則支援域均不改。這仍是效率插入工作，參數主線保持 visible-T → H9-off → H1-off。

## 重現

```
node scripts/kiwi-cc2-search-profile.js accepted .cache/cc2-landing-run-36387270053/cc2-wasm-results .cache/cc2-current-search-profile
node scripts/kiwi-cc2-search-profile.js visible-t .cache/tslot-wasm-run-36702845823 .cache/cc2-current-search-profile
```

不附帶下載、通知、dispatch 或 arena；需要既有的兩份 artifact。不要重跑舊 dense／landing 實驗，也不要拿舊不同 seed／bag-observer 的快 arena 當作現行可用方案。
