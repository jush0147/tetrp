# Parallel native decision experiment

2026-10-01。原串行決策不影響遊戲時鐘；它讓 seat 0、seat 1 的搜尋 wall time 相加。這次只把兩席的獨立決策與各自 Hold reanalysis 同時等待，保留 24-frame cadence、200k budget、兩邊同 seed、既有 authority transaction。

`parallelDecisions` 預設 false，只適用 tl-placement-v1。雙方 snapshots 仍先一起擷取；每個 task 只能更新自己的 Hold 狀態／plan。Promise.all barrier 後才允許任何 beginFrame、placement commit、outbox 收集與下一 frame garbage delivery。Hold 原有檢查保證不變更 attack／board／frame；不跨席讀 state。非同步完成順序不影響 arena record 順序：decision/Hold events 暫存並按 seat 0 → seat 1 flush，其他 authority event loop 不改。

兩個 native process 才能實際平行運算；prepare/normalize/authority 仍在 Node 主執行緒，不能宣稱整場二倍速。固定兩個座位案例，各在同 runner 分別跑 native serial / parallel 至 KO；leg 0 parallel 先，leg 1 serial 先。不重跑 WASM、不編譯新 bot、不減搜尋量。artifact 與 seed 沿用已通過 native gate 的版本及 2026093001。

完整 reports 依 authority decision 順序寫出，不依 CPU 完成順序。兩次 replay 的 reports、authority event stream 與終局摘要（排除 wall latency）須逐筆完全相同；所有原有 top-1、Hold reanalysis、spin/cells/lock/clear、zero fallback/technical failure gates 保留。若失敗保存 mismatch 和完整 traces，不能將結果混入強度樣本。此處 record callback 是唯讀 audit，不能依 async 完成先後修改 gameplay。

本機新增 tests：不對稱延遲且兩席實際 overlap；兩席 Hold reanalysis 後 frame 23.5 / 47.5 同時鎖定；攻擊在 frame 24 對稱送達；一方 throw 必須等另一方收束且停在 frame 0、零 placement。serial/parallel 全事件及結果相同。這不替代 CI 完整 KO gate。

workflow kiwi-parallel-arena.yml：兩個 jobs 並行、各 120 分鐘技術 watchdog、最後一次 ntfy；maxFrames=null，frame watchdog 技術失敗，不裁勝負。滿足完整 parity 且整場合計耗時減少 >=10% 才值得採用；若實測不達標，保留串行，不再為此掃排程參數。本次不啟動 200 場，參數順序 visible-T → H9-off → H1-off 保留。
