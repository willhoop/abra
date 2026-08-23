# `test-effective-identity` — the red is the ruler, not the engine

MEASURE, 2026-08-23. Historical findings record. Not maintained, not current state.

---

## 0. The premise, checked first

The brief's second-hand figures were **close but not exact**, and the difference matters.

| reported to me | measured |
|---|---|
| 1596 today vs baseline 1198 | **1597** at the working tree and at `HEAD` (identical) |
| growth "spread across ~20 files" | **30 files** |
| `tests/roster.js` 247 → 275 | correct |

The failure is otherwise as described: `node tests/test-effective-identity.js` exits **1**, on one
clause out of nineteen. **18 of the 19 assertions pass**, including all three behavioural pins that
carry the file's actual claim (`effective()` resolves all five fields together; the derivation
reproduces all 62 hand-written `MEGA_ABIL` entries; `.ability` is the base forme's on all 62 buildable
stone-holders before the choice and the mega's on all 62 after a real turn). **The engine is not
accused by this red.** Only the ratchet is.

---

## 1. What the gate asserts, and whether it is still meaningful

**The intended assertion** — no NEW place in the repository reads a field that mega evolution changes
(`.ability`, `.baseStats`, `.weighthg`, `.weightkg`) off a live Pokemon and gets the *sheet's*
pre-transformation answer. That question is real and the file's own history proves it: Mega Gengar's
sheet says Cursed Body and the thing on the field has Shadow Tag.

**The implemented assertion** — no file's count of the regex `/\.(ability|baseStats|weighthg|weightkg)\b/`
may exceed its stored per-file number. That is a different question, and it is the one that fails.

### The evidence that the counter is measuring the wrong thing

Not an opinion — this is written down in the repository by people who were not trying to make this
argument.

**(a) It has been reported red, by name, at least seven times, by seven agents, and never actioned.**
`docs/ENGINE.md` carries `869 total`, `1048 total`, `1471`, `1561`, `1596`, and now 1597. Two of those
readings (`869`, `1048`) were **below the baseline of the day (234 … then 1198)** and the gate was red
anyway — because the ratchet is per-file and the headline is a total. **An agent reading
`1597 total, baseline 1198` naturally concludes "restamp"; the headline actively recommends the wrong
move.** Fixed: the failure line now leads with the file count and says the total is not what fails.

**(b) A wholesale restamp did not hold for a week.** ROADMAP #183: on 2026-08-11 the baseline went
234 → 1,198, adopting **964 reads unreviewed** on Will's *"restamp i guess"*. It is red again twelve
days later with 30 files over. A ratchet that a full restamp cannot hold is not tracking risk; it is
tracking repository growth.

**(c) It has corrupted its own subject, twice, on the record.** The regex reads prose.

- The `tests/test-tag-signature.js` declaration inside the gate is **written without naming the field**,
  and says why: *"the scanner is a grep over source text, so quoting the line here would itself count
  as a raw read and the declaration would inflate the number it declares."*
- `docs/ENGINE.md:3033` records an agent **rewording two comments** to hold the counter still.
- `docs/ENGINE.md:13730` records all thirteen of `tests/staged_board.js`'s matches as **string literals
  inside break patches** — quoted engine source handed to `String.replace`. All thirteen were adopted
  into the baseline by the restamp.

A gate that makes people edit comments to satisfy it is measuring the comments.

**Verdict on Q1: the assertion is meaningful; the implementation is not measuring it.** The brief's
leading hypothesis is confirmed, and I tried to refute it — see §2, where I checked whether the
residual is still noisy after the mechanical classes are removed. It is, but the remainder is a
genuine judgement call and that is exactly what `DECLARED` is for.

---

## 2. The growth split by risk, with counts

Every match classified by a lexer (code / comment / string), then by whether it is an assignment.

### Whole repository — 1,597 matches

| class | count | share | can it return a stale identity? |
|---|---|---|---|
| **PROSE** (comment or string literal) | 189 | 11.8% | **No.** Not executed. |
| **WRITE** (`x.ability = v`) | 533 | 33.4% | **No.** A write cannot hand back a sheet value. |
| **READ** | 875 | 54.8% | Only this class can. |

**45.2% of what this ratchet counts as a "raw read" is not a read.** Eight of the 32 `DECLARED`
entries exist for no other reason — `engine/tag_dex.js`, `tests/test-speed-tie.js`,
`tests/mutation_harness.js`, `tests/test-damage-stages.js` and others say so in as many words
(*"it is an ASSIGNMENT rather than a read at all"*).

### The 30 files the gate is actually red about — 383 matches, delta +130

| class | count |
|---|---|
| PROSE | 44 |
| WRITE | 12 |
| READ | **327** |

### The 327 reads, walked

**By field — 122 `.baseStats`, 205 `.ability`.**

**All 122 `.baseStats` reads carry zero risk, structurally, and this is a fact rather than a judgement:**
`baseStats` does not appear anywhere in `engine/medicham2-browser.js`, and a live body carries `st`,
not `baseStats` (probed: `buildMon('garchomp',{})` → `has baseStats: false`). The field only exists on a
dex species row or on `board.js effective()`'s already-resolved return. The one shape that *would* be
dangerous — reading the pre-transformation species' stats — is `baseSpecies.baseStats`, and it occurs
**0 times** across `engine/`, `build/` and `tests/`. Every receiver in the 122 is `sp`, `.sp`, or a
comparator binding over a species array.

**Of the 205 `.ability` reads, ~27 touch a live battle body. Every one deliberately wants the
EFFECTIVE value, and gets it.** The rest are staging descriptors (`CAST.ATTACKER().ability`,
`SWAPPER.ability`, `CLICKER(arm).ability` — plain objects passed *into* `mon(species,item,ability,moves)`),
dex rows, option bags, stored sheet entries, or two regex literals (`/\.ability\s*=/` at
`fixture_legality.js:186`, `/\.ability$/` at `probe_endstate_by_cause.js:191`).

The live-body sites, checked individually:

| site | reads | verdict |
|---|---|---|
| `engine/board_state.js` 598/610/651/728×3 | 6 | The projection compares the two engines' abilities. Its own comment: *"`ability` is the live slot, so Skill Swap and Trace show."* Routing it through `effAbility()` would compare `board.js` to itself. **Identical to the already-DECLARED `tests/test-game-diff.js`.** |
| `tests/probe_bench_leaves.js` 61/84×3 | 4 | A copy of `board_state.js`'s projection. Same case. |
| `engine/million_run.js` (13 sites) | 13 | All read a **snapshot** taken before the turn, with the comment *"the bodies MUTATE inside the turn, and a denominator read off a post-turn body is a denominator about a different board."* Used only to exclude confounded trials. |
| `tests/test-immunity-gate.js` 136/213/217/231 | 4 | Same snapshot shape, and the file's header explicitly warns about this exact hazard in the correct direction: *"Worry Seed had already written Insomnia, so the ability gate closed retroactively."* |
| `engine/all_mechanics_fire.js` 462 | 1 | Builds a set for `TeamValidator`. A validator judges a DECLARATION — the **already-DECLARED `engine/validate_store.js`** case verbatim. |

These are safe because `medicham2`'s `.ability` **is** the ability the body has at that moment, and
Showdown's is the live slot. That claim is not assumed here: it is **pinned by this gate's own section
2b, which passed on this run** — base ability on all 62 before, mega ability on all 62 after, and the
evolved body agreeing with the mega row on all 61.

> **Answer to Q2: 0 of the 130 new matches is a stale-identity read.** 44 prose, 12 writes, 122
> structurally-impossible `baseStats` reads, ~178 declaration/descriptor/dex reads, and ~27 live-body
> reads that all deliberately want and receive the effective value.

---

## 3. Did tonight's work contribute? No — zero.

**Measured, not inferred.** The same scan run against `HEAD` and against the working tree gives
**identical per-file counts on every one of the 107 files**. The three files ENGINE holds
(`engine/medicham2-browser.js`, `engine/tag_dex.js`, `tests/test-mechanics.js`) net to **0 change** —
and all three are `DECLARED`, so they are skipped by the ratchet and could not have turned it red at
any count.

**Where the 130 actually came from — by when the file entered the tree** (`git log --diff-filter=A`):

| | files | delta |
|---|---|---|
| Files that **did not exist** when the baseline was taken (2026-08-11) | **24** | **+81** |
| Files that existed and grew | 6 | +49 (of which `tests/roster.js` alone is +28) |

Not one growth file was born or last touched on 2026-08-23. This is ROADMAP #176's registered
diagnosis — *"most of the gap is files written AFTER the baseline, which count as new by default"* —
reproduced and now quantified: **62% of the red is the calendar.**

*(The printed total moved 1597 → 1603 during this session. All six are prose mentions of the field
name inside the header I added to the gate itself, in a DECLARED file. That is the §1(c) distortion
demonstrating itself, and it cannot change any verdict.)*

---

## 4. What I changed — `tests/test-effective-identity.js`, and nothing else

**The ratchet arithmetic is untouched.** It still compares the raw per-file TOTAL against the stored
baseline. Exit code, the set of failing files and every per-file number are byte-identical before and
after. **Narrowing the counter to reads only would lower every file's number against a baseline
recorded under the old counter — a restamp wearing a lexer**, and ROADMAP #183 is what that costs.

1. **Classifier.** Every match labelled PROSE / WRITE / READ by a lexer (not a line test — the
   `staged_board.js` break patches are exactly what a line test gets wrong). Printed beside every
   growing file and as a `CLASSIFIED` summary line.
2. **The failure headline now leads with the file count** and states outright that the total is not
   what fails, because two of the seven historical red reports were at totals *below* the baseline.
3. **`--split`** — the full per-file table, `*` for over-baseline, `D` for declared.
4. **`--propose`** — prints a candidate baseline and **writes nothing**. Deliberately not automated:
   ROADMAP #183 is what automating it costs.
5. **`ABRA_EI_LEGACY_REPORT=1`** — restores the bare pre-today message, per repo convention.
6. **Blind-shape counter.** Destructuring and destructured params are counted and reported if ever
   non-zero. Both are **0 today**, re-derived every run rather than typed once.

### Shown RED on a deliberate break

`tests/_break_probe_measure.js` (created and removed by me; `run-all.js` discovers only `^test-.*\.js$`,
so it was invisible to it) carrying five shapes on five lines. The gate named the file and split it
exactly right:

```
tests/_break_probe_measure.js: 0 -> 4   [1 prose, 1 write, 2 read]
1 DESTRUCTURED read(s) of a transforming field exist and the superset regex DOES NOT COUNT THEM.
```

A live `.ability` read → READ. A comment mention → PROSE. `mon.ability = v` → WRITE. `mon['ability']`
→ READ. A bare `['ability']` array literal → **correctly not counted at all** (total 4, not 5) — a
naive bracket regex fires on `tests/roster.js:8725`, which is a string in an array literal, which is
why the bracket form goes through the lexer with a required receiver token.

### CLASS, not instance — stated in the gate's own header

**Neither the old scanner nor mine can catch an unanticipated shape, and the header says so with
numbers.** `Object.assign({}, sheet)` copied and then treated as live, and `x[k]` with a computed key,
are **not detectable by any text scan** and must not be read as covered. Destructuring and destructured
params *are* now counted (0 sites today) — that is coverage. The rest is not. **A structural scan
cannot prove the absence of a stale-identity read; it can only refuse the shapes it knows**, and the
behavioural pins in sections 1, 2 and 2b are the load-bearing half of this file.

---

## 5. For Will to decide — I did not do this

The gate is **still red**. It should be, until someone with authority moves the reference point.

**Option A — declare the 6 twins (recommended first step, small).** Six of the thirty are the same
construction as files already `DECLARED`, and each would be a hand edit with a written reason, which is
the sanctioned mechanism:

| file | reads | the entry it duplicates |
|---|---|---|
| `engine/board_state.js` | 6 | `tests/test-game-diff.js` — the projection compares abilities |
| `tests/probe_bench_leaves.js` | 4 | same, it is a copy of `board_state.js` |
| `engine/all_mechanics_fire.js` | 13 | `engine/validate_store.js` — a sheet built for `TeamValidator` |
| `engine/rollout_seed_prevalence.js` | 1 | `engine/rollout_fallen_prevalence.js` — a stored sheet entry, near-identical code |
| `engine/million_run.js` | 19 | `engine/game_differential.js` — an observed snapshot, required to be observed |
| `tests/test-immunity-gate.js` | 5 | same snapshot shape |

**Option B — accept the printed baseline.** `node tests/test-effective-identity.js --propose` prints
it. **1603 across 107 files.** Every one of the 130 new matches is walked in §2 above and none is a
stale-identity read, so this is a *reviewed* re-baseline rather than 2026-08-11's unreviewed one — but
it is still 130 reads adopted, and it is not mine to do.

**Option C — waive it by name.** The honest waiver text: *"the raw-count ratchet is red on 130 matches
that MEASURE walked on 2026-08-23 and found to contain zero stale-identity reads; it stays red until
ROADMAP #176 is taken."*

**My recommendation: A, then re-measure.** It removes 48 of the 130 with written reasons, leaves the
remaining 82 visible, and adopts nothing.

---

## 6. OWED, NOT RUN

- **`node engine/status.js --write` — NOT RUN.** Forbidden by the brief. The generated blocks do not
  reflect this session.
- **No CHANGELOG entry, no `docs/MEASURE.md` update.** The coordinator holds CHANGELOG; `MEASURE.md`
  was outside the files I was given. **The living-docs rule is therefore unsatisfied for this change.**
- **Not committed.** `tests/test-effective-identity.js` is modified on disk only.
- **ROADMAP #183's actual debt is still open and I did not touch it**: *"a walk of the 156 simulator
  reads specifically."* `engine/medicham2-browser.js` is `DECLARED`, held by ENGINE tonight, and has
  since grown 215 → 279. That walk is the one place in this whole ratchet where a stale-identity
  confusion would do real damage, and it remains unwalked.
- **No game was played and no measurement was taken.** The gate's own section 2b runs 62 single turns
  as part of its assertions; that is the gate, not a measurement.
- **`tests/run-all.js` not run** — it would invoke instruments the brief forbids.
