# Two independent matches per runner

2026-10-01。承接 throughput probe run 36863657491：4 邏輯 CPU runner 的固定 request workload 用 2 workers 比 1 worker 省 23.64% wall time，但不是完整 arena 證據。使用者要求繼續，因此把固定二 worker 接入實際 match integration。

## 最小實作

`runMatchPool` 固定上限二個 in-flight tasks，空出的 lane 接下一個 task；結果保持原 task 順序。一個 task 技術失敗後不再分派新工作，等待既有工作結束保存診斷，整批失敗。這次只有兩個已知歷史 cases，沒有建立 200 場 seed manifest 或派送強度任務。

一個 runner 起兩個獨立 Node child processes，每個沿用已驗證的 `kiwi-native-arena.js`，各自擁有 Engine/RNG、兩個 native seat processes、PublicSnapshot、report queue、獨立 output directory。gameplay authority、parallelDecisions、24 frame cadence、200k budget、KO only、no fallback 保持原樣。profile binaries hashes 不變。

`--parallel --single` 只執行 native parallel 一次，不重打 serial/WASM。仍是 seed 2026093001 的兩個交換座位案例。結束後用 repo 已保存 run 36859147183 的 trace hashes 和終局摘要核對：完整 reports/events 必須 byte-identical，counts/result 除 wall latency 外完全相同。參考資料只在終局後讀取，不進 policy。所有舊 per-match top-1、Hold、spin/cells/lock/clear、technical failure gates 保留。

新 CLI 只供這兩個 replay-equivalence cases，generic 200 場 harness 尚未完成，不冒稱已有可直接啟動的全批。最小 pool tests 驗證二 lane bound、一次分派、異步結果排序、失敗後停止分派與等待其他 in-flight 工作。

## 執行界線

workflow `kiwi-two-match-integration.yml`：單一 runner、90 分鐘技術 watchdog、兩場真實 KO 同時執行，完成/失敗一次 ntfy，不持續監看。資料公開且只供 integration，不添加強度樣本；frame watchdog 或 process/job timeout 都不裁勝負。

此次驗證雙場隔離與完整 correctness，記錄整個 pool wall time；没有再跑一份同機 serial-matches baseline，因此不能把不同 run 的耗時差當作精確雙場加速比。未來估計 200 場時間只能把本次當新觀測並保留長局／機型變異，不能宣稱保證 ETA。不再掃第三／第四 worker。參數主線 visible-T → H9-off → H1-off 保留。
