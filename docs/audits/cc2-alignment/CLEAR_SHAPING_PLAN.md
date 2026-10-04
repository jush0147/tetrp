# 第3項：clear 類型 shaping 聯合消融

2026-10-04 使用者指示繼續下一步。B2B／Surge兩批驗收完成但效益未定，保持原accepted。此次只測normal／mini／full-spin三張額外reward表，不疊加Surge候選。

## 實際語意審查

以pin `2e243242b674d57491f99b445f75e35fc48a0e26`＋run36387270053的accepted patch為準。`src/bot/freestyle.rs::legacy_clear_reward`依spin與消行數選表，`evaluate`在accepted的`tetrio_s2=false`分支完整加入此edge Reward；不是board leaf，也不是Tetrp規則的攻擊表。

| 表 | 0消 | 1消 | 2消 | 3消 | 4消 |
|---|---|---|---|---|---|
| normal_clears | 0 | −2 | −1.5 | −1 | +3.5 |
| mini_spin_clears | 0 | −1.5 | −1 | fallback normal | fallback normal |
| spin_clears | 0 | +1 | +4 | +6 | fallback normal |

`lines_cleared`先clamp到4；spin表索引超出長度時fallback normal。這是程式邊界，不宣稱每一種組合都是可達落點。

同函式另加back_to_back_clear=1和離散combo_attack=1.5。PC=15，perfect_clear_override=true時略過三表、B2B clear與離散combo shaping，但後續精確sent reward仍會計入。wasted_t=-1.5在函式外另算，這次保留。因此不能將三表全零稱為取消所有spin偏好。

精確已送出攻擊透過`useful_attack_reward=1`另外計入；cancellation_reward=0，但取消會改forecast.pending與H1／後續board。Tetrp `src/attack.js::resolveAttack`依lines/spin算B2B／Surge／combo／normal／AC、取消與送出，與這三張evaluator表分離。清除幾何、Spin provenance、攻擊交易實作均不更動。

這些固定表具有與實現攻擊重疊的偏好，卻不依本次incoming/cancellation/opener/multiplier而調整。可能是有效的短horizon規劃proxy，也可能重複或扭曲精確transaction；source本身無法判定是否有用。關閉負數也會移除普通消行懲罰，不只是削弱Tetris／spin bonus。

## 唯一候選

`variant=clear-off`：normal_clears=[0;5]、mini_spin_clears=[0;3]、spin_clears=[0;4]。其他完整配置等同accepted：Boolean=.5、Surge/charge leaf=0、H1=1、H9=−.5、sent=1、B2B clear=1、combo shaping=1.5、PC15及override=true、wastedT=−1.5等保持。

只在review profile加受cfg控制的三表覆寫。Evaluator函式本體不修改，尤其不帶入Surge residual multiplier改寫。沿用既有workflow/runner的內部surge-residual檔名與cfg名避免複製arena，manifest.variant／完整config／planHash區分實驗；這些內部名稱不表示Surge功能開啟。

## Gate與200新KO

1. Rust default和candidate snapshot tests；輸出完整配置，預期只有三表不同。
2. 720個full-evaluator組合：spin三類×消行0–4×PC×PCoverride×combo0/2/5×B2B×terminal。核對三表的exact edge Reward delta（含fallback、PC遮蔽、terminal），同state leaf不變。這是合成數值單元測試，不當作720個合法局面。
3. 固定20個既有public snapshots（12perf＋8charged），rebuilt control與frozen accepted完整report一致；candidate top1/Hold/再分析及authority placement parity、空／非空Hold通過；至少1個top1改變。此機制不是charged限定，因此採全部20個的activation，不沿用Surge-specific charged activation条件。未通過就停止，不追加樣本到過關。
4. 成功自動200新candidate KO，重用原accepted200控制104–96，100blocks×兩座位，seed/cadence/budget/authority/parity契約完全沿用。compile與gate失敗不開arena。完成／失敗ntfy。

每局雙方同piece seed、24frames/placement、200k nodes、snapshot-only、Tetrp裁判、KO-only、zero fallback／failure／mismatch；无一般frame cap。simultaneous KO整block換seed重打，watchdog為技術異常不計；16runner×每runner兩局。只dispatch此候選，不queue第4項。Rust本機不可執行，交由Actions gate，不聲稱預先通過。

分析沿用100seed clusters的candidate-minus-accepted配對近似95% CI。舊control已觀察，探索比較非新獨立確認。不自動promotion或追加樣本，不以APP判勝。若有差異也只能歸因三表家族聯合移除，不歸因某一張表。下一項仍固定第4 B2B當次clear，再第5 Tetris井深；任何家族內拆分另寫假設，不自動掃參。
