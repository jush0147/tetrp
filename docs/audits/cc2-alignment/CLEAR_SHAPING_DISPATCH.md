# 第3項 clear shaping-off 派送

2026-10-04：[run37173465050](https://github.com/jush0147/tetrp/actions/runs/37173465050)，title `Kiwi evaluator clear-off — 200 KO`。

- Commit `caa64a4c5b5fca8b8d701f5c9b4bf461cecf3c41`，dispatch `variant=clear-off`；確認run／gate為in_progress。
- 按 [CLEAR_SHAPING_PLAN.md](CLEAR_SHAPING_PLAN.md)：只關normal／mini／full-spin三表；保持原accepted其他配置，無Surge residual改寫。
- 本機14 checks通過；在實際accepted source上試安裝，確認evaluator本體byte-identical，附加clear專用Rust tests。Rust／20public snapshots gate仍待Actions完成，未聲稱通過。
- Gate成功自動200新candidate KO，重用accepted200控制；每局同piece seed、24frames、200k nodes、Tetrp authority、snapshot-only、KO-only、zero fallback/parity mismatch。
- 沿用既有workflow與artifact內部surge-residual名稱，結果必須核manifest.variant=clear-off與完整配置／planHash；不能只看artifact名字認候選。
- 完成／失敗ntfy通知just_a_kiwi_for_tetrp，不持續監看。未queue第4項，無自動promotion或追加測試。
