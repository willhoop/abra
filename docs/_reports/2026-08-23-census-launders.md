# The census laundering ratchet — fixed, with the two-run demonstration

ENGINE, 2026-08-23. Files touched: `tests/test-mechanics.js` (the fix), `data/mechanics-census.json`
(regenerated). Nothing committed.

---

## 1. THE DEFECT, SHOWN BEFORE THE FIX

Staged by setting `directCall` on disk to `0`, so this run's true count of `1` reads as a regression.
That is the natural shape of the real event: somebody adds a probe that calls the mechanic directly.

```
run 1   FAILED: direct-call probes 0 -> 1   exit 1   ...and "wrote data/mechanics-census.json"
run 2   (no FAILED line at all)             exit 0
```

Nothing changed between them except that run 1 had happened. Run 1 wrote its own regression into the
field run 2 compares against. **Re-running the failing test is what made it pass** — on the artifact
that steers `engine/all_mechanics_fire.js`, that `engine/quarantine.js` reads for a MEDICHAM gate
clause, and that the whole-game differential pins as `steering.input_digest`.

Logs: `scratchpad/census-fix/before-run1.txt`, `before-run2.txt`.

## 2. THE RULE I CHOSE, AND WHY IT IS NOT GREEN-ONLY

The brief was right that "never write on red" is not automatically correct here, because this script
is the census's **producer** as well as its ratchet. Three classes, treated differently:

| class | example in this file | treatment |
|---|---|---|
| **instrument invalid** | `MEDFAILS.residualCollapsed` — the engine is under a deliberate break, so no row is evidence | **write nothing** (unchanged behaviour) |
| **findings** | a MISSING mechanic; a HOLLOW probe; a probe that arrived without arms | **publish**, stamped `run_ok:false` + `run_red` + `write_policy` |
| **the check's own floor** | `unarmed`, `directCall` | **monotone**: what gets written is `min(previous floor, measured)` |

So the artifact now carries the measurement (`unarmed`, `directCall` — which move in both directions,
because they are facts) and, separately, `ratchet.unarmed` / `ratchet.directCall`, which are the
baseline the next run compares against and which **no run can raise**.

Two reasons for monotone rather than green-only, in order of weight:

1. **Blast radius.** `unmodelled-clicks.json` and `tag-consumption.json` are their own baseline and
   nothing else reads them, so withholding costs nothing. The census has five readers. Withholding
   the whole artifact because one probe arrived without arms would silently change which scenarios
   `all_mechanics_fire.js` plays and how old the ENGINE headline is — this repo has paid for stale
   steering more than once.
2. **`min()` consults no verdict**, so it cannot be got wrong by a later edit that adds a check and
   forgets to gate the write. A green-only write is correct only while everyone remembers it is
   there — and that is exactly how this file got here: the `residualCollapsed` guard already said
   *"any future switch of the same kind belongs here"*, and the ratchet regression was not treated as
   one of them.

Supporting changes, all in service of the above:

- **The verdict is settled before anything is published.** The hollow check used to sit *after* the
  write and set `process.exitCode` there, so the artifact was stamped before its last check had run.
  `run_ok` would have been a lie. All reds now land in a `red` array; `process.exitCode` is set once,
  before the write.
- **`--accept`** raises a floor deliberately, prints both floors old -> new, stamps
  `accepted_from_red_run: true`, and **still exits 1**.
- **The legacy migration is loud.** A census predating `ratchet` carries its floors in the top-level
  (laundered) fields. They are read exactly once and the run prints a NOTE naming the field and the
  value. A silent default looks exactly like a working feature.
- Deliberately **not** `void: true`, for the reason `test-unmodelled-clicks.js` records: that hook is
  for a run invalidated by something else that must still publish, and using it here would trip
  provenance's void ratchet on every red run.

## 3. THE SAME DEMONSTRATION, AFTER

Same tamper, and deliberately from the **legacy pre-`ratchet` census** so the migration path is
exercised too:

```
run 1   NOTE: the directCall floor was read from the LEGACY top-level `directCall` field (0) ...
        FAILED: direct-call probes 0 -> 1                                            exit 1
        wrote data/mechanics-census.json — run_ok:false, and the ratchet floors are
        UNCHANGED (0/0). Re-running does not make this pass.
run 2   FAILED: direct-call probes 0 -> 1                                            exit 1
```

Artifact after run 1: `run_ok:false`, `run_red:["directCall 0 -> 1"]`, measured `directCall:1`,
`ratchet.directCall:0`. **The measurement published; the floor did not move.**

Logs: `after-run1.txt`, `after-run2.txt`.

Three more deliberate breaks, all shown red:

| break | result |
|---|---|
| `--accept` on the same red state | exit **1**, floors 0 -> 1, `accepted_from_red_run:true` (`after-accept.txt`) |
| a planted hollow row (`hollow.push({...})`, reverted) | exit **1**, `run_red:["hollow 1"]`, census still published `run_ok:false`, floors untouched (`after-hollow.txt`) |
| clean run | exit **0**, `run_ok:true` (`final-clean.txt`) |

## 4. THE GENERAL GATE — IT DROPS OUT ON ITS OWN

`node tests/test-red-run-writes.js`, unmodified, before and after:

```
before   scanned 387 files; 9 candidates
         READS-WHAT-IT-WRITES  tests/test-mechanics.js   mechanics-census.json
         ACCEPTED: LAUNDERS  ENGINE  tests/test-mechanics.js
after    scanned 387 files; 8 candidates
         FIXED since the floor was written (1): tests/test-mechanics.js
```

Gate itself: 15 passed, 0 failed, both runs.

It leaves the candidate set for two independent reasons, and the honest ordering matters: **no
failure signal follows the write any more** (every red is counted before it, which is the
`control-guarded.js` shape the gate calls "the fix shape"), *and* the write sits inside the
`residualCollapsed` if/else. The load-bearing part of the fix is neither of those — it is the
monotone floor, which kills the laundering whether or not a red run writes.

`'tests/test-mechanics.js'` is still in that gate's `ACCEPTED` constant. The gate prints it as FIXED
and stays green; the row should be removed by whoever owns that file. **OWED, not done** — it is
another agent's live file tonight.

## 5. CENSUS COUNTS

**643 probed / 643 live / 0 missing** before and after. `armed 643`, `unarmed 0`, `directCall 1`,
`threw 0`, `hollow 0`. New floors on disk: `ratchet {unarmed: 0, directCall: 1}`.
`engine/status.js` reads `643/643 probed mechanics live, 0 missing`.

No probe was added, removed or weakened. The only behavioural change to what the test CHECKS is that
the hollow red is counted before the write instead of after it.

## 6. DOES THE RULE GENERALISE TO THE FIVE UNDECIDED GENERATORS?

The rule is: **separate the floor from the measurement; write the floor as a monotone function of
(previous floor, measurement); let the measurement publish with `run_ok` unless the INSTRUMENT was
invalid.**

- `engine/format_audit.js` — exits `rows.length ? 1 : 0`. That is a **findings** exit by shape, so
  the write is already correct and the only thing missing is the declaration plus a `run_ok` stamp.
  The narrowest of the five. *Not confirmed by reading; not run.*
- `engine/all_mechanics_fire.js` — a producer whose artifact is read downstream, exactly like this
  file. Same treatment: publish with `run_ok`, and if it ratchets anything, split the floor. Five
  exits need reading to say which are findings. *Not read; not run — forbidden by the brief.*
- `engine/conformance.js` — same, but one exit is `--strict`-gated, so it may hold both classes.
- `engine/million_run.js` — driver; two exits ~1,400 lines after the write. Unread.
- `engine/tag_dex.js` — the tag derivation. `data/tags.json` is a producer artifact with more readers
  than the census, so this file's fix is the direct precedent.
- `engine/em_validation.js` — **the rule covers it only halfway, and that is worth saying plainly.**
  It has no floor, so there is nothing to launder (the `--check` read re-derives every verdict). Its
  real cost is *retention*: a failed run overwrites the last GOOD measurement. Stamping `run_ok`
  lets a consumer refuse the red artifact but does not bring the good one back. That needs either a
  green-only write or a kept last-good copy, and it is a different decision from this one.

## 7. OWED, NOT RUN

1. `node engine/all_mechanics_fire.js` — steered by the census, whose content digest moved. Brief
   forbade running it.
2. `node engine/wire_ladder.js` — provenance already calls `data/wire-ladder.json` UNSAFE, citing
   both `games.bo3.jsonl` (the ingest, not me) and `mechanics-census.json`. Pre-existing; now also
   cites this regeneration.
3. `node engine/status.js --write` — not run: it stamps `docs/ENGINE.md`, which another ENGINE agent
   holds tonight.
4. `docs/ENGINE.md` ledger line and the CHANGELOG entry — the coordinator's, by the brief.
5. Remove `'tests/test-mechanics.js'` from `ACCEPTED` in `tests/test-red-run-writes.js`.
6. `tests/run-all.js` — not run; it would start the scripts the brief ring-fenced.

## 8. PROPOSED ROADMAP ROW (for MEASURE to place — I did not edit ROADMAP.md)

> **The census ratchet laundered its own regression.** `tests/test-mechanics.js` read `unarmed` /
> `directCall` out of `data/mechanics-census.json`, failed when this run's number was larger, and
> then wrote this run's number into that field — so a run that grew the count failed once and was
> green on the re-run, on the artifact that steers `all_mechanics_fire.js` and holds a MEDICHAM gate
> clause. Fixed 2026-08-23 by splitting the FLOOR (`ratchet.*`, written as `min(previous, measured)`,
> can never rise) from the MEASUREMENT (publishes on red with `run_ok:false`). Two-run demonstration
> in `docs/_reports/2026-08-23-census-launders.md`; the file drops out of
> `tests/test-red-run-writes.js`'s candidate set (9 -> 8). CLOSED.
