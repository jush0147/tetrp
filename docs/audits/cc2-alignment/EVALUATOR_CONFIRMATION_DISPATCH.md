# 兩批 CC2-based 直接確認：已派送

2026-10-05 Asia/Taipei（UTC 2026-10-04）。source `67ab40a2ce43706ec916ca764115eade3862afa9`。

1. [37215234239](https://github.com/jush0147/tetrp/actions/runs/37215234239)：well-double，井深0.6直接對accepted0.3。確認gate in_progress、JS契約tests成功後送第二批。
2. [37215267052](https://github.com/jush0147/tetrp/actions/runs/37215267052)：clear-off，三張清行額外獎勵表off直接對accepted原表；井深仍0.3。確認pending、jobs空，與第一批相同source commit。

兩批各200新KO，所有bot都是aligned CC2-based Kiwi，非失敗的Native v0。相同concurrency group依序執行，各自先過public authority與雙執行檔smoke gate；不是重用舊104–96控制。完整預註冊在[EVALUATOR_CONFIRMATION_PLAN_2026-10-04.md](EVALUATOR_CONFIRMATION_PLAN_2026-10-04.md)。

完成或失敗ntfy `just_a_kiwi_for_tetrp`。停止人工監看，不新增第三批／其他權重／合併候選，不自動promotion；等使用者回報結果後驗收。舊盤點已結束，本次是授權的兩個獨立確認假設。

本機12+7 tests與4 provenance checks通過；原clear-off artifact metadata另外核對成功。Linux真實gate待Actions，不預先宣稱通過。Push註冊事件不執行gate或arena，正式任務皆workflow_dispatch。

驗收時下載 `evaluator-confirm-result` 與 `kiwi-evaluator-confirm-build`；核對manifest.variant／PLAN.source／兩方SHA／配置，所有100pairs完整、KO與parity、sim-KO重試、cluster CI及exact p≤.025判準。兩個原binary source run分別37200443114／37173465050；本次gate.manifest.nativeRun是本次run，source-manifest保留原build身分。
