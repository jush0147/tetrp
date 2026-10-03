# wasted_t off — reused accepted control, 200 new KO games

2026-10-03 user authorized beginning this single candidate. No other evaluator experiment is dispatched. Only `review_h9_h12.wasted_t` changes from -1.5 to0; H1=1, H9=-0.5 and all other configuration stay accepted. Conditional override is isolated in BotConfig; gameplay/search expressions are unchanged.

## Meaning and gate

Current evaluate adds wasted_t to immediate Reward when piece=T and (lines<2 OR spin is not Full). Thus TSS, mini, ordinary T placement are penalized; full double/triple are not. The expression is outside the legacy PC override. It is a strategic opportunity-cost proxy, not authority attack or a factual claim that the placement wastes T.

CI compiles default and candidate, runs existing snapshot tests plus full-evaluate same-state Reward delta tests across T/I, none/mini/full,0–4 lines, PC/non-PC. Synthetic combinations test the expression, not placement reachability. Expected difference is +1.5 only under that predicate; leaf Eval unchanged. Full configuration diff must be exactly wasted_t. Twelve existing public snapshots compare rebuilt default reports against frozen accepted and validate candidate top-1 through authority, including Hold reanalysis and explicit empty/occupied Hold modes. Require real candidate score and top-1 activation or stop before arena. Preserve reports and certificates for review.

## Reused controls and interpretation

Control source run37026070707, commit8ddce9287e61d5126e076f40346e6887dfb02c08, `h1-common-result/result.json` SHA2569048e891641b0eac202d8a242d1efca25f795a15cff79d9c275ed76133aba992. Full original aggregate recomputed, zero retries required. Reuse **all** accepted games (legs0/1) across100 blocks, score104–96; never use H1-off games as controls or choose favorable seeds.

Verify committed src/vendor/referee/client/pool/original harness/scoring files unchanged versus that commit. Frozen accepted native hash and Legacy JS/WASM checked again, identical node budget/seed/seat/virtual cadence/referee. Local reuse check passed before dispatch. CI repeats it, with full Git history.

This is a prespecified follow-up on an already observed benchmark, not fresh independent confirmation. Candidate selection uses the documented wasted-T mechanism question; no seed selection, score-dependent extension or weight search. Report paired candidate-minus-accepted KO win-rate difference with the same100-cluster t approximation. A weak/null result is uncertain, not equivalence. A positive result is not automatic promotion; benchmark reuse limits independent-confirmation claims, especially if many later candidates share it.

## Execution

-100 blocks, seed2026160001+100*block. Candidate plays Legacy in both seats: **200 new games**. Identical shared piece seed within each game; seat hole seeds+1/+2. Legacy is original vendored Tetrp Kiwi snapshot-v3.2, not stock CC2.
- Reuse existing H1 common arena logic in the isolated wasted runner:24frames/placement,200k nodes, parallel decision barrier, snapshot-only, Tetrp placement authority, no fallback, all mandatory parity/transaction checks. No shadow double analysis in arena.
- No gameplay frame cap. Single KO only;360000frame watchdog/timeout is technical, unscored and makes batch incomplete.
- If a candidate game simultaneously KOs, the original control seed cannot remain paired with a replacement seed: archive that whole block attempt and rerun both accepted and candidate in both seats at the existing prespecified seed+4*attempt, at most25attempts. This exceptional path adds games beyond the nominal200; no normal control reruns. All controls in retry attempts use the frozen accepted binary, with full audit.
- Gate succeeds →100jobs, max16runners,2candidate games per runner. Same80min step/90min job technical limits. No repeated Rust builds per runner. Full traces3days; summary/build/control evidence30days. Every25placements saves progress.
- Aggregate checks exact reused game objects against the pinned original file, all new identities/commit/settings/parity, and complete paired blocks before statistics. Gate failure or terminal aggregate sends ntfy once to `just_a_kiwi_for_tetrp`. No polling, automatic follow-on or promotion.

Local verification:25 targeted tests (plan/retry/scoring/transform, original plan, parallel barrier and placement authority), plus actual full control-file revalidation. Rust/build/report/activation checks must run in CI; not claimed passed locally. Bot production and unrelated working changes untouched. Dispatch ID recorded separately.
