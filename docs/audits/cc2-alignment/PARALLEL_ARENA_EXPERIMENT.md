# Parallel native decision experiment

## 結果：通過並採用於後續 native 離線批次

Run 36859147183 完成，兩個 integration jobs 與 ntfy 均成功。下載後重新核對各 leg 的 serial/parallel reports、events 檔案 SHA-256 完全相同，筆數符合摘要；並核對新 serial traces 與前次已通過的 run 36851791560 native traces 也 byte-identical，避免 refactor 同時改掉兩邊而漏查。原始摘要保存於 PARALLEL_ARENA_RESULT_36859147183.json。

| 案例 | 本次 native serial | 本次 native parallel | 耗時減少 |
|---|---:|---:|---:|
| leg 0 | 19 分 19 秒 | 12 分 39 秒 | 34.53% |
| leg 1 | 18 分 43 秒 | 11 分 59 秒 | 36.02% |

兩案例計算時間合計 38 分 02 秒 → 24 分 38 秒，減少 35.26%（約 1.545×）。使用同一 job 中的 serial 作時間對照；不把不同 run 的 runner 速度混為因果收益。Workflow 約 32 分鐘是每 job 都做兩遍驗證的時間，不是未來每場需要 32 分鐘。

Correctness：3,257 次完整 decision reports、10,383 筆 authority events 零差異；每模式涵蓋 2,388 placements、869 Holds / reanalyses、210 full spins、140 minis、604 receives。四次執行全 KO；zero technical failures、fallback、rejected candidates、parity mismatches。包括攻擊生成／取消／垃圾交付、lock frame、clear 與最終狀態完全一致。此為執行效率證據，不加進強度樣本。

決定：達到事前 >=10% 門檻。後續固定 native artifact 的離線 arena 批次可開 parallelDecisions；generic match 預設仍 false，browser/PWA 不變。正式批次只跑 parallel，不逐場重打 serial/WASM。

成本更新：本次平均約 12.31 分鐘／場，200 場約 41.04 runner-hours。若假設平均能代表新 seeds、16 jobs 全程有效並行，理想排程約 2 小時 34 分；含 setup／排隊／長局拖尾的初步規劃抓 3–4 小時，不是保證或統計區間。只有一組 seed 的兩個座位案例，不足以可靠估計長尾。尚未 dispatch 200 場，也未改任何參數。下一步回 visible-T 固定樣本批次的配置與成本，不新增搜尋優化假設。以下為事前紀錄。

已由 commit `dfeac6330513d4e31b25fb0bce7a821486db02d3` 啟動 [run 36859147183](https://github.com/jush0147/tetrp/actions/runs/36859147183)，建立時 queued，尚無結果。本機 parallel timing / authority / protocol / scoring / publication 共 24 tests 通過。CI 完整 KO parity 與速度尚待結果，不持續輪詢。

2026-10-01。原串行決策不影響遊戲時鐘；它讓 seat 0、seat 1 的搜尋 wall time 相加。這次只把兩席的獨立決策與各自 Hold reanalysis 同時等待，保留 24-frame cadence、200k budget、兩邊同 seed、既有 authority transaction。

`parallelDecisions` 預設 false，只適用 tl-placement-v1。雙方 snapshots 仍先一起擷取；每個 task 只能更新自己的 Hold 狀態／plan。Promise.all barrier 後才允許任何 beginFrame、placement commit、outbox 收集與下一 frame garbage delivery。Hold 原有檢查保證不變更 attack／board／frame；不跨席讀 state。非同步完成順序不影響 arena record 順序：decision/Hold events 暫存並按 seat 0 → seat 1 flush，其他 authority event loop 不改。

兩個 native process 才能實際平行運算；prepare/normalize/authority 仍在 Node 主執行緒，不能宣稱整場二倍速。固定兩個座位案例，各在同 runner 分別跑 native serial / parallel 至 KO；leg 0 parallel 先，leg 1 serial 先。不重跑 WASM、不編譯新 bot、不減搜尋量。artifact 與 seed 沿用已通過 native gate 的版本及 2026093001。

完整 reports 依 authority decision 順序寫出，不依 CPU 完成順序。兩次 replay 的 reports、authority event stream 與終局摘要（排除 wall latency）須逐筆完全相同；所有原有 top-1、Hold reanalysis、spin/cells/lock/clear、zero fallback/technical failure gates 保留。若失敗保存 mismatch 和完整 traces，不能將結果混入強度樣本。此處 record callback 是唯讀 audit，不能依 async 完成先後修改 gameplay。

本機新增 tests：不對稱延遲且兩席實際 overlap；兩席 Hold reanalysis 後 frame 23.5 / 47.5 同時鎖定；攻擊在 frame 24 對稱送達；一方 throw 必須等另一方收束且停在 frame 0、零 placement。serial/parallel 全事件及結果相同。這不替代 CI 完整 KO gate。

workflow kiwi-parallel-arena.yml：兩個 jobs 並行、各 120 分鐘技術 watchdog、最後一次 ntfy；maxFrames=null，frame watchdog 技術失敗，不裁勝負。滿足完整 parity 且整場合計耗時減少 >=10% 才值得採用；若實測不達標，保留串行，不再為此掃排程參數。本次不啟動 200 場，參數順序 visible-T → H9-off → H1-off 保留。
