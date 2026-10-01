# Runner CPU utilization and equal-work throughput

## 結果：有 CPU headroom，雙 worker 吞吐 gate 通過

Run 36863657491 成功，job 約 2 分 21 秒，ntfy 成功。下載後驗證每輪 48 requests、六輪共 288 timed parity checks、額外 18 warmup checks 的配置與完成路徑；三輪配對數據、CPU accounting 與收益計算一致。原始資料及摘要保存於 RUNNER_THROUGHPUT_RESULT_36863657491.json。

本 runner 為 Intel Xeon Platinum 8370C，OS availableParallelism / logical CPUs 均為 4，affinity 0–3；cpu.max 讀取為 null，不能據此斷言無任何 quota。可見 cpu.stat 的 throttled counters 沒有增加。

| 模式 | 同樣 48 requests 平均完成時間 | 平均 busy cores |
|---|---:|---:|
| 1 worker × 2 sequential copies | 20.695 秒 | 約 1.84 |
| 2 workers × 1 copy each | 15.802 秒 | 約 3.65 |

同量工作耗時減少 23.64%，吞吐約 1.31×，完整 report / action / certificate parity 全過。這不是把每次搜尋加快兩倍。三輪單 worker 總 CPU time 約 114.24 秒，雙 worker 約 173.11 秒（增加約 51.5%）；worker 互相競爭共享資源等是可能原因，此次未定位 CPU time 增加的唯一原因。

判定：後續批次值得採同 runner 兩個獨立 Node match workers，每個 match 兩個 native seat processes；每場仍是原有 snapshot-only、24 frames、200k、Tetrp authority 與 parallelDecisions。每場 latency 可能上升，但整批完成速度改善。兩個 match 必須完全隔離 engine / RNG / process / output paths，不能共用一個 pending native client。

這只是固定 snapshot workload，還沒量兩場完整 arena 同跑。不能直接把 23.64% 套上上一台 runner 的 12.31 分／場，宣稱 200 場已有實測新 ETA；正式批次仍保留逐場 correctness gates 與實際計時。此輪不掃更多 worker 數，不 dispatch 200 場，回到 fixed visible-T batch harness 配置；參數順序不變。以下為事前紀錄。

已由 commit `ba63c4eb654ce0641e80ae60366b943587d03812` 啟動 [run 36863657491](https://github.com/jush0147/tetrp/actions/runs/36863657491)，建立時 queued，尚無結果。Node protocol/publication 共 7 tests 與 script syntax 通過；Linux CPU accounting、固定 report parity、吞吐量待 CI。單次派送，不持續輪詢。

2026-10-01。使用者同意先確認 runner CPU 利用率。不是重新研究 evaluator 或減少 KO 樣本；200 場仍不派送。

## 固定短測試

單一 ubuntu runner，不重打整場。記錄 OS availableParallelism、logical CPU、型號、process affinity status、cgroup membership、cpu.max 與每次 trial cpu.stat。使用 /proc/native-pid/stat 的 utime+stime（getconf CLK_TCK 換算）與 Node process.cpuUsage，量工作程序合計 CPU seconds / wall seconds = average busy cores。非用等待時間猜利用率。CPU quota 資料僅限可見 cgroup mount，若無法讀取不能宣稱不存在配額；原始資料保留供判讀。

Baseline：一個 Node worker + 兩個獨立 native seat processes。每個公開 snapshot 同時呼叫 accepted、visible-T，各 200k；完整 prepare / search+IPC / normalize / authority certificate / deep parity 均執行。固定既有 12 snapshots，做兩遍，共 48 requests。

若回報容量 >2 且 baseline busy cores / 該容量 <85%，才測同 runner 兩個 Node workers，各兩個 native processes，每 worker 跑 corpus 一遍，共同樣 48 requests。否則停止並記錄沒有觀察到足夠餘裕，不盲目塞工作。每個 worker 都是獨立 process，避免把單一 Node 的 JS 排程瓶頸混成多場實作。

有餘裕時總計三輪、順序 1→2 / 2→1 / 1→2，288 timed requests；每個 worker 正式計時前完成 warmup。比相同總工作量完成的 wall time，而不是期待每場 latency 都下降。啟動／warmup／程序關閉不計入，IPC 與驗證計入。檢查完整 reports 對 run 36849221714 凍結 references，沒有浮點 tolerance；native binary 與 public corpus hashes 固定。

至少 10% equal-work time reduction 且全部 parity 通過才值得考慮採兩個 worker/runner。這是 snapshot workload 吞吐量，不是完整 arena，不直接據此保證 200 場 ETA。nativeClient 只新增唯讀 pid getter 供診斷，沒有改傳輸或搜尋邏輯。

一個 job、20 分鐘技術 watchdog，完成/失敗發一次 ntfy；不持續監看、不掃 3/4/更多 worker 數、不調參數。原參數順序 visible-T → H9-off → H1-off 不變。
