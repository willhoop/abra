# GATE REFRESH — 2026-08-23 (MEASURE)

Historical findings record. Not current state; `node engine/status.js` is. Superseded by the register
rows it feeds.

**Headline: the MEDICHAM gate went from 6 of 8 clauses failing to 3 of 8. All three roster clauses
now PASS on a current release. Nothing got worse.**

Everything below was measured against ONE release, cut at the start of the run:

```
engine release 0faabe2a3f1b   cut "gate refresh 2026-08-23"   2026-08-23T11:42Z
showdown commit 20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4
```

The tree had not moved since the whole-game run earlier tonight, so the cut returned the SAME id
(`0faabe2a3f1b`) and appended a cut event to `data/releases/0faabe2a3f1b/cuts.jsonl` rather than
rewriting the first freeze. That is by design, and it is why `data/game-differential.json` did not
need re-running.

I was the only agent running. Tree was clean at `56edff7`. `data/_pair-pilot.json` is untracked, is
not mine, and was left alone.

---

## 1. THE GATE, CLAUSE BY CLAUSE

The split the brief asked for is PASS / FAIL-because-broken / FAIL-because-unmeasured. Five clauses
were failing at 07:41; three of those five were failing purely because their artifact had been
measured against release `c36782953dee` and the tree was `0faabe2a3f1b`. Re-running them cleared all
three.

| Clause | 07:41 | now | why |
|---|---|---|---|
| game differential | PASS | **PASS** | 0 of 6000 at the midpoint and at all sixteen corner arms, seed 20260804 |
| deliberate roster / items | FAIL-because-unmeasured | **PASS** | re-run; 0 DIFFER, 0 DID-NOT-FIRE |
| deliberate roster / abilities | FAIL-because-unmeasured | **PASS** | re-run; 0 DIFFER, 0 DID-NOT-FIRE |
| deliberate roster / moves | FAIL-because-unmeasured | **PASS** | re-run; 0 DIFFER, 0 DID-NOT-FIRE |
| coverage | PASS | **PASS** | all 412 moves above 25 clicks are measured by the roster or the census |
| whole-game differential | FAIL-because-broken | **FAIL-because-broken** | 68 of 961 undeclared |
| mechanics | FAIL-because-unmeasured **and instrument-blind** | **FAIL-because-broken** | now answers: 29 of 36 played and uncleared |
| no open, known engine defect | FAIL-because-broken | **FAIL-because-broken** | 5 open register rows name a RED instrument |

### The three that were staleness, not breakage

Worth stating plainly because it is the whole point of the split: **none of the three roster clauses
was reporting a broken simulator.** Each was reporting that it had been handed an answer about other
bytes. The gate was right to withhold and right not to guess in either direction.

### The two that are genuinely broken

**whole-game differential.** Not re-run — `data/game-differential.json` is stamped
`0faabe2a3f1b`, generated 11:21Z today, so it is current against this release. Pins: release
`0faabe2a3f1b`, `data/team-pool-frozen`, census pin `9446a684709d`, arm `middle` (real dice — the
default), 961 games played.

- **73 games protocol-parted** (raw `diverged`)
- **5 declared** (Supreme Overlord `fallenundefined` — the authority emits a literal string on a
  `[silent]` line; matching it would make this engine less correct)
- **68 undeclared = 7.1%** — this is the published headline quantity, and it is NOT the same
  quantity as raw `diverged`
- of the 73 parted games, the end-state comparison says **21 DIFFERENT-END-STATE and 52
  SAME-END-STATE** — a wording rate of 71.2%. The 21 is the board-material number under Will's
  2026-08-22 ruling.
- shape of the 73: emission 34, rule 16, ordering 12, field 11
- the planted-divergence proof reads `caught: true` on all four planted arms (field, missing event,
  swapped order, and the clean control), so the instrument was shown able to see a divergence on
  this run.
- `data/decision-impact.json` is absent, so **nothing is excused on decision impact** and every
  played divergence counts.
- **DIRECTION OF TRAVEL IS WITHHELD BY THE INSTRUMENT ITSELF** and I did not override it. The stored
  baseline is stamped `A/top-tie-first/pins:ef342837b791/...`; this run is
  `A/middle/pins:1fd77b835ee2/...`. One pin is one corner. Those are two instruments and subtracting
  one rate from the other invents a trend. **Re-baseline, not a delta.** I did NOT run
  `--stamp-whole-game`; that is a decision, not a measurement.

**no open, known engine defect.** Unchanged from 07:41. Five OPEN roadmap rows name an instrument
that is RED: **#218** (94,313 uses), **#224**, **#241**, **#258**, **#273**. Ten open rows declare
NOT A DEFECT and are excused. Two (#318, #319) name an instrument that would not run — which is not
agreement and is not evidence. Fifty-three assert breakage with no instrument that decides them —
debt, not evidence, and they do not hold the clause shut.

---

## 2. THE ROSTER STAGES, BY ENTITY NAME

All three stages are at **zero FIRED-AND-BOARDS-DIFFER and zero DID-NOT-FIRE**, on release
`0faabe2a3f1b`.

| stage | DIFFER | DID-NOT-FIRE | MATCH | deferred by owner | could-not-stage | control-not-quiet |
|---|---|---|---|---|---|---|
| items | **0** | **0** | 139 | 1 | 8 | 0 |
| abilities | **0** | **0** | 130 | 0 | 27 | 45 |
| moves | **0** | **0** | 475 | 3 | 22 | 0 |

**What was red on the previous (stale) artifacts and is now clean, named:**

- **items** — *Big Root*, *Greninjite*. Both now FIRED-AND-BOARDS-MATCH.
- **abilities** — nothing was red on the previous artifact either. 0 → 0.
- **moves** — *Dragon Cheer*, *Fake Out*, *Matcha Gotcha*, *Psych Up*, *Transform*. All five now
  FIRED-AND-BOARDS-MATCH.

**Deliberately shelved by the owner, still staged and played, counted in neither column:**
*Metronome* (item); *Axe Kick*, *Copycat*, *Electrify* (moves).

**Denominators, because a count with no denominator is a caption:**

- items — 139 tested of 148 in scope of 148 total; 8 not stageable (*Focus Band*, *King's Rock* and
  *Quick Claw* are sub-100% chances the driver's pin cannot express; *Aspear Berry* and *Rawst
  Berry* cure a condition no 100-accuracy move in this format inflicts; *Leppa Berry* is pure PP;
  *Scope Lens* needs a crit the pin never lets land; *Shed Shell* needs a voluntary switch the
  script language has no action for). **None of those is an absent mechanic — each is a fixture
  limit, and the instrument says so itself.**
- abilities — 130 tested of 202 in scope of 316 total; 114 OUT OF SCOPE (no legal carrier in this
  regulation — a fact about the format, not a gap); 27 not stageable; **45 UNATTRIBUTABLE** because
  the control arm is itself a live ability (aftermath, analytic, angerpoint, anticipation,
  battlebond, berserk, cheekpouch, compoundeyes, cudchew, damp, earlybird, forewarn, frisk,
  gluttony, heavymetal, hydration, illuminate, justified, keeneye, klutz, magicguard, magmaarmor,
  merciless, minus, moxie, noguard, opportunist, pickpocket, pickup, poisonheal, pressure, rivalry,
  screencleaner, skilllink, slushrush, sniper, stall, stalwart, steadfast, stickyhold, superluck,
  supremeoverlord, tangledfeet, telepathy, trace). Those count in NEITHER column and the clause says
  so out loud.
- moves — 475 tested of 500.

**One thing the items stage reports that is not attributable to any entity and should not be read as
one:** two fixture-level differences seen while staging *Chesto Berry* — `status_counter` and
`party.status_counter` on a benched Kangaskhan, Showdown 2 / ours 1. They appear in the CONTROL arm
too, so they are a property of the staging. Reported, not charged to the berry.

---

## 3. THE MECHANICS CLAUSE — IT CAN NOW ANSWER, AND THE REASON IT COULD NOT IS DIAGNOSED

The brief asked whether "the reach filter cannot be applied" was staleness or something else. **It
was something else, and it was the instrument's input, not the instrument.**

`engine/quarantine.js:718` walks `['moves','abilities','items']` and refuses to filter if any
population has no per-entity rows:

```js
const list = Array.isArray(j && j.rows && j.rows[kind]) ? j.rows[kind] : null;
if (!list) { rowsMissing.push(kind); continue; }
```

`data/all-mechanics-fire.json` carried **only `rows.moves`**, because
`engine/all_mechanics_fire.js` defaults to `--kind moves`. So the clause could not apply the
usage-reach shelf or the decision-impact filter to abilities or items at all, and fell back to
counting every divergence unfiltered.

I therefore ran it twice, and both artifacts are stamped:

1. `--release 0faabe2a3f1b --write` (exactly as briefed) → moves only → clause printed
   *"THE REACH FILTER CANNOT BE APPLIED … 22 MECHANICS DISAGREE"*.
2. `--kind all --release 0faabe2a3f1b --write` → moves 500 + abilities 316 + items 148 rows → clause
   **answers**.

The moves-only artifact is preserved for comparison in the session scratchpad at
`gr-mechfire-movesonly-backup.json`.

### What it now says

> 29 of 36 DIVERGING MECHANICS ARE PLAYED AND UNCLEARED

Raw diverging, by population: **moves 22, abilities 12, items 2 = 36**. Seven fall below the reach
shelf (one anchor — 25 clicks in 64,846 stored games — carried to each population at the same rate):
*recycle* (22 clicks), *gastroacid* (11), *reflecttype* (11), *corrosivegas* (1), *sweetscent* (1),
*healbell* (0 clicks), and item *Leppa Berry* (1 team). That leaves **29 played and uncleared**.
Every diverging mechanic has a store-derived usage number — none is UNKNOWN.

Worst by reach, named:

| mechanic | reach |
|---|---|
| ability Cursed Body | 2,177 teams / 13,116 open-sheet games |
| ability Toxic Debris | 1,840 teams |
| move Disable | 1,799 clicks / 64,846 stored games |
| ability Regenerator | 1,596 teams |
| move Poltergeist | 1,383 clicks |
| item Mental Herb | 967 teams |

Full diverging lists:

- **moves (22)** — attract, bellydrum, chillyreception, clangoroussoul, corrosivegas, cottonspore,
  disable, dragoncheer, dragondarts, ficklebeam, gastroacid, healbell, poltergeist, recycle,
  reflecttype, scaleshot, shellsidearm, smackdown, stringshot, sweetscent, switcheroo, teeterdance
- **abilities (12)** — angerpoint, berserk, cloudnine, cursedbody, electromorphosis, hustle,
  magicbounce, regenerator, sandforce, sapsipper, supremeoverlord, toxicdebris
- **items (2)** — leppaberry, mentalherb
- shelved by the owner and still played: bittermalice, nightdaze (moves), forewarn (ability),
  metronome (item)

### The board-material subset, since that is now the bar

The artifact's own board tally, per population — this is a MEASURED split, not a judgement that
something "looks cosmetic":

| population | NO-DIVERGENCE | ANNOUNCEMENT-ONLY | STATE (board-material) |
|---|---|---|---|
| moves | 469 | 21 | **6** |
| abilities | 156 | 10 | **4** |
| items | 70 | 2 | **1** |

**The 11 STATE rows, named:** *Axe Kick*, *Clear Smog*, *Heal Bell*, *Reflect Type*, *Role Play*,
*Shell Side Arm* (moves); *Hustle*, *Klutz*, *Magic Bounce*, *Sand Force* (abilities); *Metronome*
(item).

Three of those parted on the BOARD with the two protocol streams in agreement — a silent state
defect the protocol arm structurally cannot see. Five ANNOUNCEMENT-ONLY rows write a leaf the board
does not read (*attract*, *chillyreception*, *dragoncheer*, *gastroacid*, *smackdown*), so they are
UNASKED rather than clean, and the artifact says so.

### The comparison that is NOT legitimate

**22 → 29 is a re-baseline, not a regression.** The old number counted moves only with no filter
applied; the new number counts three populations with the reach shelf applied. Different population,
different filter, same release. Do not subtract them.

---

## 4. WHAT GOT WORSE

**Nothing got worse.** Every clause is the same or better, every roster count is the same or better,
and no artifact I wrote reports more breakage than its predecessor once the populations are matched.

The one thing that is worse than it looked is not a regression but a discovery:

**`engine/wire_ladder.js` CANNOT BE RUN AT ALL, AND `data/wire-ladder.json` IS PERMANENTLY WITHHELD
UNTIL ITS ARMS ARE RE-PINNED.** The run exits 4 having written nothing — correctly. This is
LESSONS §12 (a release freezes the engine and not the reader) at full scale:

```
Error: release cf6a68fa412c was frozen before engine/medicham2-browser.js exported:
  natureL50, rngStreams, spreadL50
```

I checked every arm. **All fifteen arms — across fourteen distinct pinned releases — LACK all three
symbols:** `cf6a68fa412c`, `28e66a7c9ab8`, `0771dc47b5f6`, `41e28311e591`, `6b6f898f136f`,
`128a1ca28d34`, `1e29ff6c431b`, `45485dee6a43`, `3fd06d865427`, `0aa54cb1a9de`, `dd3da7c69cb0`,
`86048ca3a422`, `dc3c43336539`, `26f96c7894d7`.

`engine/engine_release.js compat` reports **178 of 351 releases can serve the caller; 168 predate an
export.** The ladder's whole point is a historical sequence of pre-WIRE releases, so every rung is on
the wrong side of that line. **The historical ladder is not recoverable — it is a figure to withhold
and re-measure, never to resurrect.** The instrument needs re-pinning onto releases that provide the
symbols, or the arms need rebuilding; either way that is ENGINE/MEASURE work, not a re-run, and I
did not attempt it. `data/wire-ladder.json` stays at 2026-08-07 and stays UNSAFE; the "release
ladder" figure stays WITHHELD in `status.js`.

---

## 5. THE REGISTER (`register_reality.js`)

Run LAST of the instruments, and then run AGAIN after the `--kind all` mechanics artifact landed, so
it cannot be republishing a verdict computed against an artifact that moved under it. **`--list` was
never used.**

- 321 register rows, 366 id rows, 60 open-asserting-breakage, 39 marked with an instrument
- **1 STALE ROW: #402** — the row is OPEN and its instrument exits 0. *"Two published
  seed-prevalence figures are withheld — the generator's species lookup dropped…"* The register
  overstates here. Loudest verdict in the file, because it is the one that costs an agent.
- **0 premature closes** (was 1 at 06:13 — improved)
- 5 INSTRUMENT UNRUNNABLE: **#316, #318, #319, #320, #322** — each marker is not a plain
  `node <repo script>.js [--flags]` command, so none was run. Not agreement, and not evidence.
- 29 rows are INSTRUMENT OWED (was 13) — the register grew, and the growth is honest debt: the rows
  now say what would have to be built.

I edited no register row and propose the text in §7 instead.

---

## 6. WHAT I DID NOT DO, AND WHY

Per the brief: measure, fix nothing.

- Did not `--stamp-whole-game`. The direction-of-travel withholding is correct until somebody decides
  the `middle` pin is the pin to hold; that is a decision.
- Did not `--update` or `--accept` anything.
- Did not run `register_reality --list`.
- Did not touch `docs/ROADMAP.md`.
- Did not run a refit. It stays OWED and is gated behind the engine, not behind compute.
- Did not delete anything. `data/_pair-pilot.json` is untracked, is not mine, and is still there.
- Killed nothing. No process of mine hung.

---

## 7. OWED, NOT RUN

1. **`engine/wire_ladder.js` — BLOCKED, not merely owed.** All 15 arms pin stranded releases. Needs
   re-pinning before it can produce a figure at all. `data/wire-ladder.json` withheld until then.
2. **`data/decision-impact.json` is absent.** Written by a paired argmax run
   (`engine/argmax_paired.js`, ROADMAP #278) with arms differing by the FIX. Two clauses — whole-game
   and mechanics — currently excuse **nothing** on decision impact, so both count every played
   divergence. This is the single cheapest thing that could move either number honestly.
3. **The whole-game baseline re-stamp** under `A/middle/pins:1fd77b835ee2`, if that is the pin
   intended to be held. Until then, direction of travel is withheld by construction.
4. **The MAG refit.** `feature_fixture --check` still FAILS on two gates: fixture identity (rounding
   6→6, scenarios 10→12) and the damage table (318 species → 322, digest `405c836793d1` →
   `1bda9df11d73`). **A restamp answers the fixture gate and SILENCES the table gate** — the table
   verdict must be settled first or the evidence for the refit is written over. A damage table that
   moved means REFIT, not restamp. Four inputs moved after the fit: `medicham2-browser.js`,
   `board.js`, `engine-data.js`, `abra-tags.js`.
5. **The 58 quarantined artifacts**, including my own one number. `data/winrate-backtest.json` —
   **leaf calibration — remains QUARANTINED and is withheld, not annotated.** I cannot publish a
   reliability curve while the gate is closed; a curve measured through a simulator known to part
   from the authority on 21 games in 961 is a claim about the wrong engine. It becomes re-runnable
   when the gate opens. ROADMAP #57 is the re-run list.
6. **Five register instruments that cannot be run** by `register_reality.js` (#316, #318, #319,
   #320, #322) because their markers are not plain node commands.

### Proposed register row text (I did not edit `docs/ROADMAP.md`)

**Proposed — the release ladder is unrunnable end to end.**

> **THE WIRE LADDER'S FIFTEEN ARMS ALL PIN STRANDED RELEASES, SO THE INSTRUMENT CANNOT PRODUCE A
> FIGURE.** `engine/wire_ladder.js` exits 4 on arm `a01-baseline-run1` and writes nothing — correctly.
> All fourteen distinct pinned releases (`cf6a68fa412c` … `26f96c7894d7`) were frozen before
> `engine/medicham2-browser.js` exported `natureL50`, `rngStreams`, `spreadL50`; `engine_release.js
> compat` says 168 of 351 releases predate an export. `data/wire-ladder.json` is dated 2026-08-07,
> is UNSAFE in provenance, and `status.js` WITHHOLDS the release-ladder figure. This is LESSONS §12
> at ladder scale: a stranded artifact is withheld and re-measured, never resurrected. The unit of
> work is re-pinning the arms onto releases that serve the caller, or rebuilding them — not a re-run.
> VERIFIED BY: `node engine/wire_ladder.js`
> Status: open — MEASURE.

**Proposed — #402 should close.**

> #402's instrument now exits 0 while the row is open; `engine/register_reality.js` calls it the only
> STALE ROW in the file. The register overstates. Close it or narrow its scope.

**Proposed — the mechanics artifact must be generated across all three populations.**

> **`data/all-mechanics-fire.json` WAS PUBLISHED WITH `rows.moves` ONLY, AND THE QUARANTINE CLAUSE
> THAT READS IT COULD NOT APPLY ITS FILTERS AT ALL.** `engine/all_mechanics_fire.js` defaults to
> `--kind moves`; `quarantine.js:718` requires per-entity rows for moves, abilities AND items and
> falls back to counting every divergence unfiltered when any is absent — printing *"THE REACH FILTER
> CANNOT BE APPLIED"*. Re-run with `--kind all` on 2026-08-23 and the clause answers: 29 of 36
> played and uncleared. The default is the defect: an instrument whose default output silently
> disables its own consumer's filter. Either default to `all` or have the writer refuse to publish a
> partial artifact to the canonical path.
> Status: open — MEASURE.

---

## 8. RUN LOG — EVERY STAMP CHECKED AFTER EVERY STEP

| step | command | exit | artifact `generated` | release |
|---|---|---|---|---|
| 0 | `engine_release.js cut "gate refresh 2026-08-23"` | 0 | cut event appended | `0faabe2a3f1b` |
| 1 | `tests/roster.js --stage items --release 0faabe2a3f1b --write` | 0 | 11:42:57Z | `0faabe2a3f1b` |
| 2 | `tests/roster.js --stage abilities --release 0faabe2a3f1b --write` | 0 | 11:43:17Z | `0faabe2a3f1b` |
| 3 | `tests/roster.js --stage moves --release 0faabe2a3f1b --write` | 0 | 11:43:58Z | `0faabe2a3f1b` |
| 4a | `all_mechanics_fire.js --release 0faabe2a3f1b --write` | 0 | 11:44:32Z | `0faabe2a3f1b` |
| 4b | `all_mechanics_fire.js --kind all --release 0faabe2a3f1b --write` | 0 | 11:47:21Z | `0faabe2a3f1b` |
| 5 | `wire_ladder.js` | **4** | **NOT WRITTEN** — stranded releases | n/a |
| 6 | `register_reality.js` (twice; second after 4b) | 1 | 11:48:06Z | n/a |
| 7 | `quarantine.js` (twice; second after 4b + 6) | 0 | — | reads `0faabe2a3f1b` |
| 8 | `status.js --write` | 0 | 11:48:5xZ | — |

Every run went through `tools\lownode.cmd` at BELOWNORMAL. The wrapper's exit-code propagation was
verified first, on this box, this session: `process.exit(3)` came back as 3.

`engine/publish_guard.js` diverted nothing — no new file appeared under `data/verification/`, so
every number above is from the published artifact and not from a scoped one.
