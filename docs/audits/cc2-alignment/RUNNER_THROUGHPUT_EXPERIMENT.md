# Runner CPU utilization and equal-work throughput

已由 commit `ba63c4eb654ce0641e80ae60366b943587d03812` 啟動 [run 36863657491](https://github.com/jush0147/tetrp/actions/runs/36863657491)，建立時 queued，尚無結果。Node protocol/publication 共 7 tests 與 script syntax 通過；Linux CPU accounting、固定 report parity、吞吐量待 CI。單次派送，不持續輪詢。

2026-10-01。使用者同意先確認 runner CPU 利用率。不是重新研究 evaluator 或減少 KO 樣本；200 場仍不派送。

## 固定短測試

單一 ubuntu runner，不重打整場。記錄 OS availableParallelism、logical CPU、型號、process affinity status、cgroup membership、cpu.max 與每次 trial cpu.stat。使用 /proc/native-pid/stat 的 utime+stime（getconf CLK_TCK 換算）與 Node process.cpuUsage，量工作程序合計 CPU seconds / wall seconds = average busy cores。非用等待時間猜利用率。CPU quota 資料僅限可見 cgroup mount，若無法讀取不能宣稱不存在配額；原始資料保留供判讀。

Baseline：一個 Node worker + 兩個獨立 native seat processes。每個公開 snapshot 同時呼叫 accepted、visible-T，各 200k；完整 prepare / search+IPC / normalize / authority certificate / deep parity 均執行。固定既有 12 snapshots，做兩遍，共 48 requests。

若回報容量 >2 且 baseline busy cores / 該容量 <85%，才測同 runner 兩個 Node workers，各兩個 native processes，每 worker 跑 corpus 一遍，共同樣 48 requests。否則停止並記錄沒有觀察到足夠餘裕，不盲目塞工作。每個 worker 都是獨立 process，避免把單一 Node 的 JS 排程瓶頸混成多場實作。

有餘裕時總計三輪、順序 1→2 / 2→1 / 1→2，288 timed requests；每個 worker 正式計時前完成 warmup。比相同總工作量完成的 wall time，而不是期待每場 latency 都下降。啟動／warmup／程序關閉不計入，IPC 與驗證計入。檢查完整 reports 對 run 36849221714 凍結 references，沒有浮點 tolerance；native binary 與 public corpus hashes 固定。

至少 10% equal-work time reduction 且全部 parity 通過才值得考慮採兩個 worker/runner。這是 snapshot workload 吞吐量，不是完整 arena，不直接據此保證 200 場 ETA。nativeClient 只新增唯讀 pid getter 供診斷，沒有改傳輸或搜尋邏輯。

一個 job、20 分鐘技術 watchdog，完成/失敗發一次 ntfy；不持續監看、不掃 3/4/更多 worker 數、不調參數。原參數順序 visible-T → H9-off → H1-off 不變。
