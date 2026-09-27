# 空中路徑摘要候選

依run36291812974的工作量，先壓縮空中路徑，不重做CC2 DAG，也不恢復endpoint-only快路徑。

## 方法

底部向上座標的board最高佔用高度為H；保守boundary anchor y=H+5。僅當H+5<21啟用，否則完全維持逐格reference（含clutch）。已讀pinned `srs_plus.rs`：最大向下kick為2，rotated cell向下offset最多2，另保留probe餘裕；空中區域內的碰撞與empty board相同。Rust unit test鎖住此位移界線，未來kick改動必須重審。

每個piece/boundary，用現有CC2 move/rotate及逐格下降計算empty-air prefix的最小cost，摘要保留：

- 到達boundary的每個Placement及最小cost。
- 每組x/rotation的full-drop landing所需最小cost，以及cost+y的最小值（兩者不能互相取代；後者供grounded successor cost使用）。
- 空中各pose最小cost，避免重新展開已由摘要涵蓋的路徑。若從障礙附近以更低cost重入空中，仍照常展開，不能直接剪掉。

摘要用thread-local immutable Arc cache，key只有piece與cutoff，最多7×16個entry。沒有snapshot board、NEXT、Hold、history、RNG或未reveal資訊。空中prefix本身可能要花時間，因此不是宣稱每個單次request免費加速。

## 驗收與成本

43 fixtures：保留原39例，新增I/J各兩例H=15／16，跨啟用邊界。每個authority落點仍重播certificate。

同runner比較完整逐格reference與候選，必須逐筆placement、cells、spin、soft-drop cost全等；也要求與Tetrp集合一致。候選每個case先清cache測first call，另收集7×25暖樣本；再啟動獨立process、不逐case清cache，驗證跨盤面cache重用不改結果。保存冷啟動、暖樣本、shared entry數與payload bytes（不含allocator/Arc/HashMap overhead，不當成完整記憶體量）。

First-call時間只有單次測量，先作冷建表成本診斷，不拿它做穩定倍率結論。Shared run是額外parity檢查；完整逐格版相對Legacy的294筆既有cost差異不在本輪解決。

若成功，僅保留隔離的優化候選；需更廣泛geometry／spin專項及browser測量後才能接production。Actions完成／失敗ntfy通知，不盯場、不開FT7。

## 未來真實操作邊界（使用者已確認目前placement方向）

目前witness證明atomic placement模型中的合法路徑，不證明40×／無限soft drop、重力、lock delay、DAS/ARR條件下24frames可執行。未來新增timing-aware execution，使用同一Engine逐frame驗證；可以分為固定deadline可執行集合與可變落子耗時的真實即時對戰兩種contract。不可選完後silent fallback；可執行性限制必須進policy選擇。現在不擴張此scope，也不把soft-drop search cost當作真實執行frame數。
