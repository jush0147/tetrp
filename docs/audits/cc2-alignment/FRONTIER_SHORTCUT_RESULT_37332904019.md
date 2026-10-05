# Frontier shortcut：不採用

2026-10-05 驗收 [run37332904019](https://github.com/jush0147/tetrp/actions/runs/37332904019)，source242b8bd2fb95cf7d96664f5356100bd788238752。Job success，1分52秒，ntfy step成功。CI success表示實驗完成，不代表工程門檻通過。

## 正確性與成本

- Rust snapshot tests：8 passed / 0 failed。
- 12固定public snapshots，200k nodes/request；warmup及三輪共96次完整report與凍結accepted WASM精確一致。支持此語料策略等價，不是對所有可能state的證明。
- 36組交錯timing本機重新加總一致。accepted總18,916.65ms，candidate18,814.75ms；平均525.46→522.63ms/request。
- 總時間下降0.5387%；三輪依次快1.0968%、慢0.3300%、快0.8466%。未達預註冊至少5%且三輪皆快門檻。未建立穩定／實用加速證據。
- 六個state較快、六個較慢；不能挑最快的5.69% case宣布成功。沒有重跑到通過或事後改門檻。
- 僅Linux persistent executable prepare/stdio/report延遲；不包含相同的authority後處理，也不是browser測量或KO棋力證據。

## 決定與推論邊界

不採用這個shortcut，production與accepted不變，不追加browser或arena測試。保留隔離實验代码作为紀錄。

先前82.21% frontier失敗是attempt比例，不是耗時比例。此候選只省掉最後一次advance，額外檢查也有成本；本結果不能證明整條失敗traversal成本低、也不能證明search結構已最佳，但足以否決本次小改動的採用。沒有新evaluator／weight依據，不將工程失敗解釋為棋力上限。

目前這条小型加速支線關閉；沒有派新工作。後續若提出其他候選，必須另有具體證據與固定成本假設，不能因本次失敗就任意改搜尋分配、增加預算或重啟tail。

逐state逐輪原始timings與summary保存於同名JSON；原始完整report、二進位與patch在run artifact，下載於`.cache/frontier-shortcut-37332904019/`。
