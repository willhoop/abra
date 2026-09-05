# Cap 20 — measuring Will's ruling

**What was asked:** `engine/game_differential.js`'s `--turns` default moved 12 → 20 on the evidence in
`docs/_reports/2026-09-05-cap-or-stall.md`. Measure what it does. Nothing else.

**Release: `688e696f00c8`.** `drift 688e696f00c8` reported **NO-DRIFT** — every one of the 26 frozen
SOURCE files is byte-identical in the live tree — so the cut appended an event and returned the same
id. This matters more than it sounds: it is the **same engine the baseline was measured on**, so the
only thing that moved between the baseline and this pass is the instrument, and the paired cap-12
control below isolates that completely.

---

## 0. THE SCOREBOARD, CALLED IN WRITING BEFORE THE RUNS

Written at 2026-09-05 18:40Z, before either arm was launched. Baseline is
`data/verification/protect-fix-empirical.json` — empirical arm, cap 12, release `688e696f00c8`:
**resolved 680, at cap 271, board-material 55, protocol 147**, of 961 games.

Reasoning behind each call, kept as written:

- **Resolved.** Of the 271 games at the 12-cap, the old-driver sweep says 56.9% of still-running games
  resolve by 18 and 87.1% by 24; interpolating ~68% by 20. But the fixed driver has *already* finished
  the easy games — its residual 271 is a harder tail than the old driver's 418 — so I discount to ~60%.
  680 + ~160 = **845**.
- **At cap.** 271 − 160 = **105**.
- **Board-material.** MUST RISE; that is the point of the change. The sweep moved protocol divergences
  +30% from 12 → 18. Applying the same factor to 55 gives **73**.
- **Protocol.** 147 × 1.26 = **186**.

| quantity (empirical arm, cap 20) | PREDICTED | range | MEASURED | verdict |
|---|---|---|---|---|
| resolved — both engines ended | 845 | 800–870 | **915** | **MISS** (high) |
| still at the cap (20) | 105 | 85–150 | **34** | **MISS** (low) |
| board-material (games whose board parted) | 73 | 65–85 | **60** | **MISS** (low) |
| protocol (first-divergence games) | 186 | 170–205 | **162** | **MISS** (low) |
| of the 271 cap-12 hitters: resolve by 20 | ~160 (59%) | 130–190 | **235 (86.7%)** | **MISS** (high) |
| of the 271 cap-12 hitters: still stalled at 20 | ~105 (39%) | 80–140 | **34 (12.5%)** | **MISS** (low) |
| cap-12 control reproduces the baseline exactly | yes | — | **yes, every count** | **HIT** |

### **1 of 7.**

Every *direction* was right and every *magnitude* was wrong, all in the same direction. The named
cause: **I priced the extension off the cap-or-stall sweep, which was measured on the PRE-protect-fix
driver, and then argued explicitly that the fixed driver's residual would be HARDER.** It is easier.
The 271 games left at 12 by the fixed driver clear at 86.7% by turn 20; the 418 left by the broken
driver cleared at 87.1% only by turn *24*. A sweep taken under one driver does not price a cap under
another driver — which is the rule this division already enforces about arms, applied to a knob.

---

## 1. WHAT WAS PINNED

| pin | value |
|---|---|
| engine release | `688e696f00c8` (frozen, NO-DRIFT against the live tree) |
| census | `data/verification/census-pin-9446a684709d.json` |
| team pool | `data/team-pool-frozen` |
| arm | `middle`, `--end-state` |
| steering | `empirical-click/v1` — **one arm only; nothing here is pooled with a joint-arm figure** |
| budget | `--games 1200` (a PAIR budget) → **961 games played**, both caps |
| instrument | driver code `4a48f9981b77` over 11 files, reported unchanged across every run |

Four runs, all at the same pins:

| run | cap | artifact |
|---|---|---|
| measurement | 20 | `data/verification/cap20-empirical.json` (`--write --out`) |
| paired control | 12 | `data/verification/cap20-control-12.json` (`--write --out`) |
| per-game dump | 20 | `data/verification/_cap20-sample-20.json` (`MEDI_SAMPLE_DUMP`, no `--write`) |
| per-game dump | 12 | `data/verification/_cap20-sample-12.json` (`MEDI_SAMPLE_DUMP`, no `--write`) |
| pairing control | 19 | `data/verification/_cap20-sample-19-strictpair.json` (`MEDI_SAMPLE_DUMP`, no `--write`) |

`data/game-differential.json` was **not touched** by any run. Every dump reproduced its published
artifact's counts exactly (680/271/147/55 and 915/34/162/60), so the per-game analysis in §3–§5 is of
the *same games* the two published artifacts describe.

---

## 2. THE PAIRED TABLE — 12 vs 20, ONE VARIABLE

**The cap-12 control reproduces the handed-over baseline on every single count**, twelve hours and
one instrument edit later:

| | baseline `protect-fix-empirical` (06:40Z) | my control `cap20-control-12` (18:39Z) | equal? |
|---|---|---|---|
| resolved / at cap | 680 / 271 | 680 / 271 | yes |
| board-material / protocol | 55 / 147 | 55 / 147 | yes |
| by-cause board-material / narration / causes | 52 / 95 / 128 | 52 / 95 / 128 | yes |
| SAME / DIFFERENT / ENDED-APART end-state | 929 / 29 / 2 | 929 / 29 / 2 | yes |
| void / usable / diverged-among-usable | 4 / 957 / 143 | 4 / 957 / 143 | yes |
| turn boundaries compared / identical | 9771 / 9584 | 9771 / 9584 | yes |

So the comparison below is the cap and nothing else.

### ALL 961 GAMES

| empirical arm, release `688e696f00c8` | cap 12 | cap 20 | Δ |
|---|---|---|---|
| **resolved — both engines ended** | 680 (70.8%) | **915 (95.2%)** | **+235** |
| **still at the turn cap** | 271 (28.2%) | **34 (3.5%)** | **−237** |
| **board-material — games whose board parted** | 55 (5.7%) | **60 (6.2%)** | **+5** |
| **protocol — first-divergence games** | 147 (15.3%) | **162 (16.9%)** | **+15** |
| by-cause: board-material / narration-only games | 52 / 95 | 56 / 106 | +4 / +11 |
| distinct causes | 128 | 139 | +11 |
| SAME-END-STATE / DIFFERENT / ENDED-APART | 929 / 29 / 2 | 924 / 33 / 3 | −5 / +4 / +1 |
| mid-void: void / usable / diverged among usable | 4 / 957 / 143 | 5 / 956 / 157 | +1 / −1 / +14 |
| median turns | 9 | 9 | 0 |
| turn boundaries compared | 9,771 | 10,537 | +7.8% |
| coverage exercised | 555 of 580 | 555 of 580 | 0 |
| THREW | 1 | 1 | 0 |

### THE 927 GAMES I CAN CERTIFY ARE UNPERTURBED

`--turns` perturbs some games (see §5). Removing the **34 games measurably perturbed** leaves 927:

| empirical arm, unperturbed subset (n=927) | cap 12 | cap 20 | Δ |
|---|---|---|---|
| resolved | 646 | **881** | +235 |
| still at the cap | 271 | **34** | −237 |
| **board-material** | 54 | **60** | **+6, and ZERO losses** |
| **protocol** | 143 | **159** | **+16, and ZERO losses** |

**On the clean subset the cap only ever adds.** Both figures in the all-961 view lose a little to the
perturbation (2 board-partings and 3 protocol divergences vanish in games whose turn-1 play changed);
on the certified-clean subset nothing is lost at all.

---

## 3. WHAT HAPPENED TO THE 271

Paired game by game — the game list is identical and in the same order in both runs, so
`config|seed` is an exact key.

| fate of the 271 games that hit the 12-cap | n | share |
|---|---|---|
| **RESOLVED — both engines ended by turn 20** | **235** | **86.7%** |
| **still at the cap at 20** | **34** | **12.5%** |
| ended another way (ONLY-medicham2-ended, boards parted) | 2 | 0.7% |

**All 34 of the cap-20 hitters are drawn from the original 271. The longer cap creates no new stalls.**

### 80 of the 271 had already finished

The end turn of the 235 that resolved:

```
 end turn   6   8  11 | 12  13  14  15  16  17  18  19
 games      1   3   1 | 80  40  28  35  19  12   7   9
```

**80 games ended on turn 12 itself** and were labelled `the turn cap (12)` only because the loop ran
out on the same turn the battle finished. That is the §1a correction of the cap-or-stall report, and
it is much larger here than there: **29.5% of the fixed driver's cap-hitters (80/271)** against 11.4%
(54/472) of the broken driver's.

**So the genuinely-truncated population at cap 12 was 191, not 271** — 19.9% of the run, not 28.2%.
Of those 191: **155 (81.2%) resolve at turns 13–19, 34 (17.8%) are still open at 20**, 2 end otherwise.

### The survival curve

Games reaching each turn boundary, both runs:

```
 turn      1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16   17   18   19   20
 cap 12  961  961  961  956  932  879  799  691  580  464  355  271    -    -    -    -    -    -    -    -
 cap 20  961  961  961  956  934  883  799  692  584  467  362  274  194  151  120   84   64   51   44   34
```

The curve is still falling at 20 — 44 → 34 across the last step — so 20 is not where the population
runs out. It is where the cost stops being worth it: the 34 that remain are the genuinely-unending
tail the sweep already identified.

### DOES THE RESIDUAL STALL FRACTION LOOK UNCHANGED?

**No — it collapsed, and the protect defect is not carrying the cap's job.** The brief's contingency
was that if the stall fraction were unchanged, the residual protect defect (1.53× its input) would be
doing more work than the cap was. It is not: the truncated population fell **191 → 34 (−82%)** and the
share of the whole run sitting at the cap fell **19.9% → 3.5%**. The 34 that remain are 3.5% of games,
against the 21%–31% the pre-fix driver left stalled. The protect defect is still real and still owed —
it is why the median game is 9 turns rather than real play's 7 — but it is no longer the thing that
decides whether this instrument sees a game to its end.

---

## 4. THE RISE IN BOARD-MATERIAL IS THE FINDING

Paired, per game, over all 961:

| | board-material | protocol |
|---|---|---|
| diverged at cap 12 only (lost) | 2 | 3 |
| diverged at cap 20 only (**gained**) | **7** | **18** |
| diverged at both | 53 | 144 |

**Every one of the 7 new board partings is at a turn the 12-cap cannot reach.** Their turns:
**13, 14, 14, 15, 15, 16, 17.** The turn histogram of first board divergence:

```
 turn       1   2   3   4   5   6   7   8   9  10  11  12 | 13  14  15  16  17
 cap 12     3   3   8   7   8  11   6   4   2   1   1   1 |  -   -   -   -   -
 cap 20     3   2   8   7   8  10   6   4   2   1   1   1 |  1   2   2   1   1
```

The 2 losses are both at turns ≤ 6 and both are perturbed games; on the certified-clean subset the
count is +6 and −0.

### The noise floor, measured before believing it (LESSONS §9)

Splitting one arm in half by game index:

| | half A | half B | **spread** | the effect |
|---|---|---|---|---|
| board-material rate, cap 12 | 0.0457 | 0.0688 | **0.0230** | 0.0052 |
| board-material rate, cap 20 | 0.0561 | 0.0688 | **0.0126** | 0.0052 |
| protocol rate, cap 12 | 0.1414 | 0.1646 | **0.0232** | 0.0156 |
| protocol rate, cap 20 | 0.1622 | 0.1750 | **0.0128** | 0.0156 |

**Read as an unpaired rate estimate, +5 board-material is INSIDE the split-half spread and must not
be quoted as a rate movement.** 5.7% → 6.2% is not distinguishable from which half of the sample you
took.

**Read as what it actually is, it is not a statistical claim at all.** The two runs play the same 961
games with the same dice; there is no sampling noise between them. The seven new partings occur at
turns 13–17, which the 12-cap cannot reach *by construction* — under the null "the cap changes
nothing" the count of those is exactly zero, not a small number. This is a deterministic find, and it
is why the paired control in §2 was the load-bearing run rather than a formality.

**So the honest phrasing, and the one to use downstream: the cap did not raise the divergence RATE.
It extended the instrument's REACH, and inside the new reach it found 7 board partings and 18
protocol divergences that were previously outside the space this measurement could look at.** That is
the same shape as the charge-aim defect this division wrote up eleven hours ago: a defect that is not
unmeasured but outside the space the measurement can reach.

---

## 5. THE COST, AND THE SENSITIVITY

**The cap is nearly free at this driver.**

| | cap 12 | cap 20 | ratio |
|---|---|---|---|
| total turns played | 8,810 | 9,576 | **×1.087** |
| arm elapsed | 136.4 s | 139.6 s | **×1.023** |
| coverage exercised | 555 / 580 | 555 / 580 | — |

The cap-or-stall sweep priced 12 → 24 at ×1.26 in turns on the broken driver. On the fixed driver
12 → 20 costs **×1.087**, because most of the extra turns the old sweep bought were protect stalls
that no longer happen. The wall-clock ×1.02 is on a machine that was not idle and should be read as
"not measurably more expensive", not as a precise ratio.

### `--turns` still perturbs the sample — and the mechanism named in cap-or-stall §5 is WRONG

Measured here, on games that resolved by turn 12 in the cap-12 run (n=690, the population where a
perturbation is detectable from a stream digest): **34 games (4.9%) play differently at cap 20.**
That is a floor on the whole-run figure, not the whole-run figure — the 271 cap-hitters cannot be
checked this way, and at the same 4.9% rate the total would be ~47, consistent with the 49 the
earlier report found.

The perturbation is **not** `S.maxTurns = Math.max(MAXTURNS + 1, 20)`, which cap-or-stall §5 named. A
control disproves it in both directions:

- **`--turns 12` and `--turns 19` both give `S.maxTurns = 20`, and the same 34 games still differ.**
  If S.maxTurns were the cause, this pair would be byte-identical. It is not.
- **`--turns 19` and `--turns 20` give `S.maxTurns` 20 and 21 — and are byte-identical on all 917
  games that resolve by 19**, with identical board-material (60), protocol (162) and paired deltas
  (+7/−2, +18/−3). If S.maxTurns were the cause, this pair would differ. It does not.

So `MAXTURNS` reaches the trajectory by some path other than `S.maxTurns`, and the 12 → 19 step
crosses it while 19 → 20 does not. **I did not chase it further** — it is cap-or-stall's owed item 3
and belongs to ENGINE/SEARCH — but the filed diagnosis should be corrected before anyone acts on it.
The perturbed games are concentrated by configuration, which may help whoever picks it up:
`pair-protect-bust` 14, `omit-intimidate` 10, `pair-redirect-priority` 7, `omit-spread` 3, and **zero**
in `baseline`, `omit-protect`, `omit-priority`, `omit-weather`, `pair-speedctrl`.

---

## 6. WHAT THIS DOES TO THE PUBLISHED GATE FIGURE

`data/game-differential.json` still holds the gate's board-material figure. It is **21.7 h old, was
measured on release `0dec37ff5ad9` against a tree at `688e696f00c8`, and carries `turns_cap: 12`.**
Both whole-game clauses are FAIL for that reason and were FAIL before I started.

**When somebody re-runs it, the headline will move for TWO reasons at once and neither is a
regression.** The release moved (3 real source changes: `medicham2-browser.js`, `abra-tags.js`,
`tags.json`) *and* the cap default moved. On this release the empirical arm reads 55 at cap 12 and 60
at cap 20; the standing published figure was taken on other bytes at cap 12. A re-run that lands near
60 has not made the engine worse — it has measured a different engine over a longer game. Say so in
the same sentence as the number, or it will be read as a regression, which is the failure this
division exists to prevent.

I did not run it. The brief forbids writing over that artifact, and the arm/cap declaration is a call
for whoever owns the gate re-run.

---

## 7. THE GATE

**2 of 9 clauses fail — unchanged, and that is the target.** My release cut appended an event to
`688e696f00c8` and produced no new digest (NO-DRIFT), so it staled nothing; no clause needed re-running.

```
 PASS  game differential                                    clean at both corners, 0 of 6000
 PASS  deliberate roster / items                            clean: 140 of 148 tested
 PASS  deliberate roster / abilities                        clean: 129 of 202 tested
 PASS  deliberate roster / moves                            clean: 475 of 500 tested
 PASS  coverage / every used mechanic is measured            all 412 moves above 25 clicks
 FAIL  whole-game differential / BOARD-MATERIAL              artifact on release 0dec37ff5ad9  <- pre-existing
 FAIL  whole-game differential / NARRATION                   artifact on release 0dec37ff5ad9  <- pre-existing
 PASS  mechanics / staged and compared against showdown      0 undeclared divergences
 PASS  no open, known engine defect                          clean
```

---

## 8. FILES THIS PASS WROTE

Published, both `--write --out`, neither over `data/game-differential.json`:

- `data/verification/cap20-empirical.json` — empirical arm, **cap 20**, release `688e696f00c8`
- `data/verification/cap20-control-12.json` — empirical arm, **cap 12**, same release, the paired control

Scratch per-game dumps, underscore-prefixed, no `--write`, kept because §3–§5 rest on them:

- `data/verification/_cap20-sample-20.json`, `_cap20-sample-12.json`, `_cap20-sample-19-strictpair.json`

Also: one cut event appended to `data/releases/688e696f00c8/cuts.jsonl` and
`data/engine-release.json`. Nothing committed.

---

## 9. OWED

1. **The gate re-run of `data/game-differential.json`.** Both whole-game clauses are FAIL on a
   21.7-hour-old artifact measured against release `0dec37ff5ad9`. Whoever runs it must state the arm
   AND the cap with the number, because the headline moves for two reasons at once (§6). Not mine to
   write over.
2. **`node engine/status.js --write` was NOT run.** It stamps `<!-- GENERATED -->` blocks in
   `docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md`, and this pass was told a docs agent owns those files.
   Running it would have been a second writer in the same folder. It is owed, by whoever holds `docs/`.
3. **The `--turns` perturbation mechanism is misdiagnosed on the record.** cap-or-stall §5 names
   `S.maxTurns = Math.max(MAXTURNS + 1, 20)`; a two-sided control disproves it (§5). The real path
   from `MAXTURNS` to the trajectory is unidentified. Filed, not fixed — ENGINE/SEARCH own it.
4. **The driver's Protect rate**, unchanged and still owed from cap-or-stall §6.1: 32.8% realised
   against a 13.6% input table and 14.9% human rate. The cap change did not touch it. The evidence it
   still bites is the median game length — **9 turns against real play's 7** — which the cap does not
   fix and was never going to.
5. **`arms[0].damage_roll` still reads `"MINIMUM"`** in both artifacts this pass wrote. It is a stale
   inherited label on a `middle` arm and it is wrong in the same way in every artifact this generator
   produces. Cosmetic in the file, actively misleading to a reader. Still open from cap-or-stall §5.
6. **My own prediction record for this pass: 1 of 7.** The named cause is in §0 and it is a MEASURE
   error, not a modelling one — I priced a knob under the new driver using a sweep taken under the old
   one, having explicitly noticed the population had changed and then guessed the direction wrong.
