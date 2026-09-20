# Phase 4A handoff — Kiwi snapshot-v3.2

Updated 2026-09-21. Scope authority: `PHASE_4_PLAN.md` and its snapshot/progressive
reveal clarification. Phase 4A only: one local recommendation. No user-visible
continuation, bot execution, analysis timeline, or Phase 4B is implemented.

## Delivered behavior

Select the Kiwi image beside Next. Playback for the entire replay is paused before
analysis. A Place recommendation produces a lime outline. A Hold recommendation
says **建議 HOLD**, without a landing: Hold is a complete single-action recommendation,
not an error. Phase 4A does not execute it or automatically request its subsequent
placement. A future authorized continuation must execute Hold on an isolated branch,
refill NEXT 5 immediately for empty Hold, and analyze anew with Hold locked.

Clearing, seeking, scrubbing, starting playback, changing file/round/player, or PWA
update preparation invalidates the result and terminates Kiwi Worker. Clearing also
empties analysis DOM text. Replay checkpoints and persistence are unchanged. Static
program files stay cached for offline use; analysis data is never persisted.

## Exact artifact pin

| Field | Value |
| --- | --- |
| Repository / branch | `jush0147/cold-clear-2` / `kiwi-v1` |
| Product | `kiwi-v1-snapshot-v3.2` |
| Source / build commit | `2e243242b674d57491f99b445f75e35fc48a0e26` |
| Workflow | `35524225160` |
| Artifact | `kiwi-v1-browser`, ID `10608234222` |
| GitHub archive digest | `sha256:5f41edcd5f92165e4d77589e74bb47e926384c8d113fc927afd9552ec56aa3e8` |
| Upstream post-upload verification artifact | `10609269000` |
| Upstream authority fixture ref | `0b48cb7e1a50e5f0bba6fcfee05ba8e291bebee2` |
| Search budget | 200,000 evaluator nodes per request, early completion allowed |

The complete extracted artifact, including helpers, reports, licenses, notices,
and packaged E2E script, is in `vendor/kiwi-v1`. No Rust source is vendored. Upstream
verification checks 31 files excluding its own hash manifest; the local lock also
hashes that manifest. `scripts/verify-kiwi.js` checks the exact file set and every
hash on builds/tests. Vendor text conversion is disabled. The archive digest above
is GitHub metadata; extracted-file hashes were independently verified locally.

```sh
gh run download 35524225160 -R jush0147/cold-clear-2 -n kiwi-v1-browser -D .cache/kiwi-v1-browser-35524225160
```

Normal builds use the pinned local files and need no Rust or GitHub download.
MIT / Apache-2.0 licenses and upstream third-party notices ship in dist.

## Snapshot boundary and Worker architecture

```text
Frozen recorded Reconstruction in replay Worker
  -> direct allowlisted current visible projection
  -> UI request lifecycle / BotAdapter
  -> dedicated Kiwi Worker
     -> artifact validation and actual-root geometry enumeration
     -> artifact snapshot-v3 request
     -> packaged WASM analyze_snapshot_json
     -> Tetrp geometry validation and normalized Place or Hold
  -> viewer recommendation only
```

`ViewerSession.analysisState()` reads the current state directly. It never walks
source events, reconstructs an earlier prefix, or consults observed draw history.
`ObservedDraws` and the old SevenBag adapter integration have been removed.

The projection includes own board/current pose, Hold availability, exactly five
previews, current public rules/time/counters and allowlisted pending/ARE facts.
There is no replay checkpoint, raw event, hidden queue, RNG, opponent board, packet
sender/hole, or historical draw list in the Worker message. Private sequence state
is not needed for Phase 4A because no Hold or placement is executed.

The Worker creates an authority-shaped facade containing only that projection.
Both the expensive root-landing enumeration and WASM search happen there, using
unmodified artifact mapping helpers. Unsupported rules/packets are checked before
expensive enumeration. The facade does not generate pieces or advance gameplay.

`BotAdapter` retains monotonic generation and Worker-identity guards, including
error callbacks. New navigation terminates synchronous geometry/search immediately
at the Worker boundary. The existing 120-second watchdog remains. Identical repeated
Analyze requests may reuse the one result cached within the current Worker session;
no search DAG or result survives exit. Every actual WASM request builds fresh DAGs.

## Search and mapping

All roots use `analyze_snapshot_json`, including no incoming, pending incoming and
late multipliers. The old persistent/no-pending product split is superseded by the
upstream v3.2 contract. There is no call to legacy WasmBot, new_piece or play_json.

The request declares `bag_knowledge=unknown`, `unknown_tail=finite_visible`.
No full-bag substitute, bag remainder or piece-count-modulo inference is provided.
Search ends at known queue layers; heuristic leaves do not peek beyond NEXT 5.
This per-request horizon is not a limit on a future progressive-reveal continuation.

The artifact maps the 10x40 top-down board to bottom-up CC2 rows. Its exhaustive
geometry helper uses the complete current active-piece state, including fractional
y, rotation/kick/spin metadata. Occupancy maps using ceil(y). The legal root landing
allowlist constrains the first Place search layer; there is no top-K truncation.
Exceeding the upstream 250,000-state safety bound rejects explicitly.

Place is validated with the artifact path helper, then checked with Tetrp geometry
methods in a disposable sandbox using a fixed dummy seed and only visible previews.
The sandbox never locks a piece. Cells, collision legality and spin must agree.
The normalized result is `{action:{kind:'place'},move:{piece,x,y,rotation,useHold:false,cells}}`.

Hold is validated as an explicit action, including empty/occupied and same-piece
identity. It returns `{action:{kind:'hold',mode,samePiece,requiresReanalysis:true},move:null}`.
Hold-locked roots are now supported; the search cannot Hold again. Tests exercise
post-Hold re-analysis on isolated Engine clones; runtime Phase 4A does not execute it.

Public surge base/threshold, opener, all-clear, special bonus and clutch fields are
passed through. TL garbageare=5 and garbagearebump=12 retain their original values.
Clock and attack multiplier are included even with no pending. Positive pending
cannot silently fall back to no-pending analysis. Unknown activation stays explicit
null, with its amount and queue order retained. Kiwi evaluates three disclosed
timing hypotheses crossed with ten hole scenarios within the SAME 200k cap.
These are heuristic assumptions, not actual arrival times or probabilities.
Positive existing ARE and unsupported packet states still reject explicitly.

40L uses source_mode=40l / analysis_mode=competitive_stacking, neutral combo/B2B,
no pending and no TL attack clock. This is explicitly a competitive stacking
heuristic, not solo scoring recovery or sprint time optimization.

## PWA and privacy

Existing relative URLs, self-only hosting, WASM MIME and `wasm-unsafe-eval` CSP remain.
Geometry/adapter code bundles into Kiwi Worker; WASM, provenance and licenses are
pre-cached with the app. The Kiwi button image is also local/offline. No service,
remote inference, upload, account, analytics or analysis persistence was added.

`npm test` explicitly selects `test/*.test.js`, avoiding accidental execution of
upstream packaged E2E scripts by Node test discovery. The upstream E2E is run
explicitly with artifact and Tetrp paths when validating a release.

## Validation and performance

- 352 unit/replay/viewer/reference/PWA tests passed, none skipped. Local reference
  tests use bundled Python 3.12, matching CI; default Python 3.11 produces a
  different AST representation and fails the source-audit hash without a rule change.
- Production build and downloaded artifact exact-set/SHA-256 verification passed.
- Upstream run 35524225160 passed build, Chromium/WebKit Worker tests and a fresh
  downloaded-artifact E2E job. Unknown arrival was deterministic in both browsers,
  used 200,000 / 200,000 nodes and remained within the shared cap.
- Full Chromium/WebKit browser regression: 56 passed, zero failed/skipped (3.5 min),
  including real private replay, unknown-arrival recommendations, stale results,
  cancellation, PWA offline WASM and persistence/update checks. Timings below.
- Private replay audit: 21 streams, 2,541 positions, 62 sampled successful
  searches, 20 pending roots, 32 Hold recommendations, zero sampled rejections.
  Sampling stops at the first successful pending root; v3.1 skipped unknown
  activation until a later confirmed root, so pending samples differ between runs.
  Every result normalized and every recorded checkpoint remained byte-identical.
- TL JavaScript geometry: 0.198–0.936 s, median 0.492 s; WASM search:
  0.374–0.950 s, median 0.535 s. Two solo roots used 0.522–0.550 s geometry and
  0.684–0.825 s search. These are desktop local samples, not phone certification.
- Upstream's reproducible 11-fixture before/after comparison preserves the entire
  landing list, ordering, state counts and metadata. It includes all seven pieces,
  fractional non-spawn wall poses across the rotation threshold and an immobile spin.
  Complete enumeration remains; repeated landing/edge calculations are cached.
- Private reconstruction: 2,520 placements, 5,082 seeks, 2,541 forks; report hash
  exactly matches v3.1, including four known TL mismatch streams. No engine changed.

Worker timing excludes startup, WASM initialization, message transport and painting.
WebKit is desktop-host mobile emulation, not a physical phone. Geometry and WASM
both stay inside the dedicated Worker and navigation cancels them immediately.

Two synthetic replay positions at the default 200k cap (162,535 and 200,000 actual
nodes), measured in the full browser regression:

| Browser | Geometry | WASM search | Total |
| --- | --- | --- | --- |
| Chromium | 0.199–0.324 s | 0.566–0.597 s | 0.768–0.921 s |
| WebKit mobile emulation | 0.299–0.610 s | 1.012–1.143 s | 1.314–1.753 s |

The preceding v3.1 run measured 4.23–8.88 s total in Chromium and 7.68–12.96 s
in WebKit for these positions. Runs are not isolated device benchmarks; the
strict same-input geometry comparison is recorded separately upstream.

Local ignored evidence: .cache/v32-unit-final.log, .cache/v32-build.log,
.cache/v32-browser-final.log, .private-replays/v32-regression.json,
.private-replays/v32-analysis.log. Private replay files are never committed.

Reproduction: npm test (Python 3.12), npm run build, npm run test:browser;
scripts/validate-replays.mjs and scripts/validate-analysis.mjs accept local replay
paths. Browser private fixtures use TETRP_TTR / TETRP_TTRM. Public CI uses synthetic
fixtures only. Upstream 3,472 bounded rule fixtures are not full parity certification.

## Remaining limitations

- Actual-root preparation is much faster but remains board/pose-dependent.
  Pathological geometry can exceed the unchanged safety bound; no candidate
  truncation is silently substituted. No replay-history scan occurs.
- Geometry is not a frame/reset timing execution guarantee. Phase 4A displays only;
  future execution requires Tetrp authority timing validation.
- Pending is 24F/piece with ten assumed holes and approximate integer-frame timing.
  Exact ARE/bump, full opener double-cancel and complete clutch parity remain false.
  Positive existing ARE and unsupported packet states reject explicitly. Unknown
  activation is accepted, but the three timing cases are a bounded heuristic, not
  exhaustive independent packet timing combinations or calibrated probabilities.
- Empty Hold is searched independently, including same-piece Hold, but its newly
  revealed piece is unknown until execution. Information-gain optimization is false.
- Finite-visible search and root branch budget splitting differ from the old bot.
  Correctness checks establish neither equivalent strength nor a win probability.
- 40L is competitive stacking only. Blitz/custom rules outside the upstream contract
  remain unsupported. A rejection does not authorize changing canonical rules.
- Mobile WebKit is desktop-host emulation; physical-phone performance and installed
  PWA lifecycle still require device verification.

Stop at Phase 4A for review. No user-visible continuation or Phase 4B was implemented.
