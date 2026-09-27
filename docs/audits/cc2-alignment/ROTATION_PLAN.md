# Rotation primitives：kick／180／history專項

不改規則或evaluator。新增diagnostic wrapper直接呼叫pinned CC2 private `rotate_cw/rotate_ccw/rotate_180`；未重寫旋轉規則。完整逐格與air-cache版本都執行，要求兩者結果相同，再比較Tetrp。

## 本機產生的564個條件探針

使用empty、既有T-spin fixture board、overhang三種board。枚舉合法當前pose（七種piece、四朝向、底部區域、fraction -.04／0／.1），按piece／方向／成功與否／kick／spin／history是否改變結果的signature選首個代表，不是頻率抽樣。每組對照totalRotations 0／30／31（目前lockresets15，kickY門檻30）。

- 188 signatures × 3 history counters，共564例。
- 150例180、60例authority kick3、含none/mini/full。
- 279筆屬於history會改變結果的三聯組，不等於279個獨立差異，更不是arena發生頻率。
- CC2 primitive沒有totalRotations或fractional-y輸入；只輸入occupied cells完全相同的integer pose。這正是要診斷的表示限制，不能虛構CC2有這些欄位。

這些是合法的**條件PublicSnapshot姿態**，不宣稱完整歷史已從spawn重建。逐例先要求輸入cells轉換一致，再比較rotate接受／拒絕、輸出cells、spin；kick index跨表示法不同，只保存authority provenance，不直接要求數字相等。

## 新辨識的authority邊界：單獨記錄

在10個整數y＋高rotation條件案例，Engine.rotate→slam(true)的結果與certificate intent完全相同，但certificate用`B.legal(y+1)`判斷仍能下降，拒絕認定landing。`fallProbes`在整數高度加入epsilon，使這兩個判準可能不同。

這10例保存`certificateError`完整details/provenance，不算certified placements，不消除、不混成CC2差異。其他未預期certificate錯誤立即technical failure。本輪比較的是rotation primitive；不修Engine/certificate、不宣稱一般arena可遇到此條件。後續需獨立確認可達性與contract。

## Actions gate

原43例movegen/cost與air-cache/shared-cache回歸仍必須全通過。兩Rust版本的564個primitive結果必須完全相同，否則是cache regression；對Tetrp的已量測rule差異允許輸出diagnostic報告，不能把job success當作parity。通知明列model mismatch及10例authority certificate discrepancy。Artifacts包含snapshot、primitive expected/actual、certificate/error、source hashes、coverage和mismatch表。

收到結果後一次修一類已證明規則差異；不因history欄位缺失就直接改全部movegen。Hold、spawn/clutch、DAG及browser仍待後續。Production未改，不開FT7。
