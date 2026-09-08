# NARRATION BATCH 1 — the gate's own selftest, then the 71

**Division:** ENGINE. **Date:** 2026-09-07. Written as the work happened; earlier sections are not
rewritten when a later one overturns them.

---

## 1. THE SELFTEST RED WAS A PHOTOGRAPH OF ONE SIDE OF A KNOB

`engine/quarantine.js --selftest` read **232 passed / 1 failed** at the start of this session:

```
FAIL SPLIT / GATE — and the SHIPPING assembler is the thing being described: the live gate
     carries exactly one reporting clause and it is the narration one   got []
```

**It is a consequence of BOARD-MATERIAL reaching zero, and the arm was wrong rather than the
engine.** `narrationClause` computes `gates = !!(board.ok === true && board.pins)` — exactly as its
own 2026-09-06 header promises — so the moment the board clause passed, narration stopped REPORTING
and started GATING, and the live `reporting` list emptied. The assertion asserted the state of one
side of a flip that was always going to turn: the same shape as an anchor tied to a source string.

**What it was really defending holds on both sides of the flip, so that is what it asserts now**
(`engine/quarantine.js`, the `SPLIT / GATE` block):

- exactly one live clause names NARRATION and it declares `gates` as an **explicit boolean** — a
  clause that never decided reads identically to one that decided to gate;
- NARRATION is the **only** clause in the live gate that may opt out of gating;
- **the relation:** narration gates *exactly when* the live BOARD-MATERIAL clause passes with a
  receipt, so `reporting` is empty exactly when boards are clean.

The third arm reads two clauses out of ONE live gate and asserts a relation between them, so it is
not a restatement of `gateVerdict`'s filter — that filter is satisfied by a hand-typed `gates` flag
and this arm is not.

**SHOWN RED ON A DELIBERATE BREAK BEFORE BEING TRUSTED.** Replacing the derivation with
`const gates = false;` takes the selftest to **231 passed / 4 failed**, and the new arm is one of
the four:

```
FAIL SPLIT / GATE — narration gates EXACTLY when the live BOARD-MATERIAL clause passes ...
     got "board clean=true narration.gates=false reporting=[\"whole-game differential / NARRATION ...\"]"
```

Restored: **235 passed / 0 failed.**

---

## 2. THE RE-DERIVED CLASS COUNTS, ON RELEASE `1be57a100d59`

Read off `data/game-differential.json`'s own `end_state[0].summary.by_cause` — the **uncapped** list, 73
rows, not `state.first_divergences` (60, capped) and not `state.first_board_divergences` (40, capped).

Sample line (identical for every run in this report but the release and the dump path):

```
SHOWDOWN_PATH=... node engine/game_differential.js --steering empirical --release <id> --arm middle \
  --end-state --state --census data/verification/census-pin-9446a684709d.json \
  --games 1200 --turns 20 --team-store data/team-pool-frozen \
  --dump-games 80 --dump-out <path> --write
```

`--games 1200` is part of the SAMPLE (961 played, 958 readable, 3 void), not a budget.

| class | games |
|---|---|
| ordering | 23 |
| event missing from medicham2 | 22 |
| extra event emitted by medicham2 | 14 |
| unrelated event mismatch | 8 |
| -fail field 3 | 4 |
| showdown stopped emitting while medicham2 continued | 1 |
| **total narration-only** | **72 raw, 71 after the one CLOSETED perish row** |

**68 of the 70 causes occur in exactly one game**, which the spec said and which re-derivation
confirms. **The class name describes the COMPARATOR, not the defect** — reading the 70 cause strings
as MECHANISMS instead gives a completely different, and actionable, ranking:

| mechanism (read across the classes) | games |
|---|---|
| a bare `\|-fail\|<user>\|` the authority writes and this engine does not | 7 |
| `\|-immune\|` lines emitted in a different ORDER (Levitate / Soundproof) | 5 |
| `\|-boost\|<x>\|<stat>\|0` — a capped boost the authority still announces | 5 |
| `\|-hitcount\|…\|1` this engine writes and the authority does not | 5 |
| `\|-fail\|` missing its THIRD field (`allyswitch`, `substitute\|[weak]`) | 4 |
| Supreme Overlord's `-activate` against the `\|switch\|` beside it | 3 |
| Aegislash `detailschange` on a faint the authority does not write | 3 |
| a `-curestatus <x> frz [msg]` this engine writes and the authority does not | 3 |
| `\|-activate\|<x>\|ability: Mega Sol` — never emitted here | 3 |
| Protect vs an ability immunity (Good as Gold) — which line comes out | 3 |
| `\|-end\|<x>\|flashfire` on the holder's switch-out | 2 |

---

## 3. FIX 1 — A PARENTAL BOND VOLLEY THAT LANDS ONE ARRIVAL ANNOUNCES NOTHING

The authority's clause has a third term this engine never carried:

```js
if (move.multihit && typeof move.smartTarget !== 'boolean' &&
    !(move.hit === 1 && move.multihitType === 'parentalbond')) {
  this.battle.add('-hitcount', targets[0], hit - 1);
}                                      data/mods/champions/scripts.ts:547-551
```

`multihitType` is written by Parental Bond's `onPrepareHit` and by nothing else, so Beat Up, the 2-5
family and a natural two-hit move that land ONE arrival all still print `1`. **That asymmetry is the
whole fix and it is what CTRL-B holds.**

**PROBE FIRST, AND IT WAS WRONG TWICE BEFORE THE ENGINE WAS.** `tests/probe_bond_one_arrival_hitcount.js`:

- first cut had **both p2 slots clicking Protect**, so no click ever landed and all four arms read two
  empty lists — four quiet failures that looked like an engine verdict;
- second cut asserted CTRL-B's count as `1` while the authority printed `2`: Double Hit is 35 BP an
  arrival and the KO fell on arrival **2**, not 1. The arm was fixed by giving it a body that dies to
  the THIRD volley's first arrival (Incineroar) and asserting the authority's whole sequence
  `[2, 2, 1]` rather than `[0]`. **Reading element `[0]` compared two identical 2s and called it a pass.**

Arms, on the corrected fixture: RED (bond, arrival 1 kills) authority `[]` / this engine `[1]`;
CTRL-A (bond, both arrivals land) `[2]` / `[2]`; CTRL-B (**the knob** — same mega, same Parental Bond
on the field, same body, Double Hit instead) `[2,2,1]` / `[2,2,1]`; CTRL-C (same script one body over,
dies to arrival 2) `[2,2,2]` / `[2,2,2]`.

RED knob `MEDI_BOND_ONE_ARRIVAL_HITCOUNT=1`, stamping `MEDFAILS.bondOneArrivalHitcountRestored`. Both
arms PASS after the fix, and the restore reproduces the same red.

**MEASURED.** Release `2cfe3ebc4098`, prediction written first to
`data/verification/_prediction-2026-09-07-narr1-hitcount.json`.

| | before `1be57a100d59` | predicted | after `2cfe3ebc4098` |
|---|---|---|---|
| BOARD-MATERIAL | 0 of 958 | 0 | **0 of 958** |
| `state.first_board_divergences` | `[]` | `[]` | **`[]`** |
| narration-only games | 72 | 67 (band 67–72) | **69** |
| protocol diverging games | 75 | 70 (band 70–75) | **72** |
| narration causes | 70 | 65 (band 65–70) | **67** |

**PREDICTION MISS: 69 against a point estimate of 67, inside the stated band.** The cause diff is
exact and explains it — **five causes GONE, all five the `-hitcount` family, and TWO NEW, both
`[from]drain`:**

```
GONE  extra event emitted by medicham2 :: |-damage|p1a|0fnt|[from]psn     <> |-hitcount|p2:|1
GONE  extra event emitted by medicham2 :: |-damage|p1a|H/H|[from]recoil   <> |-hitcount|p2:|1
GONE  extra event emitted by medicham2 :: |-damage|p2a|0fnt|[from]recoil  <> |-hitcount|p1:|1
GONE  extra event emitted by medicham2 :: |move|p2b|moonblast             <> |-hitcount|p1:|1
GONE  extra event emitted by medicham2 :: |move|p2b|rockslide             <> |-hitcount|p1:|1
NEW   event missing from medicham2 :: |-heal|p1a|H/H|[from]drain <> |-damage|p2a|H/H
NEW   event missing from medicham2 :: |-heal|p2a|H/H|[from]drain <> |-supereffective|p1a|1
```

**Two of the five games TRANSFERRED**, and they transferred onto a defect batch N had already named
and owed in the hand list: *a multi-arrival drain is paid ONCE at the foot of the volley, where the
authority pays one per arrival.* Same final HP, one `-heal` line instead of two. It was hidden behind
the `-hitcount` line in those two games, which is exactly what "the count is a lower bound" means.

**THE WIRE REACHED THE POOL AND SAYS SO.** `engine/game_differential.js` prints it on every run,
console only, no artifact field:

```
Parental Bond volleys that landed ONE arrival and therefore announced NO |-hitcount|: 7
```

Seven suppressions, of which five were somebody's FIRST divergence. A zero here beside a moved
narration count would have meant the movement came from somewhere else.

---

## 4. FIX 2 - MEGA SOL SAYS SO, AND ONLY THE FIVE CALLERS THAT ASK IT TO

`effWeatherOf` is the RETURN half of `sim/pokemon.ts:2195-2202`. The other half is a LINE hanging off
a second argument this engine had no analogue for:

```js
if (weather !== 'sunnyday' && message) this.battle.add('-activate', this, 'ability: Mega Sol');
return 'sunnyday' as ID;
```

`message` is passed by exactly FIVE handlers - `effectiveWeather(undefined, true)` in Solar Beam,
Solar Blade, Moonlight, Morning Sun and Synthesis. **Weather Ball, Growth, Thunder, Hurricane and
Blizzard all read the same private sun and stay silent**, so this is not "announce whenever the
private sun is read". Every other half of Mega Sol was already wired (WIRE 99 damage, WIRE 126 type,
ROADMAP #186 charge, Leaf Guard, the sky's freeze refusal) - only the line was missing.

**THE MEMBERSHIP IS A SHAPE, SO IT IS PRINTED BOTH WAYS AND ASSERTED.** The engine reads
`data/tags.json` and cannot see a handler body, so it matches
`weatherScaled.byWeather.sun` carrying `chargeSkip` or a `healFraction`.
`tests/probe_megasol_announce.js` computes that AND the source membership off the live dex on every
run and FAILS on a difference of one entry either way:

```
tag shape  : moonlight, morningsun, solarbeam, solarblade, synthesis
the source : moonlight, morningsun, solarbeam, solarblade, synthesis
shape-only: (none)   source-only: (none)
```

`data/tags.json` was NOT regenerated - the params already carried everything the predicate needs.

Five arms, three knobs: RED-1 Solar Beam with no weather; RED-2 Synthesis (a different caller, so the
fix cannot be a Solar Beam special case); **CTRL-A the SKY** (a real sun - the authority's own
`weather !== 'sunnyday'` guard, same body, same move, line must vanish); **CTRL-B the ABILITY** (a
non-mega Meganium - no line, and the move CHARGES); **CTRL-C the MOVE** (Weather Ball from the same
Meganium-Mega - silent, and the arm is not vacuous because the private sun still makes it FIRE,
proved by landing it on a Ghost a Normal Weather Ball cannot touch).

**PROBE FAULT CAUGHT:** RED-2 was written expecting ONE line and the authority wrote TWO - the
wounding turn spends a Synthesis of its own. Corrected to 2 before the fix went in.

**MEASURED.** Release `a9b05e61146a`, prediction in
`data/verification/_prediction-2026-09-07-narr1-megasol.json`.

| | before `2cfe3ebc4098` | predicted | after `a9b05e61146a` |
|---|---|---|---|
| BOARD-MATERIAL | 0 of 958 | 0 | **0 of 958** |
| narration-only games | 69 | 66 | **66** |
| protocol diverging games | 72 | 69 | **69** |
| narration causes | 67 | 64 | **64** |

**Point estimate on every clause. Three causes GONE, ZERO new** - `|-activate|p2b|megasol` against
`|-damage|p1a|0fnt`, against `|-resisted|p1a|2`, and against `|-activate|p1a|protect`.
Pool counter: `private-weather announcements ... 8`.

---

## 5. FIX 3 - A VOLLEY DRAINS ONCE PER ARRIVAL, AND THE FIRST CUT PARTED TWO BOARDS

`sim/battle.ts:2160-2171` sits inside `spreadDamage`'s per-target loop, and `spreadMoveHit` runs it
once per hit - so a two-arrival Drain Punch heals TWICE. This engine paid one heal at the foot of the
volley on the row total. It was **already named and owed**: `probe_bond_arrival_reprice` printed
*"drain LINES: showdown 2, medicham 1 <- NARRATION, owed"* on every run, and batch N's hand list
carried it. Fix 1 made it MEASURABLE by uncovering it in two games.

### THE FIRST CUT WAS WRONG AND THE BOARD CLAUSE IS WHAT SAID SO

Release `028392265ab7` passed the arrival's PACKET to the drain. The authority's variable is
`targetDamage` - **the HP the bar actually gave up** - so an overkill heals on the victim's last few
HP. **BOARD-MATERIAL 0 -> 2**, both a Kangaskhan Drain Punch:

```
p2.party.kangaskhan.hp   medicham 157   showdown 102     (a Ditto with 52 HP left)
p1.party.kangaskhan.hp   medicham 160   showdown 147     (a Toxapex on 2 HP; sd healed 1, we healed 13)
```

That is the FIRST named risk in the prediction file firing, and the narration figures from that run
are **not published** - the run also parted two boards, so it measured an engine this division does
not ship. The prediction file records the miss rather than being rewritten.

**NONE OF THE FOUR ORIGINAL ARMS COULD SEE IT**: RED and CTRL-C kill nobody, CTRL-A lands one arrival,
and CTRL-B's cap swallowed the difference. Two things were added:

- **RED-2, THE OVERKILL** - three wounding turns so the user's bar is deep enough that the second
  heal is not capped, then a volley whose arrival 2 kills with damage to spare. Authority
  `[78, 125, 133]`; the first cut wrote `136`.
- **A WHOLE-SERIES ASSERTION IN EVERY ARM.** The file previously asserted the COUNT and the FINAL HP,
  and both were satisfied by a fix that healed the wrong amount on an intermediate arrival.

The fix now pays `_hpBeforeArrival - Math.max(0, tg.curHP)`. **A third arm was also relabelled after
being read:** CTRL-B was written as "arrival 1 kills" and is not - Drain Punch is 75 BP and neutral
into an Electric body, so `-hitcount` reads 2. What it actually measures is better and is kept: the
first arrival FILLS the bar, so the second heal moves nothing and `Battle#heal` writes no line.

**MEASURED.** Release `bc99dcc268ce`.

| | before `a9b05e61146a` | predicted | first cut `028392265ab7` | after `bc99dcc268ce` |
|---|---|---|---|---|
| BOARD-MATERIAL | 0 of 958 | 0 | **2 of 958 - REGRESSION** | **0 of 958** |
| narration-only games | 66 | 63 | (withheld) | **63** |
| protocol diverging games | 69 | 66 | (withheld) | **66** |
| narration causes | 64 | 61 | (withheld) | **61** |

Point estimate on every clause. **Three causes GONE, ZERO new.** Pool counter:
`volley drains paid PER ARRIVAL ... 1452`.

---

## 6. THE BATCH, END TO END

| | start `1be57a100d59` | end `bc99dcc268ce` |
|---|---|---|
| BOARD-MATERIAL | 0 of 958 | **0 of 958**, `first_board_divergences` `[]` |
| narration-only games, RAW | 72 | **63** |
| narration-only, declared-adjusted (what `status.js` prints) | 71 | **62** |
| protocol diverging games | 75 | **66** |
| narration causes | 70 | **61** |
| census live / probed / missing | 830 / 830 / 0 | 830 / 830 / 0 |

Eleven causes closed, two games transferred onto a defect that was already named, and the two
transfers were then closed by fix 3.

---

## 7. ANOTHER AGENT WROTE TO `engine/medicham2-browser.js` DURING THIS BATCH

**REPORTED, NOT TOUCHED.** The brief said this session was the only agent running. It was not.

```
engine/medicham2-browser.js   modified 2026-09-07 19:28:45 local
  + MEDSEEN.perTurnVolatileSourceFaintedInSlot
  + MEDFAILS.volSrcSlotOnlyRestored   /   MEDI_VOLSRC_SLOT_ONLY
  + `sourceOffField` - "has the source left the field", one fact with two implementations
tests/probe_syrupbomb_source_faint.js   NEW, 19:26       (not this session's)
tests/roster.js                          modified 19:36  (not this session's)
data/mechanics-census.json               regenerated 19:30 (this session regenerated it at 19:08)
```

**EVERY FIGURE IN THIS REPORT SURVIVES, AND THAT IS CHECKED RATHER THAN ASSUMED.** Each measurement
opened a frozen release, and `grep -c perTurnVolatileSourceFaintedInSlot` reads **0** in the frozen
`engine/medicham2-browser.js` of `1be57a100d59`, `2cfe3ebc4098`, `a9b05e61146a`, `028392265ab7` and
`bc99dcc268ce`, and **2** in the live tree and in `f30bf025ae28`. The photograph held.

**WHAT DOES NOT SURVIVE IS THE LIVE GATE.** `engine/status.js` now reads
*"MEASURED AGAINST A DIFFERENT ENGINE - data/game-differential.json ran on release `bc99dcc268ce` and
the tree is `f30bf025ae28`"* and WITHHOLDS both whole-game clauses, so it prints **6 of 9 failing**
where the batch left **1 of 9**. That is the instrument being correct.

**THE RE-RUN IS NOT THIS SESSION'S TO MAKE.** A differential on `f30bf025ae28` measures their change
and these three together, and attributing the result to either would be the 2026-08-04 void run in a
new costume. `data/engine-diff.json` was re-run at 19:36 and is stamped `f30bf025ae28` - it is a
MIXED-TREE artifact and no figure is quoted from it here.

Owed, to whoever holds the tree next: one differential and one roster pass on the settled tree, with
both changes named.

**LAST CHECK, ON THE COMBINED TREE.** All three new probes were re-run against the LIVE tree after the
other agent's change had landed and all three read PASSED, with their counters moving
(`privateWeatherAnnounced = 3`, `drainPaidPerArrival = 8`, and the bond arms green). That says the two
changes do not collide at the probe level. It says NOTHING about the pool, which is the run nobody has
made on the settled tree.

**AND THE CONCURRENCY IS WIDER THAN ONE AGENT.** A final `git status` also shows
`docs/{MEASURE,OPS,SEARCH,WEB}.md` modified (a `status.js --write` this session did not run),
`data/verification/horizon/` with two `_prediction-2026-09-07-horizon*.json` files, and
`docs/_reports/2026-09-07-chance-gated-abilities.md`. None of it is this session's, none of it was
touched, and it is listed so the next reader knows the tree holds several agents' work at once.

**FILES THIS SESSION TOUCHED** — nothing committed, nothing deleted:

- `engine/medicham2-browser.js` — three fixes. The file also carries another agent's change, left alone.
- `engine/quarantine.js` — one selftest arm re-aimed.
- `engine/game_differential.js` — three console counters, no artifact field, so a run before and after
  the block is the same measurement.
- `tests/probe_bond_one_arrival_hitcount.js`, `tests/probe_megasol_announce.js`,
  `tests/probe_drain_per_arrival.js` — new.
- `data/verification/_prediction-2026-09-07-narr1-hitcount.json`, `-megasol.json`, `-drain.json` — new.
- `data/verification/narr1/dump-baseline.txt`, `-fix1`, `-fix2`, `-fix3`, `-fix3b` — new.
- `docs/ENGINE.md`, `docs/RUNNING-NOTES.md`, and this report.

`node engine/status.js --write` was NOT run and no version was bumped, per the brief.
