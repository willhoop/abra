# FIXTURE LEGALITY — the check was red at 5, and 3 of the 5 were the check

2026-08-26 · MEASURE · ROADMAP #266 · `node tests/test-fixture-legality.js`

## VERDICT

**Of the five failures, TWO were real illegal entities and THREE were the instrument accusing its own
assertion messages.** The gate is now ALL GREEN, 5 → 0, with no baseline allowance added.

- **Real:** `Incineroar can't learn Knock Off.` (`tests/test-protocol-trace.js:437`, one commit old) and
  `Milotic can't learn Calm Mind.` (`tests/probe_mental_herb_order.js:105`, a ternary branch that can
  never be taken but still typed the name).
- **Real, and mechanical:** eight stale baseline allowances, all repaired by ENGINE in commit
  `24fe4c5c` and left standing in `data/fixture-legality-baseline.json`. Removed.
- **The instrument:** the five "string literals that name nothing" were three fragments of a FAIL
  message and two padding strings, scanned because `const ok = ...` was registered as a set-BUILDER on
  the evidence of the `const stage = ...` declared beneath it.

**HOW MANY FIXTURE SHAPES THIS SWEEP STILL CANNOT SEE: three. One of them hides 124 distinct sets, of
which 21 are illegal and 15 carry a verdict sentence that is not on the baseline.**

---

## SHOWN RED FIRST

`node tests/test-fixture-legality.js` at HEAD (`3050904d`), before any edit:

```
        424 files, 875 set declarations, 273 distinct sets
  FAIL  2 NEW illegal fixture set(s)                         <- clause 2
  FAIL  7 baselined verdict(s) are no longer produced        <- clause 3
  FAIL  2 NEW illegal DECLARATION(S) that no verdict names   <- clause 5a
  FAIL  8 baselined declaration(s) are no longer produced    <- clause 5b
  FAIL  5 string literal(s) ... name nothing in this format  <- clause 8
FIXTURE LEGALITY: 5 FAILED
```

## THE FIVE, ONE AT A TIME

### 1 + 3. `Incineroar can't learn Knock Off.` — REAL, and one commit old

`git blame` puts `mon('incineroar', ['fakeout', 'protect', 'knockoff', 'flareblitz'], 'intimidate', '')`
in **`3050904d`, tonight** — the commit that added the Psych Up scenario. That scenario's own comment
says *"`champions_sim.canLearn` says Clefable learns it and Garchomp learns Swords Dance, asked of the
format rather than recalled"*: the two moves the scenario is ABOUT were derived and the partner's set
was not. That is precisely the class this gate exists for.

`CS.canLearn('Incineroar', 'Knock Off')` is **false** in `gen9championsvgc2026regmb`. Repaired to
**Darkest Lariat** — the same job (Incineroar's own Dark physical attack), `canLearn` **true**, and the
slot's entire script is Protect, so no board moves. Derived, not recalled: Incineroar has 77 legal
learnable moves in this format and Darkest Lariat, Throat Chop and Parting Shot are all among them.

`CS.checkLegal` on the repaired set returns **LEGAL**; on the old one it returns
*"Incineroar can't learn Knock Off."*

### 1 + 3. `Milotic can't learn Calm Mind.` — REAL as a typed name, INERT at runtime

`tests/probe_mental_herb_order.js:105` was

```js
mon('milotic', '', [IDLE === 'Calm Mind' ? 'Recover' : IDLE]),
```

`IDLE` is the constant `'Calm Mind'` six lines above, so the branch resolves to `'Recover'` on every
run and Milotic has never held Calm Mind in a game. The **name was still typed next to a body that
cannot carry it**, and the abstraction was not even real — the script below it hard-codes `'Recover'`
for that slot. Replaced with the literal `['Recover']`, which keeps the set VISIBLE to the sweep (a
derived `mon(PARTNER, '', [PARTNER_IDLE])` would have removed it from the population, which is coverage
deleted to reach green).

### 2 + 4. Eight stale baseline allowances — REAL, and already repaired by someone else

All eight named `tests/staged_board.js`. Proved a repair rather than a scanner that stopped looking,
which is the failure mode that matters here:

- `git show 24fe4c5c^:tests/staged_board.js` declares **all eight**; `HEAD` declares **none** — checked
  by grepping the species/move pairs, not by trusting the recorded line numbers, which have shifted.
- `tests/staged_board.js` is still the **largest single contributor to the sweep at 204 declarations**,
  so the file is being read.
- Commit `24fe4c5c` re-aimed each onto a learnable move: Iron Defense, Chilly Reception, Tickle,
  Amnesia and Focus Energy in place of Swords Dance, U-turn, Charm, Ally Switch and Trick Room.

Removed from `verdicts` (7) and `pairs` (8 — the extra is `Toxapex can't learn Swords Dance.`, which
never had a verdict sentence because `validateTeam` stopped at U-turn on the same body). Each removal
is written into the baseline's `repaired` block with that evidence. Baseline **22 → 15 verdicts,
23 → 15 pairs**. `origin` is untouched at its closed 41.

### 5. Five prose string literals — THE INSTRUMENT, not the fixtures

All five are arguments to `ok(cond, label, detail)`:

```
"and medicham2 wrote exactly as many"   test-imposter-transform-line.js:203, test-precharge-order.js:290
"  "                                    (the same two sites)
"the mega fired on BOTH engines"        test-precharge-order.js:279
"showdown="                             test-precharge-order.js:279
" refused="                             test-precharge-order.js:279
```

They are **inert prose**. What was not inert is why the sweep read them. Dumping `scan()`'s raw sets
for those two files:

```
{"file":"tests/test-precharge-order.js","line":279,"how":"ok()","species":" medicham=", ...}
{"file":"tests/test-precharge-order.js","line":290,"how":"ok()","species":"medicham=",  ...}
```

**`'medicham='` was read as the species Medicham.** Two independent defects stacked:

1. **The helper window ran past the end of the helper.** Helper detection took
   `src.slice(at, at + 500)` — a flat 500 characters from the declaration start. Both files write

   ```js
   const ok    = (cond, label, extra) => { ... };
   const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
   ```

   so `ok`'s window swallowed `stage`'s body, `byLiteral` saw `species` and `moves`, and **every
   assertion in both files was then scanned as a set declaration.** Fixed: the window now stops at the
   next top-level declaration (column 0 only — rule 3's "one scope a regex can see" is unchanged). It
   can only ever SHRINK the window.

2. **Rule 1 is looser than it says it is.** It states "a literal is an entity only if it NAMES ITSELF",
   and implements that as `dex.species.get(s).id === nrm(s)` — with `nrm` stripping punctuation from
   BOTH sides. `'medicham='` therefore names itself. **NOT fixed**, deliberately: the proximate cause
   is fixed, a second narrowing heuristic on top would be enumerating known-bad forms, and it is now
   named in the file's header as a shape that will recur the moment a real set-builder is called with a
   debug string.

**Measured, so the fix is attributable.** Full set dump before and after the window change:
**875 → 872 declarations**, and the diff is **exactly the three phantom rows and nothing else**.
Distinct sets 273 → 272 (the three collapse to one key). `notStaticallyPaired` 850 → 488, because the
~362 `ok()` calls in those two files are no longer scanned at all.

---

## THE PART THAT MATTERS — DOES THIS CHECK CATCH THE CLASS?

**No. Three shapes walk past it, and the largest is the same class matcher (C) was added for.**

### Shape 1 — a positional row whose moves array is not in slot 2. **124 sets invisible, 21 illegal.**

Matcher (C) matches `['species', ['move', ...], 'ability', 'item']` — species first, **moves array
second**. Thirteen files (twelve under `tests/`, plus `engine/game_differential.js`) declare their
fixtures through

```js
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
```

i.e. **moves LAST**. Matcher (C)'s regex refuses them, and the helper matcher files every string inside
any `[...]` as a MOVE (rule 2), so the species literal lands in the move list and the call is recorded
as *"no species literal in the call"*. They are in `notStaticallyPaired`, which reads as "nothing to
validate here".

Measured with a position-independent matcher (first element a self-naming species, exactly one nested
array of string literals taken as the moves, remaining scalars by role):

| | |
|---|---|
| rows matched | **413** |
| distinct sets | **157** |
| already visible to the sweep | 33 |
| **invisible today** | **124** |
| **invisible AND rejected by `TeamValidator`** | **21** |
| distinct verdict sentences | 16 |
| **verdict sentences NOT on the baseline** | **15** |
| stray literals produced by the matcher (false-positive noise) | **0** |

Novel sets by file: `test-resolution-order.js` 75, `probe_turn_order.js` 51,
`probe_selfdestruct_winner.js` 38, `test-encore-fail-silent.js` 10, `game_differential.js` 9,
`probe_fail_and_silent.js` 9, `test-multihit-damage-game.js` 8, `test-precharge-order.js` 7,
`test-imposter-transform-line.js` 5, `probe_spread_secondary_address.js` 3, `test-bracket-regain.js` 3,
`test-sleep-duration.js` 3, `test-effect-credit.js` 2, `test-pin-arms.js` 2.

The fifteen unbaselined verdicts:

```
Archaludon can't learn Body Press.        Incineroar can't learn Knock Off.
Basculegion can't learn Final Gambit.     Incineroar can't learn Tailwind.
Clefable can't learn Toxic.               Meowscarada can't learn Swords Dance.
Garchomp can't learn Knock Off.           Milotic can't learn Agility.
Garchomp can't learn Tailwind.            Reuniclus can't learn Explosion.
Garchomp can't learn Thunder Wave.        Snorlax can't learn Whirlwind.
Incineroar can't learn Agility.           Steelix can't learn Explosion.
                                          Whimsicott can't learn Agility.
```

**THE MATCHER WAS NOT TURNED ON, AND THAT IS A DECISION WITH A REASON RATHER THAN AN OMISSION.**
Turning it on tonight makes the gate RED by fifteen verdicts in files this batch does not own, and
clause 7 correctly refuses to let them be laundered as `PRE-EXISTING` — they are not in the closed
origin set, so the only way to green is to repair all twenty-one. Those repairs are not renames:
`probe_turn_order.js` stages Agility and Tailwind **because the probe is about speed brackets**, and
`probe_selfdestruct_winner.js` stages Explosion **because the probe is about self-destruct** — a legal
replacement means a different BODY, which moves the board the probe measures. That is the same argument
this baseline's own `why` makes, and the same order matcher (C) followed: *"measured first, repaired,
then the matcher turned on"*. Filed to ROADMAP #266 with the numbers above so the next batch starts
from a count rather than a hunch.

### Shape 2 — a row with no moves array at all. **36 rows, invisible, clean today.**

`engine/validate_damage.js`'s golden master is
`[att, ability, item, nature, stat, move, def, nature, {spread}, weather, defAb?, defItem?]` — two
species and a move, all scalars, no array anywhere. **No matcher in this sweep can see it, including
the generalised one measured above.** It is the file where Choice Band, Choice Specs and an Amoonguss
were found on 2026-08-25 **by a human, not by this gate**, and repaired in commit `5bb13e3b`.

Audited by hand tonight against the format — attacker species/ability/item/move, defender
species/ability/item, `isNonstandard` for legality and `canLearn` for the move: **36 rows parsed,
0 problems.** The remaining occurrences of the banned names in that file are all inside comments
recording the repair. Clean, and still unseen.

### Shape 3 — a literal that merely normalises to an entity id (a FALSE POSITIVE, not a blind spot)

Described under failure 5. Cost tonight: three phantom sets and five phantom findings, one of which
was reported to this batch as a fixture defect.

### Declared and correct, not counted as blind spots

`tests/roster.js` and `engine/all_mechanics_fire.js` build bodies FROM the format and can never type a
name that does not exist. `tests/test-mechanics.js` builds through `buildMon(key)` and assigns the
click later — 144 distinct species literals, 2 declarations — which the header already declares as
NOT STATICALLY PAIRED. Rule 2 (moves come from array literals only) deliberately declines
`ratio('kingambit', 'incineroar', 'knockoff', 'blackglasses')` in `tests/test-tag-wire.js`, because
attributing a loose move literal to the nearest species produced three false accusations before that
rule existed.

**Scope note, not a shape:** `SKIP_DIRS` excludes `data/`, so a set declared in a `data/*.js` file is
outside this population by construction.

---

## WHAT MOVED, AND WHAT DID NOT

Predicted before the run and confirmed: **no game number moves.** Nothing in this batch touches the
engine, the census, the differential, a release, or any artifact a game writes. The two fixture edits
are on slots that never click the changed move (`test-protocol-trace.js`'s Incineroar clicks Protect
for its whole script; `probe_mental_herb_order.js`'s ternary already evaluated to `'Recover'`).

| | before | after |
|---|---|---|
| gate | 5 FAILED | **ALL GREEN** |
| set declarations | 875 | 872 |
| distinct sets | 273 | 272 |
| baseline verdicts | 22 | **15** |
| baseline pairs | 23 | **15** |
| stray literals | 5 | **0** |
| baseline `origin` | 41 | 41 (untouched) |

## FILES

- `engine/fixture_legality.js` — `declBody()`; header now states the four shapes it matches and the
  three that walk past.
- `tests/probe_mental_herb_order.js` — the dead ternary.
- `tests/test-protocol-trace.js` — Knock Off → Darkest Lariat. **Outside this batch's declared
  ownership**, taken because clause 2 cannot be honest otherwise; one token, statically validated.
- `data/fixture-legality-baseline.json` — eight allowances removed, each with its repair evidence.

## OWED, NOT RUN

- **`tests/test-protocol-trace.js`'s 200 games were NOT re-run.** This batch may not play a game. The
  prediction is zero movement — the changed slot's entire script is Protect and the move is never
  clicked — and it is a prediction, not a measurement. Whoever next runs that file should confirm it.
- **`tests/probe_mental_herb_order.js` was NOT re-run**, same reason. Here the argument is stronger
  than a prediction: the removed branch was unreachable, so the packed team is byte-identical.
- **The 21 illegal sets behind Shape 1 are NOT repaired and the generalised matcher is NOT armed.**
  Owed to the divisions that own those thirteen files. Until it is armed, this gate's green means "no
  new illegal fixture **in the shapes it matches**", which is narrower than the sentence it prints.
- **Rule 1's normalisation looseness (Shape 3) is NOT fixed.** Named in the header, not gated.
- **`engine/validate_damage.js`'s 36 rows are audited but not GATED.** Tonight's audit is a one-off
  script in a scratchpad, not an instrument; it will not notice row 37.
- **No re-run of `tests/run-all.js`.** Only `tests/test-fixture-legality.js` was run to green.
- Two other agents were landing commits during this batch (`engine/medicham2-browser.js`,
  `tests/test-mechanics.js` were modified in the working tree throughout). The sweep reads the WORKING
  TREE, so a set declared by an uncommitted edit of theirs is inside these counts and a set they add
  after this run is not.
