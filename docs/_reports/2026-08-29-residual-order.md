# G1 AND G2 ARE TWO FIXES, NOT ONE — AND `data/residual-order.json` ALREADY CARRIED BOTH ORDERS, SO NEITHER NEEDED A BYTE OF DATA

**2026-08-29/30. ENGINE. Both landed, both probed, both shown red under their own knob first.**

Verdict block:

| | before | after |
|---|---|---|
| census (`data/mechanics-census.json`) | 806 probed / 806 live / 0 missing | **808 / 808 / 0** |
| empirical protocol-diverged games | 199 of 961 | **191** |
| empirical board-parted | 84 of 961 | **84 — unmoved, as predicted** |
| `ordering` class, games | 53 | **43** |
| end-state verdicts | 903 / 55 / 2 / 0 / 1 | **903 / 55 / 2 / 0 / 1 — identical** |

---

## 1. ONE FIX OR TWO — MEASURED, NOT ARGUED

The brief asked this first because tonight C2/C3 looked like one cause and were two. **They are two,
and the measurement is a 2x2 over the two knobs on one staged board per defect.**

```
                       G1 board (mixed chips)            G2 board (perish + tailwind)
  neither knob         psn psn brn brn      CORRECT      perish x4 then -sideend     CORRECT
  MEDI_STATUS_ONE_STEP brn psn brn psn      WRONG        perish x4 then -sideend     CORRECT
  MEDI_PERISH_AT_FOOT  psn psn brn brn      CORRECT      -sideend then perish x4     WRONG
  both                 brn psn brn psn      WRONG        -sideend then perish x4     WRONG
```

Each knob moves its own defect and leaves the other board byte-identical. The same separation shows
in the census: `MEDI_STATUS_ONE_STEP=1` takes `condition/residualStatusOrder` MISSING and leaves
`condition/residualPerishStep` LIVE, and the reverse holds. They share a table and they do not share
a cause — G1 is one entry split in two, G2 is a step that was not in the table at all.

## 2. THE ARTIFACT ALREADY HAD THE ORDERS. BOTH FIXES ARE DATA-FREE.

`data/residual-order.json` (generated 2026-08-14, 90 rows, derived by calling `Battle#resolvePriority`)
publishes `status:psn` **9**, `status:tox` **9**, `status:brn` **10**, `condition:perishsong` **24.2**,
`expiry:tailwind` **26.5**. Not one number was written or changed. The whole of both fixes is the
STEP MAPPING in `RESIDUAL_GROUPS`' `MAP` plus the two walk sites that read it.

Cited to source rather than to the artifact as well, because the artifact is generated and a
generated file is not a fact until something compares it to its source: `data/conditions.ts` declares
`brn.onResidualOrder: 10` at `:15`, `psn` at `:133` and `tox` at `:154` both 9; `data/moves.ts:13270`
declares `perishsong.condition.onResidualOrder: 24`. **Champions overrides none of them** —
`data/mods/champions/conditions.ts` carries exactly three keys, `par`, `slp` and `frz`, and
`data/mods/champions/moves.ts` carries no `perishsong`. That was checked FIRST, on the brief's
instruction, because tonight's Encore batch turned entirely on a Champions override.

## 3. G1 — THE BURN CHIP RAN AT ORDER 9

`RESIDUAL_GROUPS`' own header read *"psn/tox/brn are 9,9,10 and run as one step"*. It described the
defect out loud and had done so since the table was written.

`comparePriority` (`sim/battle.ts:404`) is order ASC, priority DESC, speed DESC, over ONE handler list
built and `speedSort`ed before the walk (`:507`). So EVERY body's poison chips before ANY body's burn.
This engine ran all three chips in one speed-sorted pass and interleaved them.

The walk now dispatches on the body's own status — `brn` in the `statusBrn` group at 10, `psn`/`tox`
in `status` at 9. A body carries exactly one status, so the branch is taken at most once per body per
walk.

**Poison Heal moved with the chip and that is deliberate.** It is an `onDamage` at priority 1: it
occupies no residual position, it intercepts whichever chip is running. The old header gave that as
the reason all three chips shared a step, and it is not — it is the reason the interception must
follow the burn down to order 10. The statuses it answers to are still the tag's
(`healsFromOwnStatus`), never a name in the walk; `ability/healsFromOwnStatus` is LIVE on the post-fix
census.

## 4. G2 — PERISH SONG HAD NO STEP IN THE WALK

The tick stood in the foot-of-turn clock loop, below the whole walk. Two consequences, both fixed:

1. `expiry:tailwind` at order 26 is spent INSIDE the walk by `residualExpireAt`, so its `|-sideend|`
   came out above every `perishN`.
2. `ability:speedboost` is order 28 and this walk re-asks `residualOrder()` per group, so a tick below
   the walk read speeds the boost had already moved, and the counters came out in the wrong body
   order.

**The death did not move and that was the risk.** `perishsong.condition.onEnd` is
`add('-start', target, 'perish0'); target.faint()`, `Pokemon#faint()` writes no line, and
`fieldEvent`'s duration-expiry branch `continue`s past the `faintMessages()` at `sim/battle.ts:565` —
so the `|faint|` is still owed when the walk moves on. The step calls `queueFaint` exactly as the foot
loop did, and `residualFollowerRuns` still decides above-or-below `|upkeep|`. Two guards make that
survive the move:

- **the group close now skips a body it has already marked** (`m.curHP<=0 && !m.fainted`). Without it
  the queued `|faint|` would be written inline one branch later, defeating the deferral. It moves
  nothing else — the two in-walk sites that faint inline already set the flag, and `TR.faint` dedupes.
- **`sideWiped(S) && !faintQueueOwed()`**. `this.ended` is set inside a drain, and the expiry skips the
  drain — so a side wiped by the order-24 expiry does NOT stop the walk; the remaining groups run,
  `|upkeep|` is written at `:2814` because `this.ended` is still false, and the tail of `runAction` at
  `:2832` ends it. It moves nothing today except the perish case: the only other in-walk queueing site
  is `weatherAbilityChip`, whose group drains before this check is next reached.

Both guards were exercised: a four-body mutual perish wipe produces **byte-identical output before and
after**, in all three arms (bare / pickup / tailwind), including the winner.

**A side effect that moves TOWARD the authority and is named rather than claimed as intended.** With
the tick at 24, a perish-killed body is skipped for orders 25-29. It used to get them, because it was
still alive at full HP for the whole walk. The authority sets `hp = 0` inside `faint()`
(`sim/pokemon.ts:1590`), so every hp-guarded residual handler — `boost`, `heal`, `damage` — refuses for
that body from order 24 onward there too. Roost's type restore at 25 is the one silent one and the
engine already has a dedicated fainted-body sweep for it.

## 5. THE PROBES — RED FIRST, WITH THE OVER-FIRE CONTROLS THAT MUST NOT MOVE

`tests/test-mechanics.js`, two new rows, both `condition`, both armed, both routed through
`battleInit`/`battleTurn`.

**`condition/residualStatusOrder`.** Speeds are explicit and interleaved across both sides —
brn-200, psn-150, brn-100, tox-50 — which is what makes the two shapes distinguishable at all: one
pass gives `brn psn brn tox`, two order-separated passes give `psn tox brn brn`. A board with the
burns on one side would have scored the same either way.

- CONTROL ARM: the same four bodies all POISONED. Every chip shares order 9, so the walk collapses to
  one speed-sorted pass and the sequence must be plain speed order. An engine that learned "poison
  first" rather than "order first" passes the mixed arm and fails this one.
- OVER-FIRE BRACKET, asserted on BOTH arms: **Leftovers@5 first**, **Leech Seed@8 second and above
  every chip**, **partial-trap@13 last and below every chip**. Measured unmoved at indices 0 / 1 /
  last in every configuration of both knobs.

**`condition/residualPerishStep`.** Four arms.

- `tw` — Tailwind with one turn left: the four order-24 counters must precede the order-26 `-sideend`.
- `boost` — 100 against 80, and 80 x 1.5 = 120: the counters must precede the order-28 `-boost` AND
  come out in the PRE-boost order. Under the knob they come out reversed, which is the second symptom.
- `bare` — no Tailwind, no Speed Boost: plain speed order, and it must read the same before and after.
  This is the over-fire control.
- `noperish` — the same Tailwind board with no clock on anybody: the side clock still expires and no
  counter is announced.

**The four-armed `move/perishClock` probe is the control for the DRAIN and was not touched.** All
seven `perishClock` census rows and `condition/weatherResidualFaintQueue` are LIVE under both knobs
and without them.

Both knobs are registered in `DELIBERATE_BREAK`, so a run under either REFUSES to write the census —
demonstrated (the message names `MEDFAILS.statusOneStepRestored` / `perishAtFootRestored`).

## 6. THE PREDICTION HELD

Stated before the run: **protocol 199 -> 191 point estimate** (189-197 accepted), **board-parted 84 ->
84 unmoved**, **DIFFERENT-END-STATE unmoved**. Result: **191 / 84 / unmoved**. The point estimate was
exact.

The reasoning behind 191 rather than 189 was that the ten dumped rows are FIRST divergences, so
removing them can surface a later one in the same game and the game keeps counting. That is exactly
what happened, and it is attributed rather than assumed:

```
  ordering class                  53 -> 43     exactly the ten
  event missing from medicham2    51 -> 52     one of the ten resurfaced later
  unrelated event mismatch        34 -> 35     one of the ten resurfaced later
  every other class                unchanged
  TOTAL                          199 -> 191
```

In the dump: **perish-vs-`-sideend` rows 5 -> 0**, **psn-vs-brn chip rows 5 -> 0**, ordering rows
52 -> 42. **Two causes removed, both naming a mechanism by name; the two added are both
`event missing from medicham2 :: |-fail|pXY <> |upkeep`, i.e. the same games diverging later.**

Sample identity checked rather than assumed: 961 games both runs, `turns_cap` 12, arm `middle`,
steering `empirical-click/v1`, `closet.teams_dropped` 43 both, `coverage.exercised` 556 of 580 both,
`state.not_compared` 5 both, `mid_void.void_games` 9 both.

`data/verification/game-differential.residualorder.json` and
`data/verification/divergence-turns.residualorder.json`, release **`b45e6b257029`**, pool
`data/team-pool-frozen`, census pin `9446a684709d`, 961 games, cap 12, `--dump-games 250` (182 of 191).
Baseline read with `git show HEAD:` for a stable read.

## 7. THE CLOSETED PERISH ROW (ROADMAP #440) STILL HOLDS — AND MY FIRST READING OF IT WAS THE INSTRUMENT

Checked against the new empirical artifact, cause by cause.

| falsifier | verdict |
|---|---|
| (a) the pair on a row whose `showdown_before` carries no `perish0` | **UNMET.** The single row's context carries `perish0` x3 immediately above the split. |
| (b) the board claim failing | **NOT DECIDED HERE.** It rests on the COVERAGE arm (`961 of 961`), which was not re-run this batch. Named in OWED, not absorbed. |
| (c) `MEDFAILS.residualFollowerUnmapped` non-empty | **UNMET.** Empty on this build, checked directly. |
| (d) the cause reaching more than one game | **UNMET.** `n=1` before and `n=1` after, same seed pair, same cause string, same context. |

**I reported (a) as MET for about a minute and it was my probe, not the game.** I grepped the dump row
for a field called `showdown_before` — the name the closet's MATCHER uses, populated by
`mechanicsCauseEvidence` — and the dump calls it `before`. The absent field read as "no `perish0`".
Suspect the instrument before the engine; this is the fifth time that rule has paid this week.

The row is unchanged by this batch in every respect an artifact can express, so it comes off nothing.

## 8. A CORRECTION LANDED IN THE SAME PASS, NOT FILED

`residualOrder`'s header attributed the `|-sideend|…|tailwind` rows to its declared tie-sort
limitation — *"the two rows in the pool are a case it does NOT fix"*. **That named the wrong cause and
the wrong count.** They were Perish Song having no step at all; there is no speed tie anywhere on the
probe board that reproduces them, and the 2026-08-29 dump held five, not two. The sentence is struck
through in place with the correction beside it rather than deleted, and **the new count is deliberately
not written into the comment** — a comment carrying a number is a comment that goes stale, which is
the whole reason this one had to be corrected.

## 9. ONE PRE-EXISTING RED, REPAIRED RATHER THAN REPORTED

`tests/test-perish-song.js --break-the-faint` could not apply its mutation. Its anchor named
`if(x._perish<=0){x.fainted=true,noteFaint(x);x.curHP=0;` and **that string does not exist at HEAD
either** — 2026-08-24 moved the death onto `queueFaint` and the demonstration had been failing loudly
(its own "THE MUTATION DID NOT APPLY" guard, exit 1) ever since. It is re-aimed at the walk's site, as
the message instructs, and shown RED — `2 of 2 FAILED` — with the clean run still PASS. Re-aiming it
at the foot-of-turn line would have been wrong now: that line only runs under `MEDI_PERISH_AT_FOOT=1`,
so the mutation would delete nothing on a default run, which is the silent no-op the block refuses.

## 10. ONE PRE-EXISTING RED, HANDED BACK — AND THE ITEM THE LAST BATCH FILED IS NO LONGER THE ONE THAT FAILS

`tests/probe_red_demo.js` exits 1: **5 COULD NOT BE APPLIED and 1 HOLLOW of 200**. `WIRE 120 Parting
Shot`, the item the previous batch carried forward, now reads OK; what fails is WIRE 117 Psychic
Terrain, ROADMAP #81 WIRE 2 (a Protect holding the last action), WIRE 7 (a mega stone knocked off) and
WIRE 8 twice (Electro Shot). **Proven not this batch's rather than argued**: `git diff` puts all
thirteen of this pass's engine hunks in the counter, knob, `RESIDUAL_GROUPS` and residual-walk regions,
so every byte outside them is HEAD's — and the four anchors read identically at HEAD and live (two
absent in both, two present in both). Each wants its edit re-aimed at what the engine says today.

**HEAD MOVED UNDER THIS PASS AND THAT IS RECORDED RATHER THAN ASSUMED HARMLESS.** The session opened on
`a969ba10` and HEAD is `8798b196`; `tests/probe_red_demo.js` was among the files those commits changed,
which is why the red SET differs from the one the last batch named. My own work is uncommitted and
intact — `git diff` on `tests/test-mechanics.js` is exactly the two probes plus the `DELIBERATE_BREAK`
line. The baseline is committed, not remembered: `git show HEAD:data/mechanics-census.json` reads
**806 / 806 / 0**. `data/team-pool-frozen` was touched by none of those commits.

## 10. WHAT WAS RUN

| | |
|---|---|
| `tests/test-mechanics.js` | **exit 0, 808/808/0**, hollow 0, unarmed 0, threw 0 |
| under each knob | census REFUSED, correct probe MISSING, the other LIVE |
| `tests/test-resolution-order.js` | PASS, 26 arms, 1 KNOWN-OPEN |
| `tests/probe_endturn_clock_order.js` | PASS, 7 arms, 1 KNOWN-OPEN |
| `tests/probe_residual_shadow.js` | PASS |
| `tests/test-residual-order-observed.js` | ALL GREEN, 3 checks |
| `tests/test-residual-order-population.js` | ALL GREEN, 14 checks |
| `tests/test-perish-song.js` | PASS; `--break-the-faint` red, 2 of 2 |
| `tests/test-wiring.js` | every capability proved it ran |
| `tests/test-end-state.js` | ALL GREEN |
| `tests/test-engine-consistency.js` | all checks passed |
| `tests/probe_turn_order.js` | 12 staged, 0 not matching |
| `tests/test-seed-clock.js` | 134 passed, 0 failed |
| empirical whole-game differential | above |

`MEDFAILS.residualUnplaced` is empty (both new steps found in the artifact) and
`MEDFAILS.residualFollowerUnmapped` is empty.

## OWED, NOT RUN

- **The COVERAGE arm of the whole-game differential** (`data/game-differential.json`). It is stale on
  release `e129bca605e3` and was ALREADY withheld by `status.js` before this batch. It is the arm
  falsifier (b) of the closeted #440 row rests on, so that clause is undecided until it is re-run:
  `SHOWDOWN_PATH=... node engine/game_differential.js --end-state --arm middle --games 1200 --turns 12
  --release b45e6b257029 --team-store data/team-pool-frozen --census
  data/verification/census-pin-9446a684709d.json --write`.
- **The deliberate roster, all three stages**, and **`data/all-mechanics-fire.json`**. All four are on
  `e129bca605e3` and WITHHELD by the release-mismatch clause, which predates this batch.
- **`tests/test-engine-diff.js`** — not run, deliberately: it has no `--out` and would republish
  `data/engine-diff.json`. Nothing here touches a damage path; the residual chips are unchanged in
  amount and only in position.
- **`tests/probe_protect_stage_order.js`** — REFUSED without a `--release`; not run.
- **`node engine/status.js --write`** was run at the end of the pass; the FEATURE SEMANTICS banner it
  prints (damage table regenerated, fixture rounding 6 -> 6, scenarios 10 -> 12) is MEASURE's and
  predates this batch.

## WHAT I AM WITHHOLDING

- **No claim that either fix caused a board to move.** The board is unmoved at 84 and that was the
  prediction; one of the ten games is marked board-material in the ordering breakdown and its first
  board divergence is 5-10 turns downstream, so attribution was never available and is not claimed.
- **No strength claim.** Landing the mechanic is the result.
- **The orders-25-to-29 side effect in §4 is reasoned from `sim/pokemon.ts:1590`, not measured.** No
  probe in this repo stages a perish-killed body carrying a Speed Boost, a Harvest or a White Herb.
