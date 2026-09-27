# First corrected-Kiwi FT7

2026-09-27. Authorized after passing integration run 36323660039. Compare the exact WASM from run 36323060219 against Tetrp vendored Kiwi snapshot-v3.2. Keep evaluator and 200k nodes/request unchanged. This is not a match against upstream original CC2.

Reuse the integration runner and its full snapshot/intent/provenance/lock/Hold-reanalysis logging, adding `--ft7`. First policy to seven KO wins; simultaneous KO awards no point and advances to a fresh attempt. Every attempt shares the piece seed across both seats, uses fresh seeds beginning at 2026092801 (increment four), and alternates policy seats. Hole streams remain private and distinct. Placement cadence is 24 virtual frames for both policies; computation time does not advance gameplay.

No gameplay frame cap. Watchdog 360,000 frames, invalid top-1, unsupported rule, certificate/parity failure or runner exception aborts the series and awards no point for the failed attempt. Local `--smoke` cannot combine with `--ft7`. The Actions 340-minute step timeout is infrastructure failure, never a match adjudication; partial artifacts and a separate notification job are retained.

No tuning or candidate rebuild during this series. Review raw correctness before treating its KO score as strength evidence. One FT7 is an initial measurement, not sufficient by itself for promotion. Production WASM remains unchanged.
