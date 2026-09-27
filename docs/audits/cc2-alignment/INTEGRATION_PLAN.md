# Exact WASM artifact into the existing authority arena

2026-09-27. Continue after accepted browser run 36323060219. No evaluator changes, production replacement, or new gameplay engine.

Legacy means Tetrp's vendored `kiwi-v1-snapshot-v3.2`, source pin `2e243242b674d57491f99b445f75e35fc48a0e26`; it is not upstream original CC2. Corrected candidate uses that same source with the accepted authority-alignment patches. Both use the existing public snapshot adapter and 200,000 nodes per request.

Download the exact browser-tested artifact in Actions; require the recorded JS and WASM SHA-256 before import. Two continuous games, policy seats reversed in game two, a fresh seed each game and the same piece seed for both players within each game. Private hole streams remain separate. Both receive only detached PublicSnapshot and run at 24 virtual frames per placement. Use the existing placement authority and arena; no physical transport and no candidate fallback.

Each full game must reach authority KO. There is no ordinary frame cap. The 360,000-frame watchdog, policy error, unsupported contract, failed certificate, or parity error fails the integration gate; no technical result is scored. Simultaneous KO can finish a correctness transcript but awards no win. This two-game gate does not produce an FT7 score or promotion result.

Record every initial state, decision snapshot/top-1, validated provenance, Hold transition, actual lock/clear, incoming transaction and frame anchor to JSONL. Existing authority audits piece/pose/cells/spin/lock frame/clear; the runner additionally requires exact post-Hold current/Hold/NEXT5/frame agreement at reanalysis. Require each policy to accumulate at least 24 placements, one Hold reanalysis and one received garbage packet across the two games. Preserve partial evidence on failure and notify through ntfy. Do not automatically dispatch FT7 before reviewing the integration result.

Local validation: 15 existing placement-authority/arena tests pass. A separate `--smoke` harness run of two 48-frame prefixes completed 8 placements and 4 Hold/reanalyses with zero mismatches. These bounded prefixes are explicitly labeled local smoke and do not pass the KO integration gate; Actions invokes the uncapped mode. No garbage/KO claim follows from the local prefix test.
