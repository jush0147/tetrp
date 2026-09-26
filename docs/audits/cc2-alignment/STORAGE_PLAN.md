# 40-bit storage 截斷：單項修正

候選在timing+queue基礎上只把上移後board.cols與garbage_rows截成40bit。對照queue-scan不變。原69fixtures保留，新增頂行9格garbage、cap8連續入場、第二行garbage被連續推出storage，共72例。Gate要求對照4差異、candidate0差異；四個storage案例之外的68個comparisons完整不變。

新增Rust tests：1/5/9格partialtop及garbage row標記截斷；10行跨兩手入場；另有明確命名的known-divergence characterization，檢查fulltop拒絕時原版先扣一行pending的行為仍存在。後者不是parity-pass test，不修正也不掩蓋這個獨立交易bug。

Authority側 `test/cc2-storage-boundary.test.js` 真正呼叫 `tank` 和 `pushLine`，fulltop拒絕時pending仍2、tanked0。這是transaction primitive邊界，並非可以在普通decision snapshot中保留uncleared fullrow的證據。Rust對照將直接呼叫Forecast.resolve檢查remaining1；不能混算進72個legal-placement suite。

本機：72個authority certificate/commit完成、4項targeted tests passed、三份patch順序apply-check通過。Rust新tests/paired gate由Actions執行；notification包含known limitation。未替換production，未做強度測試。

若成功，先保留clipping修正，再獨立處理failed-insertion的扣款順序，之後才進geometry/Hold/spawn。不能把72/72宣稱TL規則完整。
