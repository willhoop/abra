# THE ROW MATCHER STOPPED READING POSITION — 21 ILLEGAL SETS ARE NOW VISIBLE AND THE GATE IS RED

2026-08-27 · MEASURE · ROADMAP #266 · `node tests/test-fixture-legality.js`

## VERDICT

**All 21 are real. None was the instrument. Zero repaired, 21 filed, and the matcher now catches the
CLASS rather than a fourth shape.**

- **21 of 21 rejected by `TeamValidator`, and all 21 are PAIRING** — `X can't learn Y.` No illegal
  species, no illegal item, no `UNREACHABLE` entity: every one of the twelve accused moves has
  between 4 and 102 legal carriers in this regulation, so each is a legal move on a body that cannot
  hold it, not a mechanic the format does not contain.
- **Repaired: 0.** Every one of the 21 lives in a file this batch does not own, and every repair is a
  behavioural change I may not verify — the brief's own rule, *do not repair someone else's file to
  make your gate green*.
- **`tests/test-fixture-legality.js` is RED at 2 FAILED**, naming 15 new verdict sentences and 15 new
  declarations. That is the true state of the tree and it is not baselined: **no allowance was added,
  `origin` is untouched at its closed 41.**
- **The matcher catches the class.** It is not a fourth regex. Position is never consulted; every
  literal's role is asked of the format, and any ordering of species/item/ability/moves matches —
  proved on both known orderings below.
- **Two further findings, filed not gated:** nine `isNonstandard: 'Past'` species named as bare
  literals in three files (including a PINNED benchmark roster), and
  **`champions_sim.checkLegal` cannot validate a single one of this format's 76 mega formes.**

---

## 1. WHAT WAS ARMED, AND WHY IT IS NOT A FOURTH SHAPE

The old matcher (C) was a regex:

```js
const POSROW = /\[\s*(['"])([a-z0-9-]+)\1\s*,\s*\[([^\]]*)\]\s*,\s* ... /gi;
```

It demanded **species first, moves array second**. It was added on 2026-08-14 after that one ordering
hid five illegal sets including a banned item; a *second* ordering — `stage(rows)` writing
`['species', 'item', 'ability', ['move', ...]]`, moves LAST — was measured on 2026-08-26 hiding
413 rows / 157 distinct sets, 124 invisible, 21 rejected. **A third regex buys the third ordering and
loses the fourth.**

What replaced it reads STRUCTURE, which is depth, and never ORDER, which is a slot index:

> Every array literal is a candidate group. `partition()` splits its string literals into those at the
> group's **own level** and those inside a **nested array** (a nested `{...}` or `(...)` contributes
> neither). Every own-level literal is handed to `roleOf`, which asks the format
> (`dex.species.get(s).id === nrm(s)`, and the same for abilities, items, moves). A group declares a
> SET when **exactly one** own-level literal names a species **and** the group carries at least one
> further component — an item, an ability, or a nested array.

Proved on both orderings, from the live scan rather than by reading the code:

```
tests/probe_turn_order.js:36     ['garchomp', '', 'Rough Skin', ['Protect', 'Earthquake']]      moves LAST
  -> {species:"garchomp", item:"", ability:"Rough Skin", moves:["Protect","Earthquake"]}

tests/test-protocol-trace.js:671 ['slowking', ['skillswap',...], 'regenerator', 'leftovers']    moves SECOND
  -> {species:"slowking", item:"leftovers", ability:"regenerator", moves:["skillswap","yawn","scald","trickroom"]}
```

Same code path, opposite orderings, both attributed correctly.

**MEASURED WHEN ARMED, so the change is attributable.** The two candidate readings of the nested array
— *every literal in it is a move* (rule 2 as matcher (A) already applies it) versus *only the literals
that self-name a move* — produce **identical** populations, verdicts and strays: 448 groups, 177
distinct sets, 139 novel, 21 rejected, 16 verdicts, **0 strays**. The first is used, because rule 2
must have one implementation and because a mistyped move name must still reach the validator instead
of being silently dropped.

| | before | after |
|---|---|---|
| files scanned | 425 | 426 |
| set declarations | 872 | **1308** |
| distinct sets | 272 | **411** |
| distinct sets REJECTED | 15 | **40** |
| distinct verdicts | 15 | **30** |
| stray literals | 0 | **0** |
| gate | ALL GREEN | **2 FAILED** |
| baseline verdicts / pairs / origin | 15 / 15 / 41 | **15 / 15 / 41 (untouched)** |

## 2. SHOWN RED, THEN SHOWN DISCRIMINATING

At HEAD before any edit — `node tests/test-fixture-legality.js`:

```
        425 files, 872 set declarations, 272 distinct sets
  ok    no new illegal fixture set — 15 verdicts, all 15 on the baseline
  ...
FIXTURE LEGALITY: ALL GREEN
```

After arming:

```
        426 files, 1308 set declarations, 411 distinct sets
  ok    the sweep found 411 distinct sets to validate
  FAIL  15 NEW illegal fixture set(s). The game would refuse these teams:
  ok    every one of the 15 baselined verdicts is still produced — no stale allowance
  ok    all 15 baseline entries carry a kind and a written reason
  FAIL  15 NEW illegal DECLARATION(S) that no verdict sentence names:
  ok    every one of the 15 baselined declarations is still produced
  ok    all 1 are declared `unreachable` on the baseline, with a written reason
  ok    the closed origin set is intact at 41 historical verdicts
  ok    no new stray literal (0 known)
  ok    the ratchet still discriminates: a planted verdict reads NEW, a baselined one does not
FIXTURE LEGALITY: 2 FAILED
```

### The instrument accused itself once, and it was caught before the report

The first armed run was **3 FAILED**, the third being clause 9: *"THE RATCHET NO LONGER
DISCRIMINATES."* It does discriminate — it had just named all fifteen by name. Clause 9's negative
control was `r.findings[0]`, and the findings sort EXISTENCE-first then alphabetically, so as soon as
fifteen genuinely new verdicts entered the population `findings[0]` became one of them. **A control
arm that only holds while clause 2 is green is clause 2 wired to fire twice.** It now picks a verdict
the baseline actually allows, and reports the negative arm as UNSTAGED (rather than failing) if the
baseline ever empties. That is the seventeenth instrument failure of this kind in two days and the
only one in this batch.

### The matcher was verified against known-good cases before any accusation was believed

- Both orderings parse correctly (§1).
- 371 of the 411 distinct sets are **accepted** by the validator.
- All 16 accusations were re-derived independently through `CS.canLearn` — 16 of 16 `false` — beside
  **11 positive controls** on the same bodies (Incineroar/Fake Out, Garchomp/Earthquake,
  Whimsicott/Tailwind, Milotic/Recover, Clefable/Calm Mind, Snorlax/Body Slam, Archaludon/Flash
  Cannon, Basculegion/Wave Crash, Steelix/Iron Head, Reuniclus/Psychic, Meowscarada/Flower Trick), all
  11 `true`. `CS.learnCounters.validatorThrew === 0` on that run, so no refusal was swallowed.
- **0 stray literals**, so the wider net did not manufacture a single phantom name.

## 3. THE 21, TRIAGED — EVERY ONE REAL, EVERY ONE PAIRING

`carriers` is the number of legal bodies in this regulation that can hold the move, from
`CS.moveCarriers`. **None is zero**, so none is `UNREACHABLE` and none of these fixtures is asserting
a mechanic the format cannot produce. All 21 are re-aimable *in principle*; none is re-aimable
*blind*.

| # | set | validator's sentence | carriers | site |
|---|---|---|---|---|
| 1 | incineroar / Blaze / [Knock Off, Protect] | `Incineroar can't learn Knock Off.` | 95 | `engine/game_differential.js:4840,4910,4979,5002`; `tests/probe_turn_order.js:35,81,87,95`; `tests/test-imposter-transform-line.js:122` |
| 2 | steelix / Sheer Force / [Explosion, Protect] | `Steelix can't learn Explosion.` | 14 | `tests/probe_selfdestruct_winner.js:239` |
| 3 | reuniclus / Overcoat / [Explosion, Protect] | `Reuniclus can't learn Explosion.` | 14 | `tests/probe_selfdestruct_winner.js:240` |
| 4 | incineroar / Blaze / [Agility, Protect] | `Incineroar can't learn Agility.` | 95 | `tests/probe_turn_order.js:55,62,148,157,181,194` |
| 5 | whimsicott / Chlorophyll / [Agility, Protect] | `Whimsicott can't learn Agility.` | 95 | `tests/probe_turn_order.js:58,65` |
| 6 | incineroar / Blaze / [Tailwind, Protect] | `Incineroar can't learn Tailwind.` | 46 | `tests/probe_turn_order.js:70` |
| 7 | garchomp / Rough Skin / [Tailwind, Protect] | `Garchomp can't learn Tailwind.` | 46 | `tests/probe_turn_order.js:71,149` |
| 8 | whimsicott @ Choice Scarf / Chlorophyll / [Protect, Sunny Day, Agility, Tailwind] | `Whimsicott can't learn Agility.` | 95 | `tests/probe_turn_order.js:121` |
| 9 | incineroar @ Choice Scarf / Blaze / [Protect, Knock Off] | `Incineroar can't learn Knock Off.` | 95 | `tests/probe_turn_order.js:122` |
| 10 | garchomp @ Choice Scarf / Rough Skin / [Protect, Thunder Wave, Agility] | `Garchomp can't learn Thunder Wave.` (Agility too, masked) | 101 / 95 | `tests/probe_turn_order.js:123` |
| 11 | whimsicott / Chlorophyll / [Sunny Day, Agility, Protect] | `Whimsicott can't learn Agility.` | 95 | `tests/probe_turn_order.js:147` |
| 12 | milotic @ Choice Scarf / Marvel Scale / [Agility, Protect] | `Milotic can't learn Agility.` | 95 | `tests/probe_turn_order.js:156` |
| 13 | garchomp / Rough Skin / [Thunder Wave, Protect] | `Garchomp can't learn Thunder Wave.` | 101 | `tests/probe_turn_order.js:158` |
| 14 | garchomp / Rough Skin / [Knock Off, Protect] | `Garchomp can't learn Knock Off.` | 95 | `tests/probe_turn_order.js:182,197` |
| 15 | milotic / Marvel Scale / [Protect, Agility] | `Milotic can't learn Agility.` | 95 | `tests/probe_turn_order.js:195` |
| 16 | clefable / Unaware / [Protect, Agility] | `Clefable can't learn Agility.` — **already on the baseline** | 95 | `tests/probe_turn_order.js:196` |
| 17 | meowscarada / Overgrow / [Swords Dance, Protect] | `Meowscarada can't learn Swords Dance.` | 102 | `tests/test-effect-credit.js:52` |
| 18 | snorlax / Thick Fat / [Whirlwind, Protect] | `Snorlax can't learn Whirlwind.` | 37 | `tests/test-encore-fail-silent.js:194` |
| 19 | archaludon / Stamina / [Body Press, Protect] | `Archaludon can't learn Body Press.` | 69 | `tests/test-resolution-order.js:285,298` |
| 20 | clefable / Unaware / [Toxic, Calm Mind, Protect] | `Clefable can't learn Toxic.` | 36 | `tests/test-resolution-order.js:419` |
| 21 | basculegion / Adaptability / [Final Gambit, Protect] | `Basculegion can't learn Final Gambit.` | 4 | `tests/test-resolution-order.js:465,484` |

21 sets → 16 verdict sentences → **15 not on the baseline** (#16 is the one already allowed).

### Why each is FILED and not repaired — the reason, per file

- **`tests/probe_turn_order.js` (13 sets).** Agility is not incidental here; the file's own comment
  chose it: *"Agility is priority 0, harmless to the board, and leaves the +1 as the only thing that
  can move the order."* The BODIES are the subject — *"bodies at KNOWN, DIFFERENT speeds, interleaved
  across the two sides so slot order and speed order disagree"* — so re-aiming onto a legal carrier
  changes the speed tier the probe is built on, and re-aiming the MOVE changes the click whose
  harmlessness was reasoned about. Both edits move the board. **The probe is self-calibrating**
  (*"NOBODY TYPES THE ANSWER"* — Showdown's own `|move|` order is the expectation), which makes a
  repair more likely to be safe and does **not** make it verified.
- **`tests/probe_selfdestruct_winner.js` (2).** Explosion has 14 carriers and the fixture already uses
  four of them (Metagross, Glalie, Forretress, Garbodor); Steelix and Reuniclus slipped. Genuinely
  re-aimable, but the arm's claim is *who empties first and therefore who wins* — a different body is
  a different HP and a different faint order, which is the entire measurement.
- **`tests/test-effect-credit.js` (1).** Meowscarada's Swords Dance is the boost the Haze arm needs.
  The fixture's constraint is written down — *"EVERY BODY HERE IS CHOSEN TO MOVE NO STAT BY ITSELF"* —
  so a replacement must be a Swords Dance carrier with no stat-moving ability, and it changes the body
  Haze is credited against.
- **`tests/test-encore-fail-silent.js` (1).** Snorlax's Whirlwind is the phaze under test against the
  format's only Suction Cups body. Re-aimable onto one of 37 carriers; a different phazer is a
  different speed and a different board.
- **`tests/test-resolution-order.js` (3).** Archaludon's Body Press is the Stamina body's own click in
  a two-line ordering arm. Clefable's Toxic and Basculegion's Final Gambit **are the subject**, and
  Final Gambit has only **four** carriers (Staraptor, Staraptor-Mega, Lucario, Lucario-Mega) — none
  with Basculegion's 195 HP, on which the arm's *"the kill needs no roll"* argument rests.
- **`engine/game_differential.js` (part of #1).** This is the instrument that produces the whole-game
  differential. Editing its staged pool changes the differential population. Hard no.

## 4. TWO FURTHER FINDINGS, FILED NOT GATED

### 4a. Nine `isNonstandard: 'Past'` species named as bare literals, in three files

Dropping the component requirement — matching a group where **every** literal names a species — finds
these. It is **not armed**, and the reason is measured rather than cautious: **this repository names
its own models, CLI flags and playstyle roles after Pokémon**, so `['miltank', 'miltank2', 'no-raw',
…]` (a `BOOL_FLAGS` array in `engine/mew_farm.js`) and `inputs: ['magnemite']` in
`build/build_status.js` are indistinguishable by shape from a roster. Unrestricted, the matcher grows
from 448 groups to 907 and issues those false accusations. The all-species variant reduces the noise
to two false positives and finds nine real ones:

| file:line | species | group |
|---|---|---|
| `tests/bench-medicham.js:45` | **Amoonguss** | `[incineroar, garchomp, dragapult, torterra, farigiraf, amoonguss]` |
| `tests/test-choice-lock.js:56` | **Rillaboom, Amoonguss** | `[rillaboom, amoonguss]` |
| `engine/playstyle.js:63` | **Groudon** | SUN role prior `[torkoal, groudon, ninetales, charizard]` |
| `engine/playstyle.js:64` | **Gigalith** | SAND role prior `[tyranitar, hippowdon, gigalith, tyranitarmega]` |
| `engine/playstyle.js:95` | **Rillaboom, Mienshao, Hitmontop, Purugly** | FAKEOUT role prior |

All seven distinct species are `isNonstandard: 'Past'`, `tier: 'Illegal'`, and **all seven are absent
from `MC.mons`** — `mcKey` throws by name on every one of them. `engine/playstyle.js`'s three role
priors therefore carry six entries that can never match a real game; `tests/bench-medicham.js:45` is a
roster its own comment calls pinned — *"Changing this list invalidates every stored number"* — one
sixth of which is a body this format does not contain.

**What is NOT claimed:** whether the bench copes with that sixth body. One probe was attempted
(`M.buildMon(sp, {})`) and it returned `null` for **every** body including the five legal ones, so it
measured nothing and is reported as inconclusive rather than as a finding.

### 4b. `champions_sim.checkLegal` cannot validate any of this format's 76 mega formes

Measured over `CS.legalRoster().filter(s => s.isMega)` with a trivial `['Protect']` set:

```
megas 76   legal 0   speciesClause 6   transformsInBattle 70   other 0
```

- **70** return *"`<Forme>` transforms in-battle with `<Stone>`, please fix its item"* — the authority
  being RIGHT: a mega is declared as its base plus the stone, never as the forme. `checkLegal` asks a
  question the validator cannot answer.
- **6** return *"You are limited to one of each Pokémon by Species Clause"*, which is an **instrument
  defect**: `fillerSets(dex, skipId)` filters padding by `id`, so a Charizard-Mega-Y subject is padded
  with a Charizard.

No fixture in the current population declares a mega forme as a set, so **no guard was written for a
case that does not occur** — that is bloat, and the header says so instead. But the moment one is
declared, every verdict it produces will be the instrument, which is the shape that manufactured four
phantom engine defects in one session on 2026-08-14. Every `checkLegal` caller inherits this:
`tests/roster.js`, `tests/probe_pair.js`, `tests/test-damage-roll-support.js`,
`tests/test-multihit-roll.js`.

**This also blocks closing blind spot 2.** A variant that allows a multi-species group (which would
reach `engine/validate_damage.js`'s golden master — the file where a human found Choice Band, Choice
Specs and an Amoonguss on 2026-08-25) was measured: it adds exactly **one** extra verdict, and that
verdict is the Species Clause artifact above. Fix `fillerSets` to skip by `baseSpecies` and that
variant costs nothing and buys shape 2's species coverage. `engine/champions_sim.js` is a shared
FACT function and a change to it moves what `tests/roster.js` stages, so it is not this batch's.

## 5. NO GAME NUMBER MOVED, AND NONE COULD

Predicted before the run and confirmed. Two files changed, `engine/fixture_legality.js` and
`tests/test-fixture-legality.js`. Neither is in `engine_release.js`'s 26 frozen `SOURCES`; neither
plays a game, reads the store, touches the census, or writes any artifact under `data/` other than
this gate's own stdout. **Nothing under `data/` was written by this batch.** No fixture file was
edited, so no scenario's board changed.

Cost: the sweep is slower — the scan is 3.0s and the whole gate about 42s, against ~1.5s before,
because the validator is now asked about 411 sets instead of 272. That is the authority doing work.

## FILES

- `engine/fixture_legality.js` — matcher (C) replaced; new `partition()`; header rewritten to state
  the four matched shapes and the four that still walk past, each with its measured reason.
- `tests/test-fixture-legality.js` — clause 9's negative control.
- `docs/ROADMAP.md` — #266 PART FOUR.
- `CHANGELOG.md`, `docs/MEDICHAM-SPRINT-NOTES.md`.
- **`data/fixture-legality-baseline.json` — NOT TOUCHED.** No allowance added, none removed.

## OWED, NOT RUN

- **THE GATE IS RED AT 2 FAILED AND THAT IS THE DELIVERABLE, NOT A KNOWN FAILURE.** The 15 verdicts /
  15 declarations behind the 21 sets are open work owed to the divisions that own those seven files.
  It must not be baselined: clause 7 correctly refuses `PRE-EXISTING` for anything outside the closed
  origin set of 41, and declaring them `DELIBERATE` would be false — none is an isolation probe
  staging a pairing on purpose.
- **NOT ONE OF THE 21 WAS REPAIRED, AND NO REPAIR BELOW IS VERIFIED.** Each is a behavioural change
  this batch may not test. The candidate repairs, with the commands whoever takes them must run:
  - `tests/probe_selfdestruct_winner.js:239-240` — re-aim Steelix and Reuniclus onto two of the ten
    unused Explosion carriers. `SHOWDOWN_PATH=... node tests/probe_selfdestruct_winner.js`
  - `tests/test-effect-credit.js:52` — a Swords Dance carrier with no stat-moving ability in place of
    Meowscarada. `SHOWDOWN_PATH=... node tests/test-effect-credit.js`
  - `tests/test-encore-fail-silent.js:194` — one of the 37 Whirlwind carriers in place of Snorlax.
    `SHOWDOWN_PATH=... node tests/test-encore-fail-silent.js`
  - `tests/probe_turn_order.js` (13) — `SHOWDOWN_PATH=... node tests/probe_turn_order.js`
  - `tests/test-resolution-order.js` (3) — `SHOWDOWN_PATH=... node tests/test-resolution-order.js`
  - `tests/test-imposter-transform-line.js:122` —
    `SHOWDOWN_PATH=... node tests/test-imposter-transform-line.js`
  - `engine/game_differential.js:4840,4910,4979,5002` — do not touch without re-baselining the
    whole-game differential.
- **The nine bare-literal illegal species (§4a) are NOT gated and NOT repaired.**
  `engine/playstyle.js` is a live engine file and `tests/bench-medicham.js:45` says its roster is
  pinned to stored numbers; both belong to their owners.
- **`champions_sim.fillerSets` is NOT fixed (§4b)** and the multi-species variant that would reach
  `engine/validate_damage.js`'s golden master is therefore NOT armed. Shape 2 remains unseen; its last
  hand audit is 2026-08-26, 36 rows, 0 problems, and it will not notice row 37.
- **Rule 1's normalisation looseness is NOT fixed.** Named in the header, not gated, unchanged from
  2026-08-26.
- **`tests/run-all.js` was NOT run.** Only `tests/test-fixture-legality.js`, plus read-only probes.
  This gate is not registered in `run-all.js`, so its red does not propagate there — which is itself
  worth someone's attention.
- **Two other agents were landing commits throughout.** The sweep reads the WORKING TREE, so a set
  declared by an uncommitted edit of theirs is inside these counts and a set added after this run is
  not.
