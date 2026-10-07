# 九局落點 .ttrm

使用者要求直接用 Tetrp 看整場，移動過程不重要。已將 run37616553558 九局轉成 `artifacts/aligned-vs-tetrp-2-7.ttrm`（22,641,465 bytes），比分2–7，固定對齊版左／內建版右。

採用明確標記 `stream.tetrp.format=placement-recording/1` 的 Tetrp 觀看格式，沿用 .ttrm 容器、既有播放器及preview renderer；不是官方TETR.IO鍵盤事件檔。普通replay的full anchor仍只做diagnostics，沒有改為覆寫authority。未更新的線上viewer不支援此格式；本輪已build本機Tetrp以交付觀看。無新對戰／seed修改／bot修改。

每手保存消行前實際落點（slot中間開始顯示，僅展示時序）及消行後authority盤面，Hold、current、NEXT5與stats；空的頂端buffer以topEmptyRows無損編碼縮減檔案。逐步按鈕切換落點／結果，正常play每24frames一手，scrubber仍按實際placement數。所有九局及結果保留。觀察資料不含可延續的RNG，Bot Mode禁止使用，不能把記錄盤面當真實checkpoint。

驗證：6328 locks全部核對原policy intent、cells、spin及certificate clear；18 streams全部point逐一通過ViewerSession board／Hold／NEXT／piece-count讀回，catalog比分等於原結果。30既有replay／viewer tests通過。Chromium真實開檔通過九局、雙方各5個preview、落點→消行後逐步、Round2/9切換，零pageerror；另已檢視截圖確認Tetrp原UI與圖形塊序。未聲稱官方TETR.IO客戶端相容。

重現：`node scripts/kiwi-export-placement-ttrm.js`。原始source預設`.cache/observation-result-37616553558`，audit在輸出檔旁。檔案屬本機產物，不將23MB replay加入git。
