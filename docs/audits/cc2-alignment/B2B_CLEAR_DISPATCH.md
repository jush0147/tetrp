# B2B clear 0／2 依序派送

2026-10-04，source `d001c11dfb35c0eb5d85b121753bc9a7ee83548c`。

1. [37187886430](https://github.com/jush0147/tetrp/actions/runs/37187886430)：btb-clear-off，back_to_back_clear=0。確認run／gate為in_progress後才送第二批。
2. [37187910625](https://github.com/jush0147/tetrp/actions/runs/37187910625)：btb-clear-double，back_to_back_clear=2。確認pending、jobs為空，同concurrency group等待第一批結束。

依B2B_CLEAR_PLAN.md各自gate→200新KO。只改當次B2B clear獎勵，從原accepted建立，其他係數與authority／cadence／資訊邊界不變。控制重用原accepted200局。各自ntfy完成／失敗；第一批失敗不繞過第二批自身gate。不輪詢對戰、無第5項queue、不自動promotion或追加。

本機15 checks含provenance、第二variant11 checks、實際accepted source安裝核對均通過；evaluator本體保持原樣，Rust模板展開無殘留。Rust與真實snapshot gate尚待Actions，不預先聲稱成功。所有結果下載需按run ID與manifest.variant識別，勿依共用surge-residual內部artifact名稱判候選。
