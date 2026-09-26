# 單項修正：ready packet 掃描與扣除

對照為已通過的lock-timing版本；候選累加queue-scan.patch。每個tank slot搜尋第一個ready封包，扣該index，清空時保序移除。不修改FIFO cancellation、cap8、lock clock、attack或40bit clipping。失敗插入前已扣封包的歷史行為本輪亦未改；需後續另驗，不能宣稱failed-insertion parity。

驗收69個authority-certified fixtures：原65個保持相同，新增partial-middle、complete-middle、all-future、cancel-order。預期對照5個差異、candidate僅剩partial-storage-top。改善必須僅限兩個舊queue案例及兩個新middle案例，其他65個comparisons完全不變。Actions的queue gate以assert強制驗收，沒有新FT7。

Rust額外3個test functions：中間封包部分消耗且第二手接完；完全移除中間封包後繼續接後者；跨兩手後FIFO cancellation仍先扣未ready隊首，clear仍阻擋tank。另保留9項既有Forecast／timing tests。

本機69個fixture全部完成authority certificate與commit，比較器3 tests passed；兩份patch依序apply-check通過。Rust編譯、paired comparison及新增tests交Actions，完成／失敗透過既有ntfy通知。不替換production WASM。
