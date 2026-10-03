# B2B leaf-off gate dispatch

- Run: [37105409459](https://github.com/jush0147/tetrp/actions/runs/37105409459)
- Source: `ad4aefebda30c9d41ce2a5698ef0150dd6f85aad`
- 確認已in_progress；不持續監看，等待使用者收到ntfy後回報。
- [審查及固定假設](B2B_INVENTORY_REVIEW.md)：只改has_back_to_back 0.5→0。
- 一個40分鐘上限gate job：control/candidate Rust tests、67份public snapshot完整baseline report與candidate authority／Hold／activation。
- 本機6項targeted checks通過，10個authority transaction witnesses通過，actual accepted-source transform通過。Rust尚待此run，不聲稱已通過。
- gate成功／失敗均ntfy `just_a_kiwi_for_tetrp`；沒有自動arena、没有其他參數排隊。
- 分開觸發的標準repo CI：37105409437；不是另一場實驗。
