# T-slot conditional geometry 與跨項估值

2026-09-29，本機離線；沿用 run 36551709585 已存 witness，不新增搜尋或 arena。

執行：`node scripts/kiwi-tslot-witness-audit.js`。輸出 [TSLOT_WITNESS_GEOMETRY.json](TSLOT_WITNESS_GEOMETRY.json)，包含來源 hash、重建 snapshot、合法路徑、spin provenance、clear result 與 feature 數值。

## 幾何檢查

每個 request 的 retained board-rewrite 列表，固定取第一／中間／最後一筆，共 12 例，僅驗證第一個 cutout。用 Tetrp PlacementArenaEngine 從 fresh T spawn 完整枚舉合法幾何落點，並用 validatePlacement 取得 certificate。

**12/12 模板 cells 有 full-spin 路徑；12/12 clear 行數與消行後 board 都和 Rust cutout 一致。** 沒發現此樣本內的虛假幾何模板。這不等於所有模板都正確。

條件：假設 T 現在可用、board 在取得 T 前不變。不是把未 reveal 的 T 提供給 policy。由 bitboard 重建占格，材料標為 j；沒有垃圾材料 provenance，因此只驗 cells/spin/clear，不驗 attack 或垃圾 bonus。仍是 atomic-placement 幾何，不證明 24-frame physical execution。

## 估值效果

對全部 429 個 quota-selected rewrite witnesses，以原有權重計算真實 board 和 cutout board 的 base holes、coveredness、well、height、transitions 差值，再加原 observer 記錄的 T-slot 項。

局部直接效果範圍 **+4.4 到 +22 分**。這包含多個相互影響的評分項，不能直接拿分數當 attack 或勝率。JS 診斷計算的 after-board 五項均與 Rust observer 階段差值相符（1e-3 只用於這項數學重算的 f32 rounding 檢查；決策 report parity 仍是 exact）。

此比較刻意固定 H1/H9、其他 reward、路徑與 search，因為原 evaluator 就在 cutout 前計算它們。不是刪除 cutout 之後重新搜尋、不是完整精確 f32 evaluator replacement，也不證明 root score 會同幅度改變。

quota samples 非均勻抽樣，不能以此估算所有實戰局面的效果分布。

## 對齊判定更新

- **幾何模板：這批有 authority 支持，沒有理由以「模板全是假的」刪除。**
- **資源供應：前輪已確認 synthetic bag.len<=3 會在 remaining queue + reserve 無 T 時給 cutout，不能作為已知資源依據。**
- **兌現時機：本轮的 fresh-T conditional proof 沒有證明等待 T、放中間幾顆或接垃圾後仍可完成。**
- **價值效果：會同時給模板獎勵與盤面改善，規模已量出；還沒證明有害、重要或沒用。**

因此目前具體待處理的是「T-slot 潛力何時可以用假想消行替代真實盤面來評估」，不是一個單獨 bonus 大小。

## 後續邊界

這批 source→runtime→conditional geometry 的取證已足夠，**不要再重跑同一批 observer 或擴大 arena，只為重複證明現象**。接下來應先提出局部處理方案，明確分開已知可用 T 與未知 tail 殘值，並說明哪些改動是資訊語意修正、哪些是需獨立驗證的策略假設。

不把「只計 visible T」自動當成最終正確 evaluator；未知 future T 仍可能有價值。也不把模板可達當成對手壓力下必然兌現。其餘 evaluator 機制繼續沿全項目清單審查，沒有被 T-slot 診斷取代。

本輪沒有 production/bot/evaluator 變更，沒有派發雲端工作。
