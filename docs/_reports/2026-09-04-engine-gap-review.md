# ENGINE gap review — what nothing is measuring (2026-09-04)

READ-ONLY pass. Nothing in the tree was changed. No game was played; every number below is read out of
an artifact or derived by a light probe. Scratch probes live in the session scratchpad, not in the repo.

Artifact ages at read time (UTC clock 2026-09-04T02:30Z):

| artifact | generated | age |
|---|---|---|
| `data/all-mechanics-fire.json` | 2026-09-04T01:30Z | 1.0 h (mtime 1 h old — settled, not being written) |
| `data/roster.abilities.json` | 2026-09-04T01:29Z | 1.0 h |
| `data/mechanics-census.json` | 2026-09-04T00:17Z | 2.2 h |
| `data/engine-diff.json` | 2026-08-29T06:49Z | 5.8 days |
| `data/interaction-matrix.json` | 2026-08-11T22:00Z | 23.2 days |

**Two probe errors of my own, corrected before anything was reported, because the brief is right that
the probe is wrong before the engine is:**

1. My first comment-stripper for the `consumedBy` audit removed **string bodies as well as comments**.
   The engine consumes a tag as a string literal (`TAGS.has('move', id, 'multiHit')`), so that stripper
   destroyed the real signal and reported **182** comment-only consumers. Keeping strings and stripping
   only comments gives **38**. The control was then cleared explicitly: a prose-only phrase present in
   `medicham2-browser.js` reads `raw=true stripped=false`, so the stripper can see a difference.
2. I read `node tests/run-all.js --coverage` as `EXIT=0`. That was `tail`'s exit code through a pipe.
   Run without the pipe it is **EXIT=1**. The finding in §5 stands only because of the second reading.

---

## 1. The 22 uncompared-but-standing board leaves, ranked by what a real game hits

`tests/probe_uncompared_leaves.js derive()` gives `total 80 / compared 34 / ceiling 56 / declared 4 /
standing_at_the_boundary 22`. Ranked here by summed **corpus uses** of the leaf's writers from
`data/tags.json` — real clicks for moves, **sheet counts for abilities and items** (the Blaze caveat:
an ability's `uses` is presence on a sheet, not firings; for always-on abilities the two are close, for
conditional ones they are not).

| rank | leaf | writers (uses) | why it stands |
|---|---|---|---|
| 1 | `volatile:throatchop` | throatchop **5,577** | duration 2, so it is standing at the next boundary every time it lands |
| 2 | `volatile:unburden` | ability unburden **5,036** (sheet) | no duration — persists until the item comes back |
| 3 | `volatile:mustrecharge` | hyperbeam 4,576 + gigaimpact 67 + hydrocannon 30 + rockwrecker 9 + blastburn 11 + frenzyplant 8 = **4,701** | duration 2 — the recharge turn IS a boundary |
| 4 | `volatile:flashfire` | ability flashfire **1,416** (sheet) | no duration |
| 5 | `volatile:allyswitch` | allyswitch **361** | duration 2 |
| 6 | `volatile:lockedmove` | outrage 129 + petaldance 18 + ragingfury 4 + thrash 0 = **151** | duration 2, residual-cleared |
| 7 | `pseudoWeather:gravity` | gravity **119** | duration 5 — stands across four boundaries |
| 8 | `volatile:noretreat` | noretreat **118** | |
| 9 | `slotCondition:wish` | wish **82** | |
| 10 | `volatile:stockpile` | stockpile **70** | |

Tail (all below 50 uses, in order): `smackdown` 40, `minimize` 35, `dragoncheer` 34, `item metronome` 27,
`healingwish` 23, `futuremove` 20, `wonderroom` 12, `gastroacid` 8, `magicroom` 4, `powertrick` 2,
`lockon` 0, `powershift` 0.

**Order the widening work 1–7 and stop.** Everything from `smackdown` down is under 50 corpus uses and
belongs to the obscure tail Will deprioritised on 2026-08-23. Note the shape of the top three: Throat
Chop and Must Recharge are **standing on the very next turn boundary after they are written**, which is
the cheapest possible thing for the comparator to read and the most likely to be wrong.

Cross-check performed: every tag carried by all 22 writers **is** probed by the census
(`unprobed: -` on all 22 rows). So none of these is dark — the claim is narrower and correct: their
**leaf state** is written by the engine and read by no comparator.

---

## 2. Ranged mechanics 0 of 8 — and yes, it is the King's Rock lesson again, but the range is the small half

### What the row actually says
`coverage.js rangeStaged()` finds exactly one ranged tag param: `multiHit`, `range [2,5]`,
`distribution "2:35 3:35 4:15 5:15"`, on 8 moves (`bonerush bulletseed iciclespear pinmissile rockblast
scaleshot tailslap watershuriken`). `interior: 2` each — counts **3 and 4**. The two pinned arms select
index 0 and index 19 of the authority's twenty-entry table, i.e. 2 and 5.

**The count-draw itself is low risk.** `medicham2-browser.js` `rollHitsOf` copies
`MULTIHIT_2_5=[2,2,2,2,2,2,2,3,3,3,3,3,3,3,4,4,4,5,5,5]` verbatim and indexes it with
`Math.floor(rnd()*20)`, which is `battle.sample`'s `random(items.length)`. Same table, same order, same
index. Reaching 3 and 4 would very probably reproduce.

### The bigger hole the row does not print
`data/engine-diff.json` reads `requested 6000 / compared 6000 / agreed 6000 / disagreed 0`. Beside it:

```
skipped_multihit 134
skipped_multihit_moves {pinmissile:13, bulletseed:11, rockblast:25, tripleaxel:13, dualwingbeat:48,
                        twinbeam:5, iciclespear:5, populationbomb:7, scaleshot:2, dragondarts:2,
                        watershuriken:3}
skipped_ability_multihit 17  {parentalbond:17}
   on moves {doubleedge:4, icepunch:1, suckerpunch:3, fakeout:4, drainpunch:4, lastresort:1}
```

So **no volley's damage has ever been compared to the authority at ANY count**, not merely in the
interior. That includes six moves whose count is **fixed** and therefore has no range problem at all —
`dualwingbeat` (6,158 corpus clicks, drawn and skipped 48 times), `tripleaxel` (1,230),
`twinbeam` (1,327), `dragondarts` (195), `populationbomb` (650), `doublehit` (1). The `0 of 8` framing
undercounts the excluded population: **14 multi-hit moves plus 17 Parental Bond clicks.**

`tests/probe_multihit_corners.js` compares the **count**. Nothing compares the **damage**.

### The class of defect this hides — and it is exactly the King's Rock shape
King's Rock was validated on ordinary moves and wrong on volleys because the die is taken **per landed
arrival**, not per click; medicham2 wrapped the step list once per move and ran it once. That was found
by hand after a question from Will, not by any gate, and the probe that now proves it
(`tests/probe_kingsrock_volley.js`) is **run by nothing** (see §5).

Everything with a **per-arrival** semantic sits in the same blind spot. Derived legal population, with
sheet counts:

| mechanism | tag | carriers (uses) |
|---|---|---|
| contact punisher fires per landed hit | `punishesAttacker` | roughskin **12,029**, cursedbody 3,291, toxicdebris 2,115, static 866, flamebody 432, poisonpoint 117, cutecharm 130, effectspore 37, sandspit 34, gooey 29 |
| threshold heal crossed mid-volley | `healsAtThreshold` | sitrusberry **24,468**, oranberry 1 |
| boost on being hit, once per hit | `buffsHolderOnHit` | stamina **4,217**, electromorphosis 135, weakarmor 73, justified 66, angerpoint 20 |
| HP-threshold boost crossed mid-volley | `boostsAtHPThreshold` | berserk 65 |
| damage reduction re-evaluated per hit | `damageReduce` | multiscale 1,054, solidrock 526 |
| ability rewritten on contact | `rewritesAbilityOnContact` | mummy 105, wanderingspirit 90 |
| move disabled on contact | `disablesAttacker` | cursedbody 3,291 |
| count pinned to max | `multihitAlwaysMax` | skilllink 30 |

**HYPOTHESIS, not a measured defect:** I found no instrument that exercises any of these *inside* a
volley. `all_mechanics_fire.js` stages one mechanic at a time; `engine-diff` skips every multi-hit move;
the roster stages the volley alone; `data/interaction-matrix.json` is 23 days old and staged 2,250 of
7,103 theoretical pairs. Confirming this needs a run, which this pass was not permitted to do. The
cheapest falsifier is one probe: Rough Skin or Stamina as the **target** of Rock Blast, count pinned at
each of 2/3/4/5, HP and boost stages compared.

---

## 3. Abilities 170/316 and items 73/148 — one is unreachable, one is work, and the compared half is softer than it reads

### Items: NOT work
148 rows, 73 with a board, 75 without. The 75 are **exactly** the `out_of_scope` set and every one
carries the same declared reason: *"a mega stone — the mechanism is the MEGA, and the per-stone answer
is in `data/roster.items.json`, which this run reconciles against."* Zero items are no-board-and-not-
out-of-scope. Caveat worth carrying: the named alternate instrument is the roster, which was itself
lying for nine days (162 of 169 accusations were the ruler).

### Abilities: 129 unreachable, 17 reachable-and-dark here, of which 6 dark on BOTH instruments
Of the 146 abilities with no board:

| why | n |
|---|---|
| NO LEGAL CARRIER — no species this format admits has it | **129** |
| NO CONTROL — every legal carrier has this as its only ability | **14** |
| the carrier body could not be built | **2** (ditto: limber, imposter) |
| could not stage: TeamValidator refused the team | **1** (greninja: battlebond) |

So the missing half is **129 unreachable + 17 real**, not 146. And the 17 are the wrong 17 to be
missing, because "the only ability its carriers have" means **100% uptime in every game that mon is in**:

| ability | carrier | sheet uses | roster verdict | dark on both? |
|---|---|---|---|---|
| levitate | chimecho | 4,045 | FIRED-AND-BOARDS-MATCH | no |
| goodasgold | gholdengo | 3,996 | FIRED-AND-BOARDS-MATCH | no |
| **zerotohero** | palafin | **473** | COULD-NOT-STAGE | **YES** |
| stancechange | aegislash | 422 | FIRED-AND-BOARDS-MATCH | no |
| disguise | mimikyu | 248 | FIRED-AND-BOARDS-MATCH | no |
| limber / imposter | ditto | 235 / 124 | FIRED-AND-BOARDS-MATCH | no |
| mummy | cofagrigus | 105 | FIRED-AND-BOARDS-MATCH | no |
| wanderingspirit | runerigus | 90 | FIRED-AND-BOARDS-MATCH | no |
| **megalauncher** | clawitzer | **53** | COULD-NOT-STAGE | **YES** |
| hungerswitch | morpeko | 50 | FIRED-AND-BOARDS-MATCH | no |
| surgesurfer | raichualola | 19 | FIRED-AND-BOARDS-MATCH | no |
| **forecast** | castform | **15** | COULD-NOT-STAGE | **YES** |
| **mimicry** | stunfiskgalar | **13** | COULD-NOT-STAGE | **YES** |
| **furcoat** | furfrou | **7** | COULD-NOT-STAGE | **YES** |
| **illusion** | zoroark | **0** | DEFERRED-BY-OWNER | **YES** |
| **battlebond** | greninja | **0** | CONTROL-NOT-QUIET | **YES** |

Six abilities are measured by **neither** instrument. Per the standing lesson, a COULD-NOT-STAGE verdict
is a claim about the fixture, never about the mechanic — so `zerotohero`, `megalauncher`, `forecast`,
`mimicry` and `furcoat` are fixture work, not facts.

### And the 170 that ARE compared decompose worse than the number suggests
104 FIRED + 58 DID-NOT-FIRE + 8 SHOWDOWN-ONLY = 170 exactly. **58 of the 170 ability "board compared"
rows are two engines agreeing that nothing happened.** The real comparison count is 104.

Within the 58, `cannot_fire_in_this_fixture` explains 38 and **20 are unexplained** — "the gauntlet never
reached its trigger". Ranked by sheet uses:

`prankster` **13,759** (grimmsnarl), `hospitality` **9,620** (sinistcha), `innerfocus` 1,892,
`friendguard` 1,534, `technician` 1,112, `unaware` 520, `magician` 385, `telepathy` 327, `magicguard` 156,
`noguard` 133, `screencleaner` 91, `slushrush` 35, `harvest` 34, `gluttony` 25, `poisonheal` 11,
`lightmetal` 5, `curiousmedicine` 4, `pickup` 3, `longreach` 2, `suctioncups` 1.

Prankster on Grimmsnarl is the single highest-uptime ability in this whole review that no instrument has
made fire.

The 8 SHOWDOWN-ONLY rows all have `NO-DIVERGENCE` or `ANNOUNCEMENT-ONLY` boards, so they are almost
certainly the narration gate rather than the board gate — **HYPOTHESIS**, because `medicham_moved` is
derived from the protocol stream, and an ability that acts without announcing itself reads `false`
whether or not the effect happened. `rockhead` (2,436) and `unnerve` (3,595) are the two worth checking
first if that hypothesis is ever tested.

---

## 4. Gates that would not catch a second instance, reached by another door

### (a) `tests/test-artifact-keys.js` — `ks.slice(0, 8)`. THE STRONGEST ONE.
This is the general-case guard built after `MC.mons` keyed formes `rotom-wash` while callers used
`norm()` — 101 of 308 entries unreachable, 8.17% of usage, failing silently. Its detector:

```js
if (ks.length >= MIN_KEYS && ...) { out.push(...); return; }
for (const k of ks.slice(0, 8)) tables(obj[k], depth + 1, ...);
```

**It descends into only the first eight keys of any object.** An artifact whose preamble is eight keys
long (`generated`, `by`, `design`, `scope`, `seed`, `requested`, `compared`, `agreed`, …) hides its table
completely. Re-running the detector's own code with the width limit removed and nothing else changed:

**13 non-flat name-keyed tables of 50+ keys sit behind that limit today.** None is declared in
`data/artifact-accessors.json`, which has 2 entries.

| artifact | table | keys | non-flat | sample |
|---|---|---|---|---|
| `tag-consumption.json` | `by_tag` | 291 | 275 | `targetClass`, `formatSecondaryCount`, `statusInflict` |
| `million-run-150k.json` | `engine_counters` | 148 | 147 | `flinchBlockedByInnerFocus`, `flinchTooLate` |
| `million-run.json` | `engine_counters` | 141 | 140 | same |
| `policy-weights*.json` (×10) | `featureHashes.features` | 56–58 | 48–50 | `effHalf`, `effQuarter`, `allyHit` |

The second narrowing, `MIN_KEYS = 50`, hides 27 more; most of those are camelCase config blobs and are
noise, but two are the real shape: `guru-matchups.json matrix` keyed `Charizard-Garchomp` (capitalised
AND hyphenated species pairs — the exact failure mode) and `click-censoring-census.json` keyed
`ability: Armor Tail`. The width limit is the structural one; the floor is a judgement call.

### (b) The coverage clause in `engine/quarantine.js` — a tag probed once certifies up to 500 carriers
The clause asks: *does ANY instrument measure this? — the roster staged it, OR the census probes EVERY
tag it carries.* The census row shape is `{kind, tag, label, live, detail, hollow, armed, directCall}`
— **no carrier field.** It probes a tag, once, on one chosen body.

Derived: 4,120 (tag, carrier) pairs exist across moves/items/abilities. The census has 829 rows over 350
tag names. Amplification at the top: `pp` 500 carriers / 2 rows; `targetClass` 500 / 4;
`formatSecondaryCount` 500 / 1; `contact` 166 / 1; `flingable` 148 / 1; `noProtectFlag` 111 / 1;
`callRefusalFlags` 75 / 1; `breakable` 63 / 1.

This is the species-key shape one level up: **the gate is built from an instance and reads as the class.**
It is not a wrong design — a per-carrier census is 4,120 probes — but the clause's sentence
("the census probes EVERY tag it carries, so no aspect of it is unexercised") claims more than the
instrument delivers.

### (c) `tests/test-no-silent-failure.js` — `++` is accepted as "recorded where a later assertion can see"
Line 241 admits `/\+\+/` and `/\+=/` as not-silent. Measured against the engine's actual counter banks:

- `MEDFAILS` has 485 fields, 330 of them primary (not a `*First`/`*Why` sidecar).
- **248 primary MEDFAILS fields are never named in any `.js` under `tests/`, `engine/` or `web/`, nor in
  any `data/*.json`.** Excluding `*Restored` knob bookkeeping, **187**.
- **No generic reader exists.** Every consumer names one field (`M.fails.traceBodyOffField`,
  `M.fails.accEvaSeparateRestored`, …). Nothing iterates `Object.keys(MEDFAILS)` and prints the non-zero
  ones. `MEDI.fails` is exported as the raw object and is read that way in 20-odd places, always by name.

So 187 failure counters satisfy the silent-failure gate and are as unobservable as the discarded catch
the gate exists to stop. Examples with obvious weight: `immunityGateEventNotClaimed`,
`terrainScaledSubjectUnknown`, `critPerArrivalUnsplit`, `critPerArrivalUnaddressed`,
`fractionalPriorityNoBracket`, `ppUnknownMove`, `struggleUnbuilt`, `typeWriterRefusalUnderived`.

### (d) `consumedBy` in `data/tags.json` — a raw substring grep over a file that is 80% comment
`engine/tag_dex.js:466`:

```js
const readsIt = probe => (BOARD.includes(probe) || DMG.includes(probe));
```

`medicham2-browser.js` is 2,886,460 bytes and 564,326 with comments removed. Control cleared as described
at the top. **38 of the 271 `consumedBy` probes appear in the engines only inside comments.** 36 of those
have the tag NAME elsewhere in code, so they are consumed by another route; **2 have neither the probe nor
the tag name in code — `weightBased` and `ignoresAbility`.**

**And that pair proves the instrument is uncorrelated rather than merely lenient.** `ignoresAbility` has
**zero legal carriers** (an inert tag). `weightBased` has four — `lowkick` (**8,538 clicks**),
`grassknot` 611, `heavyslam` 536, `heatcrash` 18 — and it **IS implemented**, through a derived param kind
(`_vp.kind === 'targetWeightKg'` / `'weightRatio'` and `effWeight()`, `medicham2-browser.js:8699` and
:11016–11026), which the grep cannot see. The census confirms it live (*"same Garchomp, only its weight
moves — 5 kg takes 22, 400 kg takes 133"*). So `consumedBy` said "consumed" for the right answer on the
strength of prose. It can be wrong in both directions and the gate-facing figure `tags with an engine
consumer 271/300` is soft by up to 38.

`tests/test-tag-consumed.js` does **not** inherit this — it uses runtime ASKED/FOUND counters through
`engine/tags.js`. That is two producers of one fact, and the weaker one is the one `coverage.js` prints.

### (e) The roster clause's own arithmetic, which is honest and worth restating with numbers
`data/roster.abilities.json counts`: `FIRED-AND-BOARDS-MATCH 129`, `COULD-NOT-STAGE 141`,
`CONTROL-NOT-QUIET 45`, `DEFERRED-BY-OWNER 1`, `FIRED-AND-BOARDS-DIFFER 0`, `DID-NOT-FIRE 0`.
The clause gates on the last two only. **186 of 316 rows assert nothing and the stage reads `clean`.**
This is documented in the clause's own comments and in Will's 2026-08-23 ranking call, so it is not a
hidden gap — but a `clean` beside 141 COULD-NOT-STAGE is a sentence one reader in three will take at
face value.

---

## 5. Red, silent, or asserting nothing

### (a) `node tests/run-all.js --coverage` IS RED TODAY. 59 unaccounted-for checks. Exit 1.
Its own words: *"A check that is neither run nor named. THIS IS THE FATAL ONE."* Current output:

```
COVERAGE — 118 file(s) outside the run list report their own verdict.
  23 named NOT A CHECK, 36 named PENDING-WIRE, 59 unaccounted for.
FAIL — UNACCOUNTED-FOR CHECK. 59 file(s) report a pass/fail verdict but are neither a
listed gate, nor discovered in tests/ as test-*.js, nor named in NOT_A_CHECK / PENDING_WIRE
```

`reportCoverage()` returns `unrun.length + staleExemption.length` and line 491 exits on it; line 687
folds `coverageFailures` into the full-suite exit. **So `tests/run-all.js` is red on this clause, and
`tests/run-all.js --coverage` alone reproduces it in seconds.**

The 59 are almost entirely `tests/probe_*.js` — the probes the working order exists to produce. Among
them, the two that would catch a volley regression:

- `tests/probe_kingsrock_volley.js` — the probe for the exact defect §2 is about
- `tests/probe_multihit_corners.js` — the only thing that compares hit counts at all

and 57 more including `probe_endturn_clock_order.js`, `probe_delayed_crit.js`, `probe_sub_clamp.js`,
`probe_substitute_status_step.js`, `probe_trace_list.js`, `probe_stat_pick.js`,
`probe_fractional_priority_draw.js`, `probe_volley_collapse.js`, `probe_volley_reactor_count.js`.

Two entries in `PENDING_WIRE` are declared **RED** rather than unwired, and both name a blocker that is
not an engine fix:

- `tests/staged_board.js` — 1 of 25 scenarios red. `roar-drags-whoever-is-standing-there`, a temporal
  mirror defect: medicham2 resolves a whole turn while Showdown pauses at U-turn's switch request, so
  the mirror gets the end-of-turn occupant. The entry says ENGINE owns it and it needs its own probe.
- `tests/staged_status_counters.js` — red for a reason no engine fix can reach: its BEFORE arm is
  release `6155acc0fb26`, which is **stranded** (`M.midEventDice is not a function`) on all 11 scenarios.
  Per LESSONS §12 that is a figure to withhold and re-measure, and it needs re-pinning.

### (b) 187 engine failure counters nothing reads — see §4(c). Same class as a discarded catch.

### (c) `data/interaction-matrix.json` is in no coverage line and no gate clause
`theoretical 7103 (flag 6534 / type 413 / field 156)`, `emitted 2250`, `ran 2250` —
**31.7% of the declared cross-product, on a 23-day-old artifact.** `engine/coverage.js` does not read it
(`grep -c interaction-matrix` → `quarantine.js 0, coverage.js 0, status.js 3, open_work.js 4`), so the
4,853 unstaged pairs appear in no scope line beside any verdict. Given §2, this is where a
volley × per-arrival-ability pair would live if anything staged one.

### (d) Cross-namespace counter reads — LOOKED FOR, NOT FOUND
I scanned `tests/` and `engine/` (comments stripped) for `X.fails.<name>` where `<name>` lives only in
`MEDSEEN`, and the reverse. 87 raw matches; **all 87 resolve to local objects named `fails`/`seen` with
array methods, or to knob-conditional fields set only under an env var** —
`probe_mega_trace_entry.js` guards with `hasOwnProperty`, `probe_endturn_clock_order.js` reads a child
run's object. **No defect here.** Recorded so the next pass does not repeat the search.

### (e) The census itself is clean and is not the problem
`data/mechanics-census.json`: `probed 829 / live 829 / missing 0 / armed 829 / unarmed 0 / hollow 0 /
threw 0 / directCall 1`. Nothing hollow, nothing unarmed. The census is doing its job; the gap is that it
answers a per-TAG question and is read as a per-CARRIER one (§4(b)).

---

## OWED

1. **`tests/run-all.js` is RED on its own coverage clause — 59 unaccounted-for checks, exit 1.** Either
   wire each probe in or name it with a reason. This is a red test, not a status, and it makes the
   suite non-green today.
2. **Widen the comparator to the 7 top standing leaves**, in order: `throatchop`, `unburden`,
   `mustrecharge`, `flashfire`, `allyswitch`, `lockedmove`, `gravity`. Stop at 50 uses.
3. **One volley × per-arrival probe**, red first: Rough Skin or Stamina as the TARGET of a `[2,5]` move
   at each of 2/3/4/5 hits, HP and boost stages compared to the authority. This is the King's Rock class
   and no instrument covers it.
4. **Fix `ks.slice(0, 8)` in `tests/test-artifact-keys.js`** — 13 non-flat 50+-key tables are invisible
   to the guard built for exactly this, and none is declared.
5. **Fixture work for six abilities dark on both instruments**: `zerotohero`, `megalauncher`, `forecast`,
   `mimicry`, `furcoat`, and a decision on `illusion` / `battlebond`. A COULD-NOT-STAGE is a claim about
   the fixture.
6. **Make the 20 unexplained DID-NOT-FIRE abilities fire**, `prankster` (13,759) and `hospitality`
   (9,620) first — the gauntlet never reaches their trigger.
7. **Decide what `consumedBy` is for.** A raw substring grep over an 80%-comment file cannot answer it;
   `test-tag-consumed.js`'s runtime ASKED/FOUND already can. Two producers of one fact.
8. **Report only, not ENGINE's to fix:** `tests/staged_status_counters.js` needs a release re-pin
   (stranded baseline, LESSONS §12); `data/interaction-matrix.json` is 23 days old at 31.7% staged and
   is read by no coverage line.
