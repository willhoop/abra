# The ENCORE break re-aimed at the fixed engine; the board workaround removed (abra/regmc 1.22.0)

2026-09-26. SOLVER. Historical findings record, not maintained. Follows `docs/_reports/2026-09-27-prankster-dark.md` §5
(the red test ENGINE handed back) and `docs/_reports/2026-09-26-tiered-gates.md` (where the workaround came from).

## Verdict

- `solver/tests/test-gates.js` is GREEN, 42/42, every one of the 21 breaks red (exit 0). It was exit 3 (BLIND).
- The gate now calls Prankster Encore into a Dark body DEAD off the engine's own move result (`false` on the fixed
  engine), not off the target's board. The board reading (the `'effect'` purpose) is removed.
- The new ENCORE break is the engine's own knob, `MEDI_PRANKSTER_RESULT_TRUE=1`. It puts back the old wrong `true`.
  Under it the gate calls the Dark Encore LIVE, so ENCORE goes red. That is the proof that the gate reads the result.
  With the old board workaround restored, the same knob left ENCORE green (dead, `purpose effect`, result `true`). So
  the new break can tell the two gates apart.

## Why the workaround was removed, measured

`solver/doduo/eval_gates.js --release 4067de46a0ee --n 300 --seed 5 --workers 3 --out
solver/out/gates/4067de46a0ee/purpose-recheck-s5`. This is held-out Reg M-C, dataset sha256 `9d07c522…`, on the fixed
release, re-cut in this worktree with the same id. It gave 78 verdicts on board-read (`'effect'`) status clicks. The board
reading and the move result agreed on 77 of them. The one that differed was the board reading's error:

| decision | click | move result | board reading | what happened |
|---|---|---|---|---|
| `…2680989210` t49 | Milotic Hypnosis at foe slot 2 | live | dead | slot 2 was fainted. The move retargeted onto the live foe Milotic and put it to sleep (its board differs from the pass world). The board reading compared only the empty slot. |

There is no case left where the result says success and the effect is missing, so the workaround has no job. It had one
more exposure, the `#509` shield residual. `solver/mag/probe.js` still skips the worlds where a shield held, and the
SHIELDRES clause still covers that.

## What changed

- `solver/mag/purpose.js`: two purposes are left. `'flinch'` and `'result'`. `readVol` is gone.
- `solver/mag/gate.js`: `achievedWorld` reads `PU.achieved`. `targetDiff` is gone. The counterfactual pass steps are
  gone, so a status click costs one engine step a world instead of three.
- `solver/mag/probe.js`: `pos.readVol` is gone. It had no other caller.
- `solver/tests/test-gates.js`: ENCORE prints the engine's move result beside the verdict. The red loop's
  `['purposeresult','ENCORE']` becomes `['prankstertrue','ENCORE']`, which sets the engine knob in the child. The premise
  is still read on the board, apart from the result, so the knob reaches the verdict and not the premise.
  `purposeresult` still turns FAKEOUT red. The SHIELDRES fixture now draws from every status move. Its first pick is
  now Baby-Doll Eyes, and it is `untested` as required. `shieldcounts` still turns it red.

## Tests

| test | result |
|---|---|
| `solver/tests/test-gates.js` | 42/42, 21 of 21 breaks red, exit 0 |
| `GATE_BREAK=prankstertrue MEDI_PRANKSTER_RESULT_TRUE=1 … --no-red` | exit 1, only ENCORE fails (Dark Encore `live`, result `true`) |
| same, with the HEAD `solver/mag/{purpose,gate,probe}.js` | 42/42 green: the workaround hides the wrong result |
| `solver/tests/test-machamp.js` | exit 0. It needed `data/releases/eaa5becc54eb`, copied from the main tree because `data/releases/` is gitignored |
| `solver/tests/test-honest-info.js` | 1954/1954 GREEN. It needed the frozen pool's `*.jsonl`, hard-linked from the main tree |

## Not measured, stated

- The held-out survival and the SPRT figures of 1.19.0 were measured with the board reading on `eaa5becc54eb`. They
  stand as what they measured and are not re-run here. On 300 decisions the change moved one verdict of 78, and moved it
  the right way.
