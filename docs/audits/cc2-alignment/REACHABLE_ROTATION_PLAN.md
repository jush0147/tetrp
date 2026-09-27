# Spawn-reachable rotation diagnostic

2026-09-27. Follow-up to HEIGHT_DOMAIN.md; no production change.

Hypothesis: the integer-height differences in run 36293876659 do not reproduce on generated spawn-reachable paths. Test actual CC2 rotation primitives against Tetrp on such paths, including the kickY rotation-history boundary. Do not change evaluator or gameplay semantics to force parity.

Local generator result: 43 source board/piece fixtures, 71,507 visited path prefixes, 1,746 selected rotation probes. 786 have history above 30, 120 exactly 30; 48 successful kick-3 probes; 487 attempted 180 rotations; none/mini/full outcomes present. Zero integer current heights, zero authority certificate disagreements.

Generation uses every prefix of the existing certified landing witnesses, with both the original path and a 32-clockwise-rotation spawn prefix. Counters are advanced through Engine operations. Each selected current pose is independently replayed from spawn and compared as a complete piece object; the path and every intermediate before/after pose are saved. A successful tested rotation is followed by slam and validated using the existing placement authority certificate.

Fourteen extra-cycle paths reject a subsequent operation. Their valid prefixes may supply probes, but rejected and subsequent poses cannot. The rejected path and operation are saved in rejected-extensions.json. Original certified paths are required to replay without rejection. No fallback placement or pose reassignment is used to bypass an unsuccessful path.

One witness is selected per source fixture/current orientation/direction/acceptance/kick/spin/history regime/vertical displacement signature. This is finite branch coverage, not exhaustive pose enumeration. Fixture boards are supplied (some synthetic); their full game history from an empty board is not certified. The paths use atomic placement geometry and do not establish physical input timing. No unknown queue is passed to the bot.

Actions builds the pinned CC2 full reference and air-cache candidate, compares both against the same 1,746 probes, and retains the 43-case complete placement/cost regression. The gate requires reference/candidate agreement and no cache-induced changes. Authority differences are diagnostic output, not a successful parity promotion just because the workflow is green. Notification and uploaded evidence report counts.

If differences remain, inspect exact path, authority result and Rust result before proposing any core change. If zero, retain this finite regression and proceed to the still-unverified Hold/spawn/clutch lifecycle; do not infer complete rules parity or launch FT7.
