# Settled-tree gate reading, and an audit of every surviving COULD-NOT-STAGE reason

**Division:** MEASURE. **Date:** 2026-09-07 / 2026-09-08 UTC.
**Tree:** settled at `0a46239b`, no other agent running. Nothing in `engine/` was edited by this pass.

This file is a dated findings record. It is not maintained and is not current state —
`node engine/status.js` is.

---

## Part 0 — the pins

| pin | value |
|---|---|
| engine release | `f30bf025ae28` — read from `data/engine-release.json` (`current`), never from `engine_release.js list` |
| release cut reason | `MEASURE settled-tree gate re-read: three concurrent engine holds staled the whole-game clauses` |
| tree digest status computes | `f30bf025ae28` — identical, so the release IS the tree |
| Showdown commit | `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4` |

The cut appended two events to `data/releases/f30bf025ae28/cuts.jsonl` (a re-cut over an identical
tree appends, it does not overwrite). The first carries a mangled reason string — `"MEASURE:` — from
a bash-to-cmd quoting loss; the second carries the full sentence. Reported, not edited: cuts are
append-only events.

---

## Part 1 — the gate, read verbatim off `node engine/status.js`

**7 of 9 clauses PASS. 2 FAIL. The gate is still CLOSED.** Before this pass, six clauses failed and
**every one of the six failed for STALENESS** (`MEASURED AGAINST A DIFFERENT ENGINE`). After
re-measuring on `f30bf025ae28`, four of those six turned out to be PASSING all along and two are real.

| # | clause | before | after | why |
|---|---|---|---|---|
| 1 | game differential (damage) | PASS | **PASS** | 0 of 6000 at every one of the 16 damage-roll corners, seed 20260804 |
| 2 | deliberate roster / items | FAIL (stale) | **FAIL — MEASURED** | 0 DIFFER, 0 DID-NOT-FIRE, 140 of 148 tested, **1 red demonstration did not behave as its rule predicted** |
| 3 | deliberate roster / abilities | FAIL (stale) | **PASS** | clean: 146 of 202 tested |
| 4 | deliberate roster / moves | FAIL (stale) | **PASS** | clean: 487 of 500 tested |
| 5 | coverage / every used mechanic measured by something | PASS | **PASS** | all 412 moves above 25 clicks |
| 6 | whole-game differential / BOARD-MATERIAL | FAIL (stale) | **PASS** | **0 of 958 games** |
| 7 | whole-game differential / NARRATION | FAIL (stale) | **FAIL — MEASURED** | **63 of 961 = 6.6%**, across 62 causes |
| 8 | mechanics / each staged and compared | FAIL (stale) | **PASS** | 5 diverge, 1 declared, 4 below the reach shelf, 0 cleared on decision impact, **leaving 0** |
| 9 | no open, known engine defect | PASS | **PASS** | no open row names a RED instrument (112 verdicts read) |

### Clause 6 verbatim (BOARD-MATERIAL)

> BOARD-MATERIAL: 0 of 958 games. Every compared turn boundary in every game holds the SAME BOARD on
> both engines. … UNCAUSED — 0 of the 0 game(s) part a BOARD while the protocol NEVER diverges at all
> (0 less 0 whose protocol also parted: 64 protocol divergence(s) less 64 whose board never did). …
> ORDER OF PARTING — 0 game(s) parted a BOARD before the protocol did and 0 held the board together
> after the protocol parted. … **10675 of 10675 turn boundaries compared were IDENTICAL.**

The bar is `state.games` (958) less `state.games_board_never_diverged` (958) = **0**. That is the
clause, read as the clause. `by_cause_totals` is `null` in this artifact and is not the bar.

### Clause 7 verbatim (NARRATION)

> NARRATION-ONLY: 63 of 961 = 6.6% of games diverge in NARRATION and never part a board, across 62
> cause(s) (64 narration-only raw, less 1 declared and 0 cleared on decision impact). … **THIS CLAUSE
> NOW HOLDS THE GATE SHUT.** Will, 2026-08-22: board-material now, narration as its own separate gate
> AFTERWARDS — and afterwards has arrived, because the BOARD-MATERIAL clause reads zero. Nothing was
> switched on by hand … **TAIL: 60 of 62 narration-only cause(s) occur in exactly ONE game.**

Largest causes: `-fail` field 3 (`|-fail|p2b|allyswitch` vs `|-fail|p2b`) — 2 games; event missing
from medicham2 (`|-fail|p2a` vs `|faint|p2a`) — 2 games. Everything else is a singleton.

### Clause 2 — the one thing that moved in a direction nobody predicted

Items reads `0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE`, which is the expected number. It FAILS on a
different term: **`item/hp-floor`'s red demonstration applied its break and nothing caught it.**

```
data/roster.items.json  reds[9]
{"rule":"item/hp-floor","ok":false,
 "why":"the HP floor stops holding the body up — the item is still held and still read",
 "moved":null}
```

The plant is not a dead anchor — `plant_anchors: {checked:18, dead:[], reds_ran:true}`, so the string
matched exactly once and the patch applied. The rule's only member is `focussash`, staged as
`meowscarada at FULL takes a lethal X-Scissor (1.8x its HP) and must survive; whimsicott beside it,
chipped 22 off 135 by Aura Sphere, takes a lethal Dire Claw and must NOT`. **With the item's
`survivesFromFull` lookup nulled the boards still match, so `focussash: FIRED-AND-BOARDS-MATCH` is a
green that is currently backed by nothing.**

This is NEW EVIDENCE rather than a regression, and the distinction matters: the committed artifact at
`HEAD` carries `reds_ran: false`, so its zero bad reds counted zero reds. The last run that did play
them (release `1be57a100d59`, `docs/_reports/2026-09-07-red-plant-repair.md`) read 18 of 18 items
caught. Between then and now the only source that moved is `engine/medicham2-browser.js`
(the syrupbomb source-faint fix). **Whether that fix disarmed the plant or the plant was already
fixture-dependent is UNMEASURED and belongs to ENGINE.** MEASURE does not repair staging.

### The sample line, in full

| | |
|---|---|
| command | `node engine/game_differential.js --steering empirical --release f30bf025ae28 --arm middle --end-state --census data/verification/census-pin-9446a684709d.json --games 1200 --team-store data/team-pool-frozen --write` |
| `--games` | **1200 requested, 961 played** (the pinned pool does not hold 1200 pairs) |
| `--turns` | **50** — the default, not passed. `state.games_cut_off_by_the_turn_cap` = **0** |
| arm | `middle` (real seeded dice, shared by category) |
| release | `f30bf025ae28` |
| census pin | `data/verification/census-pin-9446a684709d.json`, digest `9446a684709d`, 643 rows |
| team pool | `data/team-pool-frozen`, digest `0d103fb9fa87`, 8778 teams, 1968 picked |
| driver | `empirical-click/v1`, driver code `4dd225b7e8c9` over 11 files, unchanged across the run |
| elapsed | 162.6 s |

**THE CAP CHANGED AND THAT IS A CHANGE OF QUESTION, NOT A BETTER ANSWER.** The superseded artifact ran
at `turns_cap 20`; this one runs at the current default of **50**. `engine/game_differential.js` says
so in its own header: *"A figure measured at 20 and a figure measured at 50 are two answers to two
questions … [the sweep] explicitly does NOT [link] 50 against 20, where 35 games were cut short."*
Cap 50 and cap 100 ARE linked (byte-identical bar `agreement_by_turn`), so 50 is the reproducible
default. At cap 50 **no game is truncated at all**, which the cap-20 artifact could not say.

Roster and census commands (each read straight off the gate, not reconstructed):

```
node tests/roster.js --stage items     --reds --write
node tests/roster.js --stage abilities --reds --write
node tests/roster.js --stage moves     --reds --write
node engine/all_mechanics_fire.js --kind all --write
```

### What moved against the expected reading

| expected | measured | |
|---|---|---|
| board-material 0 of 958 | **0 of 958** | matches, now at cap 50 instead of cap 20 |
| narration ~62 | **63 of 961 across 62 causes** (64 raw, 1 declared) | matches |
| roster items 140 / abilities 146 / moves 487, 0 DIFFER, 0 DID-NOT-FIRE | **140 / 146 / 487, 0 / 0** | matches exactly |
| census 830/830 | **830/830 probed mechanics live, 0 missing** | matches |
| — | **`item/hp-floor` red demonstration not caught** | **NOT EXPECTED. Reported loudly.** |

`data/all-mechanics-fire.json` is numerically IDENTICAL to the superseded one — moves
`diverged 4 / resolution_disagreements 11`, abilities `diverged 1`, items `diverged 0`, before and
after. Only `engine_release` moved (`1be57a100d59` → `f30bf025ae28`). The staleness was hiding
nothing.

---

## Part 2 — every surviving `COULD-NOT-STAGE` reason, tested against the code as it is today

**The population is 28 rows, not 142.** `data/roster.abilities.json` carries 124 `COULD-NOT-STAGE`
verdicts, and **114 of them are `out_of_scope: no-legal-carrier`** — abilities no legal species in
this regulation holds. Those are not gaps and are not listed here. The in-scope set is
**items 8 + abilities 10 + moves 10 = 28**.

The 28 reason strings are **byte-identical before and after the engine moved**, so this audit applies
to what is on disk now.

### Summary

| verdict | count | rows |
|---|---|---|
| **EXPIRED — the whole justification falls** | **2** | `leppaberry`, `shedshell` |
| **EXPIRED sub-clause — a second clause still binds** | **2** | `focusenergy`, `struggle` |
| **CITATION EXPIRED — the claim stands, the symbol it names does not** | **3** | `focusband`, `kingsrock`, `quickclaw` |
| **CANNOT TELL — and the reason is materially misdescribed** | **1** | `galewings` |
| **STILL TRUE but MISFILED** — zero legal carriers, so it is not an in-scope gap | **1** | `guarddog` |
| **NOT A REASON** — the harness threw; there is no justification here at all | **2** | `imprison`, `memento` |
| **STILL TRUE** | **17** | the rest |

**Seven of the 28 stated reasons carry a clause that is no longer true.** Two of those seven fall
entirely.

---

### EXPIRED — the whole justification falls

**`leppaberry` — `item/pp-restore`.** Stated:

> *"its whole effect is on PP, and board_state.js does not compare PP in either engine (medicham2 does
> not track it at all), so there is no board leaf it could move"*

**FALSE on every clause.** Evidence, all four independent:

- `engine/board_state.js` snapshots PP on both sides — `pp: [0,1].map(...ctx.ppSpent(act[i])...)`
  (:1503) against `sdPP((sd.active||[])[i])` (:1591), walked at :1759-1768.
- The file carries an explicit tombstone where the claim used to live (:120-123): *"PP WAS HERE AND IS
  NOW COMPARED. The entry read 'medicham2 does not track PP at all', which was true when it was
  written and stopped being true at ROADMAP #144."*
- `engine/medicham2-browser.js` exports `ppSpentMap` (9 occurrences), and there is a named mapping
  proof `pp-is-what-has-been-spent` (board_state.js:381-494) for the lazy-vs-eager difference.
- **Tonight's own differential red-demonstrates it.** `data/game-differential.json`, planted proof:
  `{"what":"PP SPENT off by one on a slot the body has already used","applied":true,"caught":true,`
  `"moved_a_compared_leaf":true,"paths":["p1.pp[0].gunkshot"]}` — plus a second plant for the
  lazy-table blind spot, also caught.

This is Will's catch (*"showdown tracks pp"*) confirmed by measurement. A Leppa Berry restoring PP
moves a compared leaf.

**`shedshell` — `item/trapping-escape`.** Stated:

> *"it undoes TRAPPING, which needs a voluntary switch to observe; the script language has no switch
> action and board_state.js does not compare ability trapping at all"*

**Clause 1 is FALSE.** `tests/roster.js` has a first-class switch action: `switchProbe` on a scenario
and `switchVerdict()` at :1711, dispatched at :2122-2125. **Ten rows are staged with it in tonight's
artifacts and all ten pass** — `shadowtag` (abilities) and `bind, block, firespin, infestation,
meanlook, sandtomb, snaptrap, whirlpool, wrap` (moves).

**Clause 2 is true of `board_state.js` and false as a conclusion.** That file's own `NOT_COMPARED`
entry for ability trapping carries `measured_by: 'tests/roster.js (switchVerdict) — a REFUSAL
comparison, not a board comparison'`, and the note beside it says exactly what this row got wrong:
*"for two months that was read as 'nothing compares it'."* Shed Shell needs a refusal comparison,
which is the mechanism that exists.

This is the same correction the coordinator already made once today (ROADMAP #549). It has a second
occurrence and this is it.

---

### EXPIRED sub-clause — a second clause still binds

**`focusenergy` — `move/is-the-control-click`.** Clause 1, *"this move IS the control arm's inert
click"*, is **STILL TRUE and binding**: `tests/roster.js:275` returns `'focusenergy'` as `INERT`.
Clause 2, *"Its effect — two critical-hit stages — is also not a leaf board_state.js compares"*, is
**EXPIRED**: `volatile:focusenergy` is one of the 54 compared leaves (added in the 2026-08-12 sweep;
confirmed by `tests/probe_uncompared_leaves.js` `derive()`). Only the crit-ratio MAGNITUDE is
uncompared, which is not what the sentence says.

**`struggle` — `move/recoil`.** Clause 1, *"Showdown DISABLES Struggle for any body that still has a
usable move"*, is **STILL TRUE and binding**. Clause 2 — *"which the script language has no way to
arrange because medicham2 does not track PP at all (board_state.js NOT_COMPARED)"* — is **EXPIRED**
for the same reasons as `leppaberry`. PP is tracked and compared. Whether the script language can
spend a whole moveset is a separate, unasked question; the stated blocker for it is gone.

---

### CITATION EXPIRED — the claim stands, the symbol it names does not

`focusband`, `kingsrock`, `quickclaw` all say:

> *"the driver's pin makes every sub-100% roll fail in both engines (game_differential.js
> PRIMARY_ARM: "no secondary fires")"*

**The claim is STILL TRUE.** Every roster row runs `arm: top-tie-first`, resolved BY NAME
(`tests/roster.js:994, :1043`), and that arm's pin does make every sub-100 roll fail
(`tests/roster.js:979`).

**The citation is dead.** `engine/game_differential.js:1929` is `const PRIMARY_ARM = ARMS[0]`, and
`ARMS[0]` has been the **`middle`** arm since 2026-08-13 (`cf7a2c5a`) — whose own `what` string says
the opposite: *"Moves miss at their printed accuracy, secondaries fire at their printed chance."* The
quoted words *"no secondary fires"* live at :1892, on the arm literally named `top-tie-first`. The
file's own comment at :1932 flags that this rename already cost four red clauses once.

This is the dead-anchor shape exactly: the quoted text still exists, the symbol named for it now means
something else, and the sentence reads as authoritative either way. **The reasons should cite
`STAGED_ARM` / `ARM_BY_ID.get('top-tie-first')`, never `PRIMARY_ARM`.**

---

### CANNOT TELL — and the reason is materially misdescribed

**`galewings` — `ability/priority-mod`.** Stated:

> *"talonflame are legal, buildable and have a second ability to control with — and none of them has a
> FASTER foe in this format that its own Flying click (Drill Peck) kills outright"*

Derived from `Dex.forFormat('gen9championsvgc2026regmb')`, filtered on
`x.exists && !x.isNonstandard && x.tier !== 'Illegal'`: **Talonflame [Flame Body / Gale Wings], base
Speed 126** — legal, buildable, second ability present, so the first half is right.

The second half names a click Talonflame **cannot legally hold**: `drillpeck` appears in the learnset
of neither `talonflame`, `fletchinder` nor `fletchling`. Drill Peck comes from the harness's generic
per-type `DELIVERY` table (`tests/roster.js:371-420`, chosen for being boring), not from the carrier.

So the refusal is a property of the **DELIVERY table**, while the sentence attributes it to *"a fact
about the FORMAT'S ABILITY LIST"*. Talonflame's strongest legal Flying click is **Brave Bird
(120 BP, 100 accuracy, `9M` on its own line)** — half again Drill Peck's 80, STAB, off a 126-Speed
body — and the 13 legal species faster than 126 include several frail ones. **Whether a legal
Talonflame click kills a faster legal foe outright has never been asked.** Brave Bird's recoil may
well be a legitimate reason the delivery table refuses it, which is why this is CANNOT TELL rather
than EXPIRED. **Falsifier:** run the rule with the carrier's own best legal Flying click instead of
the delivery move and see whether every faster foe still survives.

---

### STILL TRUE but MISFILED

**`guarddog` — `ability/refuses-a-forced-switch`.** *"Every species with it: none."* Derived: **zero
legal carriers in this regulation.** The reason is true, but a row with no legal carrier belongs in
`out_of_scope: no-legal-carrier` beside the other 114 — not counted as one of the 10 in-scope ability
gaps. **It inflates the in-scope gap count by one and puts an unplayable entity in front of a reader.**

---

### NOT A REASON — the harness threw

**`imprison`** (`move/volatile`) and **`memento`** (`move/boosts-target`) both record:

> *"the SUBJECT arm did not run: THREW — p1 choice rejected p1 "pass, move 1": Can't pass: Your Goodra
> must make a move (or switch)"* (and the same shape with Milotic)

These are not justifications for being unable to stage anything. They are **unrepaired fixture faults
— a scripted `pass` on a slot the authority requires to act** — and they reproduce unchanged on
`f30bf025ae28`. They sit in the same bucket as a derived refusal, so a reader counting "reasons we
cannot stage this" is counting two crashes.

---

### STILL TRUE (17)

| row | rule | what was checked |
|---|---|---|
| `aspearberry` | `item/status-cure` | derived: **zero** legal moves inflict `frz` outright at ANY accuracy — the reason is stronger than it states |
| `rawstberry` | `item/status-cure` | derived: exactly **one** legal move inflicts `brn` outright, and its accuracy is sub-100 |
| `scopelens` | `item/crit-ratio` | `tests/roster.js:2559` — *"NO CRIT LANDS IN EITHER ENGINE IN EITHER ARM"* — and `critsLand()` measures it rather than asserting it |
| `aerilate` | `ability/type-conversion` | only legal carrier is Pinsir-Mega, one ability slot — no second ability to control with |
| `dragonize` | `ability/type-conversion` | only legal carrier is Feraligatr-Mega, one ability |
| `filter` | `ability/damage-taken-scoped` | only legal carrier is Aggron-Mega, one ability |
| `furcoat` | `ability/unconditional-stat-multiplier` | only legal carrier is Furfrou, one ability |
| `megalauncher` | `ability/base-power-scoped` | Blastoise-Mega AND Clawitzer are both legal — **and both carry exactly one ability**, so the reason survives a carrier it does not name |
| `cutecharm` | `ability/contact-plants-a-volatile...` | `game_differential.js:3216-3220` still writes `gender: 'N'` on both sides; the refusal is DERIVED at run time (`/gender/.test(vol.condition.onStart)`, `tests/roster.js:5387`), so it is self-correcting |
| `ripen` | `ability/stat-drop-reaction` | `data/abilities.ts:3840-3847` — `onChangeBoost` is gated on `(effect as Item).isBerry`, so a foe's click can never reach it. Champions does not override `ripen` |
| `zerotohero` | `ability/entry` | every citation lands: `flags: {failskillswap:1, cantsuppress:1}` at `data/abilities.ts:5632`; `skillSwap` returns false at `sim/battle.ts:1316`; Gastro Acid `onTryHit` refuses at `data/moves.ts:6437`. Both carriers (Palafin, Palafin-Hero) hold it in one ability slot |
| `extremespeed` | `move/priority` | an independent learnset walk returns the same 4 legal species with the same ability lists the reason prints — the row is DERIVED, not typed |
| `iceshard` | `move/priority` | independent walk returns **9** legal learners, matching the stated count |
| `jetpunch` | `move/priority` | independent walk returns **1**: Palafin [Zero to Hero] |
| `aurawheel` | `move/type-changing` | Morpeko and Morpeko-Hangry are legal, separate species; Morpeko's only ability IS Hunger Switch, the knob the reason names as owed |
| `ragingbull` | `move/type-changing` | three legal Tauros-Paldea formes, separate species, no forme-flip knob |
| `upperhand` | `move/priority` | the reason is a MEASUREMENT taken on this run — inert over 1491 compared leaves — and it says so: *"This is the honest coverage limit, not a pass"* |

---

## What this pass did NOT do

- **No engine source was edited.** No staging was fixed. Part 2 produces the list; repairing it is a
  separate, attributable change and belongs to ENGINE.
- **No version bump, no `CHANGELOG.md` entry, no `status.js --write`, no commit.**
- **No SPRT was read.**
- The `item/hp-floor` red-demonstration failure is REPORTED, not repaired.

## The documentation gate went red on the re-measurement, and was fixed rather than filed

`tests/test-docs-current.js` clause 3b(b) — *a figure attributed to an artifact is IN that artifact* —
gained two entries the moment the artifacts were republished. Both were reported and closed in this
pass; the gate now reads **33 passed, 0 failed**.

**(a) `docs/ABRA-technical-docs.md:17` — a real, pre-existing stale figure.** It stated
*"`data/roster.abilities.json` reports 0 and 0. It tests **129** of 202. `data/roster.moves.json`
reports 0 and 0. It tests **475** of 500."* Both were already false before this pass — the artifacts
have read 146 and 487 since the roster rebuild — and the citation passed only because 129 and 475
happened to occur somewhere in the five artifacts co-cited by the same paragraph. **The retraction had
already been written**: the roster row in `docs/RUNNING-NOTES.md` says `moves 475 -> 487` and records
deleting the superseded triple from `docs/SUMMARY.md`. It missed this document. A retraction never
waits for a major, so the two figures are corrected here. This is the coincidence-match failure mode
working in the project's favour for once: the gate could not see a stale figure until an unrelated
artifact stopped hiding it.

**(b) `docs/ABRA-whitepaper.md:59` — a coincidence, and the document is right.** The figure is `113`,
inside a block stamped `5.262.0` narrating a fix sequence: *"King's Shield's stat punish routed
through `Battle#boost` (board-material 50 to 48, protocol 114 to 113)"*. It is a historical waypoint,
never a claim about what `data/game-differential.json` holds today, and it passed only because 113
occurred somewhere in the old artifact. **Editing a dated block in place is forbidden** and would
destroy the record of what those six fixes moved, so this is a hand-edited ratchet entry in
`data/docs-currency-baseline.json` with its reason recorded beside it — following the identical
2026-08-13 precedent already in that file (*"THE FIGURE DID NOT CHANGE AND NEITHER DID ITS DOCUMENT —
the ARTIFACT it was coincidentally matching did"*). Per the baseline's own `note_known`, **that is a
reported defect and not an approval.** The real repair is a citation form that can name a historical
value without being read as a live one.

## Debris

There is none to report. The four files that were untracked at the start of the session
(`data/verification/_prediction-2026-09-07-spread-target.json`, `data/verification/batchJ/`,
`docs/_reports/2026-09-07-longtail-batch-J.md`, `tests/probe_spread_target_die.js`) were committed in
`c7ed3a4c` before this pass began. Nothing was deleted and nothing was moved.
