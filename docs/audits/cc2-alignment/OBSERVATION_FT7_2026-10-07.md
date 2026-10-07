# Aligned Kiwi vs Tetrp 內建 Kiwi：觀察用 FT7

使用者明確要求生成一場 FT7，觀看 skim／斷 B2B。這是新授權的觀察賽，不恢復已停止的 evaluator 研究或調參。

## 凍結兩版

- Aligned：run36849221714 的 `snapshot-accepted`，SHA256 `386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb`。與上一批 residual experiment 的 accepted 控制相同，**不採用 residual／visible-T／任何失敗候選**。native 指 Rust executable，不是 Native Kiwi v0。
- 內建：repo `vendor/kiwi-v1/pkg/cold_clear_2_bg.wasm`，SHA256 `af7849aa18649ebeca5e0af411499f6dc16afcdbc35ea4e094b2abffce59fa95`；Kiwi snapshot-v3.2，非原版 CC2。viewer worker 仍 import 此套 vendored kernel；本輪沒有部署或改它。

兩者不是同一 binary／rule model。對齊修補包括既有 timing／garbage transaction、spawn lifecycle 與可達 movegen 的差異，詳見 handoff 歷史測試；未知 future 與 garbage scenario 仍是假設，不宣稱完整 frame-accurate TL 雙人預測。相同權重也可能因 transition／候選集合不同而選招不同；本場只有小樣本觀察價值，不保證強度提升。

## 規格

一場先到7勝；新 base seed2026100701，每局+4，兩方同 piece seed、hole seeds為seed+1/+2，按實際局次換 seat。24 virtual frames/placement、200k nodes、snapshot-only、authority validated direct placement、無fallback、Hold後reanalysis。雙方各自進程分析，frame／攻擊交易等兩邊完成後才推進。

單方KO才給分，simultaneous KO不計分用新seed重打。technical failure／unsupported／certificate mismatch／360000frame watchdog 中止整場；無一般 gameplay frame cap。50實際局的系列技術watchdog與Actions job timeout皆不裁定遊戲勝負。

兩seat各48frame smoke是無計分correctness檢查，通過才FT7。FT7獨立重新初始化與覆寫smoke輸出。獨立21項本機tests通過：authority、clock barrier、計分、process protocol、HTML多round及seat mapping；實際Linux雙kernel smoke在Actions執行，不冒稱本機已測Linux binary。

## 交付

- `watch.html`：單檔離線觀看，所有rounds、逐手／播放、消行前落點切換、跳到B2B>0時的普通1–3行消除。標記只供定位，不宣稱失誤。直接畫authority snapshots，不重模擬鍵盤。
- 每局events與完整reports JSONL：PublicSnapshot、所有ranked candidates、authority證明、actual parity、private anchors供事後audit。private anchors永不傳入policy。
- `result.json`：版本hash、每局KO與score、parity／Hold計數、technical dumps。

不偽裝成.ttrm：既有 exporter只接受physical-input-v1，強制用它會改變此次測驗語意。新HTML無正式viewer修改，不加入TBP／real-time transport。

單次GitHub Actions，完成或失敗送ntfy `just_a_kiwi_for_tetrp`，不持續盯跑、不自動追加。workflow push僅註冊，真正FT7需一次dispatch。

## Dispatch

2026-10-07 已啟動 [run37616553558](https://github.com/jush0147/tetrp/actions/runs/37616553558)，source `8e912e725e745411a51590f5aa64b5d5c5dbefe8`。首次查詢 queued；尚無比賽結果。push run37616532028只註冊workflow，沒有執行arena。Artifact名稱 `kiwi-observation-ft7-37616553558`。

啟動確認：artifact下載、21項tests、兩seat smoke均success；2026-10-07 11:48:22 UTC進入正式FT7。此後不監看，等待ntfy。dispatch紀錄後續只保存在本機docs commit，不改此次source。
