# 為何 leg20/request493 從 Place 改成 Hold

來源：run 36566413689，對照 accepted observer run 36551709585。`scripts/kiwi-tslot-decision-audit.js` 只讀既存 artifact，輸出完整 PublicSnapshot、兩版全部 root 排名、配對節點分項與兩條 witness 到 `TSLOT_DECISION_AUDIT.json`。沒有新搜尋或對戰。

## 真實輸入與排名

Frame 8712；current T，Hold Z 且可用，NEXT=S/I/Z/O/J，沒有第二顆公開 T；combo=4，authority raw btb=1，5 行 active pending。兩版 Place/Hold 各 100k nodes、各 6 個 known layers，採相同 10 種 garbage scenario。不是增加 preview 或額外搜尋預算造成翻轉。

分數是搜尋後的 evaluator 排名單位，不是攻擊行數、勝率或完整 KO rollout：

| root action | baseline rank / mean | candidate rank / mean | mean 差 |
|---|---:|---:|---:|
| 原 top-1：T south x3 y5，no spin | 1 / -61.060 | 3 / -63.370 | -2.310 |
| occupied Hold，強制重新分析 | 2 / -61.330 | 1 / -61.470 | -0.140 |
| T north x8 y5，no spin | 4 / -63.340 | 2 / -63.360 | -0.020 |

表中落點使用 CC2 bottom-up 座標。原 top-1 的 Tetrp certificate 為 x3/y34/r2，0 clear、no spin；不是一個即時 T-spin 攻擊。Hold 並沒有立即放置或攻擊，報告使用的是 post-Hold 搜尋的最佳 placement 分數。

baseline 原落點只領先 Hold 0.270；candidate 的 Hold 領先原落點 1.900、領先新的最佳 Place 1.890。**翻轉主要來自原 Place 分數下降，並非新增 Hold bonus 或 Hold 得分上升。** Hold 在 candidate 的 worst score -75.1 仍低於原 Place 的 -73.5；排序依 mean 優先，不是 worst-case 優先。這也不能把 Hold 稱為已證明更安全。

## 資源機制：能直接確認的部分

Place root 必須先放 current T。之後 reserve=Z，remaining NEXT 沒有 T；不論後面怎麼 swap，都不能產生另一顆已知 T。因此此候選整個 Place 分支的 cutout 名額都應是零。Hold root 則先放 Z、把 T 留在 reserve；在真正消耗 T 之前，最多仍有一顆公開 T 可供估計。

每個分支實際執行的 100k 次非 terminal evaluate 統計：

| branch | baseline board rewrite | candidate board rewrite | baseline template-only | candidate template-only |
|---|---:|---:|---:|---:|
| Place | 935 | 0 | 2,755 | 0 |
| post-Hold | 390 | 24 | 3,692 | 334 |

這是各自搜尋訪問的節點數，不是相同節點的配對比較或獨立局面發生率。新舊搜尋路徑可能已不同。

兩個保留的 baseline witness 清楚顯示舊額度來源：

1. Place 分支 scenario 2、depth 5：路徑放 T→S→I→Z→O，reserve Z、只剩 NEXT J。synthetic bag={L,J}，`bag.len<=3` 給一次 cutout。局部效果約 +17.4，其中直接 T-slot +2、假想消行後的 board features +15.4。
2. post-Hold 分支 scenario 0、depth 5：路徑放 Z→T→I→S→O，reserve Z、只剩 NEXT J。T 明明已從 reserve 放掉，synthetic bag 仍含 T，因為 bag 追蹤的是 queue 消耗而非 reserve 消耗；加上 `len<=3` 共給兩次額度。此 witness 的 cutout 局部效果約 +18.2，其中 T-slot +2、board features +16.2。

這兩條是按固定規則選出的局部 witness，第一條的 root 也不是 baseline top-1。不能拿 +17.4 或 +18.2 去解釋 root 的 -2.31；局部效果是既有幾何分項算術，不是候選重搜的 winning continuation。

## 真正配對的節點證據與界限

使用 branch/scenario、完整 selected path、最終 placement、真實盤面、reserve／Hold／剩餘 queue／pending／sent／combo／B2B 等鍵，配對到 121 個相同上下文的保留節點。

- 121 個節點的 immediate reward 與 cutout 前六階段評估完全一致。
- 39 個 leaf score 改變，都在 post-Hold 分支，下降約 0.1～1.5。
- 例如 post-Hold scenario 0、depth 1，先放 Z，T 仍在 reserve：旧額度 2，候選 1；eval -73.300→-73.400，reward 都為 0，差異只在 T-slot 階段。這是同一局面避免把唯一公開 T 算兩次的直接證據。
- quota sampling 沒有保留足以逐節點解釋原 top-1 回傳值的整條最佳延續，也沒記各 scenario 的 root score。不能宣稱已把 -2.31 精確分解成 leaf 變動與 search reordering 各多少。

結論限於：候選確實按照公開資源執行既定假設；它會影響真實 root 決策，且影響不只有獨立 T-slot bonus。未知 T 不預支是否有利、是否過度留 T，以及對 KO 勝率的效果仍未證明。

## 處理決定

- 保留 accepted baseline；visible-T 候選封存為日後可單獨比較的機制候選，不 promotion、不調 tslot weights、不新增 Hold bonus。
- 到此停止為同一資源問題持續加 observer／跑同一批診斷。完整 root 歸因需要更多 instrumentation，但不是完成本輪參數語意盤點的必要條件。
- 下一項回到 H1 pending-safety 與 base board safety：列出同一盤面在不同公開 pending 下的有效懲罰，以及 cancellation 如何改變該項。先確認壓力倍率、重疊與單位，再決定是否有可識別的機制 ablation；不能先把重疊當作無用。
- 強度 promotion 仍只看後續公平 KO arena，本輪沒有強度結論。

附：一般 CI 修正 run 36566930087 已成功，之前的 publication allowlist 漏登記已解除。
