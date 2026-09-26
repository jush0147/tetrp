# Pinned Rust transition differential harness

2026-09-26。此輪新增離線診斷，不變更 production Kiwi／WASM／evaluator。

## 執行範圍

- CC2 固定 `2e243242b674d57491f99b445f75e35fc48a0e26`，Rust 1.90.0。
- Cargo 從該 commit 的 lockfile 起步，加入診斷 crate 後產生的完整 lockfile 隨 artifact 保存。
- 真正呼叫 `GameState::advance()`，其中的 `tetrio::attack`、`Forecast::resolve()`、`cancel_plan()` 原樣執行。
- 在 disposable checkout 增加只讀 Forecast getter，以及 attack／成功 tank 的 observer hooks。prepare script 要求正確 commit、乾淨 checkout、唯一插入錨點；instrumentation diff 與前後 hash 隨結果保存。沒有修改規則、呼叫順序、hash state 或 evaluator。
- `tools/cc2-transition-audit` 是 diagnostics crate，不接 production worker，不作 bot 決策。

## Fixtures 與 authority

65 個 synthetic conditional fixtures：empty O、single、double AC、quad、garbage quad、既有已驗證 full-spin single board；搭配 opener 第14／15顆、cumulativeSent 門檻、combo、Surge、base3、fractional multiplier、late clock，以及 activation 0/1/23/24/25 × holes 0/4/9。另有 inactive head 和 partial storage top 兩個反例。

所有 action 均經目前 `validatePlacement()`，並於 slot+23/.5 用 `commitPlacement()` 呼叫 Engine 真正 lock；不是另外寫 JS attack oracle。每個 fixture 保存 PublicSnapshot、action、完整 validated path/provenance、actual lock frame、clear、attack totals、public resulting state。

Rust 只收到 bottom-up public board/current+NEXT5/Hold/counters/rules、已驗證 landing 與明示 hypothetical scenario。seed、private checkpoint、piece history、真實 hidden queue、hole RNG 未傳入。oracle 固定假設洞位，與 Forecast 的 `(scenario+3*packetIndex)%10` 一致；這是 conditional transition 測試，不是提供 future 給 online policy。

比較欄位：完整64bit欄（包含非法超出40格的bit）、garbage row mask、clear/AC、spin/cells、combo/raw B2B、opener piece count、cumulativeSent、逐packet remaining/activation、elapsed、attack packet order、generated/cancelled/sent/tanked。Multiplier 額外保存數值差，容忍1e-12浮點算式差；整数attack必須exact match。

## 明確未驗證

第一版 input placement 的 spin／reachability 由 authority 證明，Rust transition 原本信任它；因此 spin/cells輸出相同**不代表 CC2 movegen provenance 正確**。未完整核對 CC2 Hold lifecycle、empty-Hold cursor、next spawn/clutch KO、DAG、terminal valuation、strategy fusion、strength。Driver output 對這些列 `unsupportedOutputs`，不偽造對等結果。所有測試根均為occupied Hold，避免把normalized reserve當成真正Hold輸出。

這是先建立 transaction 可觀測入口，下一步再擴到 geometry／Hold／spawn。不要把fixture中oracle的playing欄位與Forecast的toppedOut直接當同一KO定義。

## 本機驗證與遠端工作

- `node scripts/kiwi-cc2-transition-audit.js prepare .cache/cc2-transition-results`：65/65 authority certificates及commit完成。
- `node --test test/kiwi-cc2-transition-audit.test.js test/attack.test.js`：9/9 passed。Comparator測試故意改board、spin、packet順序、cancel、tank、B2B，確認會報差異；這不是Rust結果。
- 本機沒有可用Rust／WSL環境，編譯與Rust執行交 `.github/workflows/kiwi-cc2-transition-audit.yml`；完成／失敗ntfy `just_a_kiwi_for_tetrp`。
- 已推送 commit `1dec90dd9ed76802267b3107ffa23b627940f5e9`。[Actions run 36246453477](https://github.com/jush0147/tetrp/actions/runs/36246453477) 已完成並核對：58一致、7差異，分為4 clock、2 queue scan、1 storage clipping。詳見 [Rust結果與接續修正](RESULT_36246453477.md)，不要重複dispatch baseline。

Artifact含 `manifest.json`、`instrumentation.patch/json`、`Cargo.lock`、Rust版本、`input.jsonl`、`cases.json`、`rust-output.jsonl`、`comparisons.json`、`mismatches.json`、`summary.json`。

**Actions success只表示診斷完整執行，不表示模型parity。** 已知差異不讓蒐證job假裝失敗；程序錯誤、輸出遺漏／順序錯誤、driver rejection會使job失敗。通知明確寫mismatch數，不稱passed。這輪不修規則、不跑FT7；收到結果後先逐項確認真正Rust反例，再開始最小transition修正。
