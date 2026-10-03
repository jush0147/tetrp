# Surge residual gate配置覆寫失敗與修正

Run37124362998在Rust candidate full-evaluator測試的第一個配置斷言失敗：`h3_surge_bank_value`實際0，預期0.5。編譯不是失敗點；snapshot tests成功，但完整candidate單位／release測試及20份search gate尚未通過。Arena/aggregate skipped，無強度樣本。

原因是prepare將`if cfg!(surge_residual) ... = 0.5`插在pending_safety初始化後，後面原本的`h3_surge_bank_value = 0.0`又覆蓋回0。是實驗注入bug，不是Surge公式或hypothesis失敗，也不是activation為零的實驗結果。

修正：明確圈定`review_h9_h12()`，將該方法內唯一bank初始化改為conditional assignment；其他profiles保持。拒絕同方法有多次bank assignment／重複install。Rust原斷言、全部correctness和charged top1 activation門檻不改。

本機新增覆寫順序regression、實際accepted source還原比對，12 tests通過；workflow在Rust編譯前也執行JS regression。Formula仍0.5×floor(bank×public next-lock multiplier)，pending不扣；原gate→200KO契約不變。新run另記dispatch，不重跑舊SHA，不等待或監看對戰。
