# The driver was not sampling its own table — it was being told what to click

**The one-line verdict.** `empirical-click/v1` realised **32.8%** of its clicks as a protect-family
move against the **13.565%** its own input table carries. The weights were never wrong: on decisions
where the body had its full four moves the arm already realised 15.3%. The amplification was the
`prefer` axis of `game_differential.js`'s `DRIVER_AXES` applied as a **hard narrowing at every
decision** in the two configurations of nine whose preferred set contains the protect family — so
**22.2% of decisions reached the sampler with exactly one candidate, and 60% of those single
candidates were Protect.** More than half the arm's protect clicks were never sampled at all.

---

## 0. WHAT WAS MEASURED, AND AGAINST WHAT

| pin | value |
|---|---|
| engine release | `688e696f00c8` (frozen; the same release cap-or-stall used) |
| census | `data/verification/census-pin-9446a684709d.json` |
| team pool | `data/team-pool-frozen` (digest `0d103fb9fa87`) |
| arm | `middle`, `--end-state` |
| driver arm | `empirical-click/v1` |
| human ruler | `data/team-pool-frozen/games.bo3.jsonl` — 8,388 games, 190,954 clicks, bots and forfeits dropped |

**THE RELEASE DOES NOT FREEZE THE DRIVER, AND THAT IS BY DESIGN.** `data/move-priors.json` is a
frozen SOURCE; `engine/empirical_driver.js` and `engine/game_differential.js` are the INSTRUMENT and
are read live (`game_differential.js:312` says so explicitly). So a before-and-after at one release id
is exactly what a driver change is supposed to produce, and the two legs differ in driver code and in
nothing else.

**The protect family is derived, never typed.** `data/tags.json` `shieldsUser` = protect, detect,
spikyshield, banefulbunker, kingsshield. `data/move-priors.json`'s own `kind: 'protect'` field agrees
with it member for member; the probe cross-checks the two and refuses to run if they ever drift.

---

## 1. THE HUMAN RULER, RE-MEASURED ON THE PINNED STORE

| | value |
|---|---|
| protect-family share of all move clicks | **14.76%** (28,179 of 190,954) |
| clicks by a body whose SHEET carries one | 71.58% |
| ... of those, the protect share | **19.81%** |
| P(protect \| same slot protected last turn) | **10.50%** (over 18,170) |
| both actives of a side protect the same turn | **3.89%** (over 71,323) |
| per-body protect rate (>= 4 clicks, n=21,097) | mean 0.154, E[p²]/E[p] 0.365 |

This reproduces the live-store figures the cap-or-stall report used (14.9% / 11.8% / 4.1%) on a
smaller, pinned corpus, so the two rulers agree and the frozen one can be quoted alongside pinned
runs.

**Read the last row against the third-from-last.** A memoryless sampler with humans' own per-body
heterogeneity would repeat at 36.5%. Humans repeat at 10.5%. **Real players actively do not protect
twice**, which no distribution over `P(move | species)` can express — see §5c.

---

## 2. THE MECHANISM, ESTABLISHED AT THE LINE

An env-gated observational hook (`MEDI_DRAW_PROBE=<file>`, `engine/empirical_driver.js`) recorded
every `drawMove` call of a 120-game run: the legal ids, the weight each was given, and which came
back. 8,885 decisions.

### 2a. The sampler is faithful to its weights. The weights were not the problem.

| decisions | expected from the weights | realised |
|---|---|---|
| all 8,885 | 28.18% | 25.31% |
| **exactly ONE legal candidate (1,975 = 22.2%)** | **60.41%** | **60.41%** |
| two to four candidates (6,910) | 18.97% | 15.28% |
| **the full four (5,544)** | 19.74% | **15.55%** |

A body holding its four moves clicks protect at 15.5% — **the human rate.** Everything above that
came from decisions where the candidate list had already been cut down.

### 2b. What cut it down

The 1,975 single-candidate decisions, by what the single candidate was:

```
 protect 1183   trickroom 150   tailwind 142   electroshot 41   fakeout 38
 acrobatics 31  wavecrash 29    earthquake 23  whirlwind 22     quickguard 22
```

and the two-candidate lists: `protect+ragepowder`, `protect+suckerpunch`, `followme+protect`,
`banefulbunker+wideguard`, `aquajet+protect`.

Those are not movesets. They are `DRIVER_AXES`' preferred sets:

| config | prefer set | contains the protect family? |
|---|---|---|
| `pair-protect-bust` | `byTag(stalling, oneTurnGuard)` ∪ `byTag(ignoresProtect)` | **yes, directly** |
| `pair-redirect-priority` | `byTag(redirects)` ∪ `byTag(priority)` | **yes — every member is +4 priority** |
| `pair-speedctrl` | `byTag(reversesSpeed, doublesSideSpeed, reordersTurn)` | no (trickroom/tailwind) |

`empiricalPick` did `use = pref` — a hard filter, on **every decision of every turn**, not on a
staging one. Two configurations of nine, so roughly 22% of games, in which a body carrying Protect
and nothing else preferred clicked Protect **on every single turn**. That is the whole shape of the
defect at once: the doubled marginal, the 68.6% repeat rate, and the 16.8% both-slots rate.

**It also silently disabled the declared switch model in those configurations**, because a bench
candidate never carries `prefer`: `switches = use.filter(c => c.switchTo != null)` was empty whenever
a prefer set matched.

### 2c. Two things that are NOT the mechanism, checked and cleared

- **The hash is uniform.** 96,000 synthetic addresses of the driver's own shape give chi²=7.8 on 9 df.
  The observed variates are lumpy (chi²=214.6) for a different reason: only 3,953 distinct values
  across 8,885 draws, because the planted-comparator proof games deliberately share one
  `driverSeed`. That is the `--end-state` proof arm behaving as documented, not a broken die.
- **The 0.02 unobserved floor.** It touches 12.6% of candidates and moves the expected protect share
  by 0.6 points (28.18% with it, 27.57% for a flat draw).

---

## 3. THE FIX

`engine/empirical_driver.js` gains `preferPool()`, and `empiricalPick` calls it: **under
`empirical-click/v1` and `joint-empirical-click/v1` the `prefer` axis no longer narrows the draw.**
The pair configurations still SELECT the teams that make the interaction possible; the behaviour clone
decides the click, which is the arm's entire contract. **The coverage arm is untouched** and still
sorts `prefer` first — those configurations were built for it, and Will's rule stands: *"thats why we
have both."* The `omit-*` ban axis is untouched.

`MEDI_PREFER_HARD=1` restores the defect exactly. The run prints which policy it used and the artifact
carries `prefer_hard_narrowing`, `prefer_narrowed` and `prefer_would_have_narrowed`, so no artifact can
be ambiguous about which driver produced it.

### 3a. Shown RED first, on 50 games at the same pins

| | `MEDI_PREFER_HARD=1` (the defect) | fixed | published 961-game figure |
|---|---|---|---|
| protect share of clicks | **32.13%** | **18.79%** | 32.8% |
| P(protect \| protected last turn) | **70.36%** | **30.85%** | 68.6% |
| both actives protect same turn | **18.43%** | **3.83%** | 16.8% |
| decisions narrowed by `prefer` | 919 | **0** | — |
| ended naturally | 26 of 50 | **32 of 50** | — |

The knob reproduces every published figure on a 50-game sample, which is what makes the reduction
trustworthy: it is measuring the same thing the cap-or-stall report measured.

---

## 4. THE SCOREBOARD, CALLED BEFORE THE RUN

Written at 02:45, before `--games 1200` was started. Baseline is
`data/verification/charge-fixture-empirical.json` (961 games, same release, same pins).

| | before | **predicted** | after |
|---|---|---|---|
| protect share of clicks | 32.8% | **18.5%** (17–20) | *(§5)* |
| P(protect \| protected last turn) | 68.6% | **30%** (26–34) | |
| both actives protect same turn | 16.8% | **4.2%** (3–6) | |
| resolved (both engines ended) | 543 (56.5%) | **690** (620–740) | |
| truncated | 418 (43.5%) | **271** (220–340) | |
| board-material (shape RULE) | 34 | **45** (38–60) | |
| protocol parted | 121 | **150** (130–180) | |
| VOID | 4 | **2** (0–8) | |
| median turns | 11 | **9** | |

**A rise in board-material is the finding, not a regression.** Games that finish reach positions the
truncated arm never saw, exactly as the coverage → empirical swap took board-material 0 → 135 on its
own pins.

---

## 5. THE RESULT — A STRICTLY PAIRED BEFORE AND AFTER

**The published baseline was not used as the "before".** `data/verification/charge-fixture-empirical.json`
was written at 01:37 and `engine/board_state.js` — the end-state COMPARATOR, which is not in the
release and is read live — was edited by another agent at 02:32. So the before leg was re-run with
`MEDI_PREFER_HARD=1` at 02:50, after that edit, and `engine/board_state.js` (`0405ffc8ea27`) and
`engine/medicham2-browser.js` (`e721c73003af`) were digested before and after it and did not move.

**The knob leg reproduces the published artifact on every published count**, which is what makes the
pair trustworthy and also shows the comparator edit moved none of them:

| | published 01:37 | knob leg 02:50 |
|---|---|---|
| diverged / protocol parted | 121 | **121** |
| board-material (shape RULE) | 34 | **34** |
| DIFFERENT-END-STATE | 16 | **16** |
| VOID | 4 | **4** |
| median turns | 11 | **11** |
| turns played | 9,665 | **9,665** |
| still running at the cap | 418 | **418** |
| `prefer_narrowed` | 20,507 | **20,507** |

### 5a. The pair

`--release 688e696f00c8 --arm middle --end-state --census census-pin-9446a684709d --games 1200
--team-store data/team-pool-frozen --steering empirical`, 961 games each, the ONLY difference being
`MEDI_PREFER_HARD`.

| | BEFORE (the defect) | **AFTER (fixed)** | ruler |
|---|---|---|---|
| **protect-family share of clicks** | **32.77%** | **20.79%** | input table **13.565%**, humans 14.76% |
| P(protect \| protected last turn) | 68.58% | **36.48%** | humans 10.50% |
| both actives protect the same turn | 16.75% | **4.39%** | humans **3.89%** |
| decisions narrowed by `prefer` | 20,507 | **0** | — |
| **resolved (both engines ended)** | **539 (56.1%)** | **762 (79.3%)** | — |
| still running at the cap | 418 | **189** | — |
| median turns / turns played | 11 / 9,665 | **9 / 8,810** | humans 7 |
| **protocol parted** | 121 | **147** | — |
| **board-material (shape RULE)** | **34** | **47** | — |
| DIFFERENT-END-STATE | 16 | **29** | — |
| ENDED-APART | 0 | 2 | — |
| VOID | 4 | 4 | — |
| choices Showdown refused | 2 | 2 | must read 0 — unchanged, not a regression |
| elapsed | 235.6 s | 277.7 s | — |

`data/verification/protect-fix-empirical.json` (after) and
`data/verification/protect-fix-empirical-KNOB-BEFORE.json` (before). Neither run touched
`data/game-differential.json`.

### 5b. Scoring the predictions honestly — 5 of 9 inside the band

| | predicted | actual | |
|---|---|---|---|
| protect share | 18.5% (17–20) | **20.79%** | **MISS — I under-predicted the residual** |
| repeat rate | 30% (26–34) | **36.48%** | **MISS — same direction** |
| both protect | 4.2% (3–6) | 4.39% | hit |
| resolved | 690 (620–740) | **762** | MISS — better than predicted |
| still running at cap | 271 (220–340) | **189** | MISS — better than predicted |
| board-material | 45 (38–60) | 47 | hit |
| protocol parted | 150 (130–180) | 147 | hit |
| VOID | 2 (0–8) | 4 | hit |
| median turns | 9 | 9 | hit |

The two misses that matter are the two protect figures: **the fix did not take the arm all the way to
its input rate**, and §5c says why. The completion misses are in the direction that the fix worked
better than called.

### 5c. WHAT IS LEFT, AND IT IS A DIFFERENT DEFECT

**20.79% against a 13.565% input is still 1.53x.** The residual has a measured mechanism and it is not
the one fixed here:

- `move-priors.json` is a MARGINAL, `P(move | species)`, pooled over every set that species runs. The
  driver renormalises it over the four moves ONE body carries. **Measured: a full species row carries
  0.917 of mass across its 8 listed moves; the legal candidates at a decision carry 0.521 across ~3.14
  of them.** The mass of the five moves this body does not have is handed to the ones it does — and
  Protect, being on nearly every set in this format, is the move that always survives the subsetting.
  0.13565 x 0.917 / 0.521 = 23.9%, which is the size of the effect.
- The run's own counters say the same thing from the other side: 45,894 of 66,965 sampled decisions
  had a family member legal (68.5%), and the realised conditional rate is **30.1% against humans'
  19.81%**. Carriage is not the problem; the within-set rate is.
- The correct object is `P(move | species, THIS moveset)`, or equivalently `p_m / c_m` where `c_m` is
  the share of that species' acts made by bodies carrying `m`. Neither is in any artifact today.
- **The residual repeat rate (36.48% against a 20.79% marginal) is a DECLARED model limitation, not a
  defect.** A memoryless sampler repeats at `E[p^2]/E[p]`; humans' own per-body rates would give 36.5%
  and humans actually repeat at 10.5%, because real players do not click Protect twice. No
  distribution over `P(move | species)` can express that. The driver is now behaving exactly like a
  memoryless draw from its table, which is what it claims to be.

### 5d. A second consequence of the same line, fixed with it

A bench candidate never carries `prefer`, so `switches = use.filter(...)` was EMPTY on every narrowed
decision and the arm's declared switch model was silently off there. In the counters, those decisions
were reported as *"nowhere to go"*:

| | before | after |
|---|---|---|
| decisions that reached the switch draw | 43,281 | **52,008** |
| decisions reported `no_bench` | 34,498 | **19,145** |

**15,353 decisions — 19.5% of the run — were recorded as having no bench when a live bench existed.**
The realised switch rate among decisions that did reach the draw was unaffected (9.70% -> 9.67%
against 9.98% measured), which is why nothing looked wrong.

---

## 6. A CONCURRENCY INCIDENT I CAUSED, SAID FIRST

`engine/empirical_driver.js` and `engine/game_differential.js` are the INSTRUMENT and are read LIVE —
a frozen release does not pin them. My edit landed at **06:28:45 UTC**. Another agent's runs straddle
it, and their own artifacts say so:

| artifact | generated (UTC) | `prefer_narrowed` | driver |
|---|---|---|---|
| `leaf-widening-all16-empirical.json` | 06:15:41 | 20,507 | OLD |
| `leaf-widening-all16-joint.json` | 06:26:29 | 20,353 | OLD |
| `leaf-widening-all16-empirical-BEFORE.json` | 06:29:27 | 20,507 | OLD |
| **`leaf-widening-all16-joint-BEFORE.json`** | 06:32:58 | **0** (would 17,387) | **NEW** |
| **`leaf-widening-all16-joint-REPEAT.json`** | 06:39:02 | **0** (would 17,387) | **NEW** |

**Any comparison across that line is a comparison of two drivers.** It is detectable rather than
silent only because the new counters are in the artifact: `prefer_would_have_narrowed` present and
`prefer_narrowed: 0` means the fixed driver produced the file. Nothing of mine reads those artifacts
and nothing of mine was written by that agent; the two `protect-fix-*` runs above are strictly paired
within themselves.

**Hooks added, so they are not committed by accident or swept away** (per the note that cost something
last night):

- `MEDI_DRAW_PROBE=<file>` — `engine/empirical_driver.js`. Env-gated, observational, writes every
  `drawMove` decision on process exit. Off by default; an ordinary run is byte-identical.
- `MEDI_PREFER_HARD=1` — `engine/empirical_driver.js`. **The knob that restores the defect.** Default
  off. It is not scratch; the probe needs it.
- `MEDI_TRACE_DUMP` now accepts an ABSOLUTE path (`engine/game_differential.js`). It previously joined
  against the repo root and threw ENOENT **after playing a full run** — which cost one 120-game run
  here.
- The `protect family:` line and four counters in the run's driver block, and
  `prefer_would_have_narrowed` / `prefer_hard_narrowing` in every empirical artifact.

**Nothing is committed.** Modified and uncommitted: `engine/empirical_driver.js`,
`engine/game_differential.js`. New and untracked: `tests/probe_protect_amplification.js`,
`data/verification/protect-fix-empirical.json`,
`data/verification/protect-fix-empirical-KNOB-BEFORE.json`.

---

## 7. RED TESTS SEEN, NOT MINE, NOT FILED AS KNOWN

`tests/test-game-differential.js` is **RED with 4 failures**: two on the pinned dice disagreeing at
`randomChance(90,100)` and `randomChance(1,4)`, and two on damage ENDPOINTS for knock-off order and
Rough Skin. None of them touches candidate selection, `engine/board_state.js` is modified in the
working tree by the ENGINE agent right now, and `engine/medicham2-browser.js` moved at 01:37. I did
not fix them and I am not calling them known: they belong to the engine work in flight and should be
read by whoever owns that batch. `tests/test-empirical-driver.js` is GREEN (20 checks).

---

## 8. OWED

1. **The residual 1.53x (§5c).** The driver renormalises a MARGINAL over the four moves one body
   carries. The remedy is a set-conditional table — `P(move | species, moveset)` or a carriage table
   `c_m` so the weight can be `p_m / c_m` — derived from the open-sheet store, which has both the
   sheets and the clicks. **It was deliberately not done in this pass:** it changes the driver's
   declared input, which changes what `engine/arms_comparable.js` will table together, and changing
   two driver rules at once makes neither attributable. Whoever does it should expect the arm to land
   near 14–15%.
2. **`steering` does not stamp the DRIVER RULE, only the driver's input tables.** Two runs whose
   driver code differs are still declared comparable by `engine/arms_comparable.js` — which is exactly
   what §6 is about. The new counters make it detectable after the fact; a stamp would make it
   refusable. That is a `steering.js` change and belongs to whoever owns that file.
3. **Every `empirical-click/v1` and `joint-empirical-click/v1` figure taken before 06:28:45 UTC on
   2026-09-05 was measured with the hard narrowing on**, including the published
   `data/game-differential.json` that `engine/quarantine.js`'s whole-game clause reads, and the whole
   cap-or-stall analysis. They are not wrong; they are answers about a different driver. The gate
   figure should be re-run before it is quoted against anything measured after tonight.
4. **The cap decision (cap-or-stall §4) should be re-taken on THIS driver.** It recommended 20 against
   a 43.5% truncation rate; truncation is now **19.7%**, and 82 of the games the cap fell on had
   already finished. The curve that recommendation was read off no longer describes this arm.
5. **`P(protect | protected last turn)` is 36.5% and humans are 10.5%** (§5c). It is a declared
   limitation of a memoryless table, and it is the largest remaining behavioural gap in this arm. A
   one-bit conditioning ("did this slot protect last turn") is derivable from the same store that
   built the table.
6. **`data/verification/charge-fixture-empirical.json` is now superseded as a before-baseline** by
   `protect-fix-empirical-KNOB-BEFORE.json`, which carries the same numbers measured against the
   current comparator. The published one is not wrong; it is just no longer the paired leg.
