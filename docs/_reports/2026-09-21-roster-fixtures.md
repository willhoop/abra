# The roster built illegal fixtures — where they came from, what closed, what did not

2026-09-21. ENGINE. Release `0d7b1d9db6d1` throughout (the worktree has no copy of the main tree's
`adb08f5360f1`, which was cut while this ran). `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`.

Everything below is derived from `Dex.forFormat('gen9championsvgc2026regmb')` and Showdown's own
`TeamValidator`, or read out of a run's stderr. No name here is typed from memory.

---

## 1. The verdict in one paragraph

`tests/roster.js` has ONE judge — `learnsLegally`, which is the real `TeamValidator#checkCanLearn` —
and ONE repair pass, `restageOrHold` → `restageLegal` (ROADMAP #318). **The repair pass is applied
only to a scenario that becomes a ROW.** Three classes of fixture never reach it, and all nine illegal
sets the probe reported are in those three classes:

| class | what builds the fixture | of the 9 |
|---|---|---|
| **the rig's own PROOF fixtures** | `swapControlWorks()`, `gastroWorks()`, `critsLand()` call `play()` directly, never `restageOrHold` | 7 |
| **the CONTROL ARM's added click** | `controlOf` appends `skillswap` / `gastroacid` to a body AFTER the repair pass has run | 1 |
| **the stat pricer** | `builtStats()` builds a one-body team through `buildPair` to read a spread | 1 |

Seven of the nine are closed. The eighth and ninth are one verdict — **the Skill Swap control cannot
be staged on a legal set in this regulation** — and that is a derived fact, reported rather than
papered over. Nothing was baselined.

**`probe_control_self_name.js`'s own receipt: `9 illegal — 9 NOT baselined` → `2 illegal — 2 NOT
baselined`, and the probe is GREEN 8 of 8 clauses.**

---

## 2. Each of the nine, attributed

Attribution needed a new knob: `game_differential.js` prints the verdict and the BUILDING LINE, and
every fixture this file stages is built at the same two lines inside `play()`, so the report named
`tests/roster.js:1508` for eight of the nine and said nothing about which scenario. `play()` now
prints the scenario id and both sides under `ROSTER_DEBUG_ILLEGAL=1`.

| # | the authority's sentence | built by | closed |
|---|---|---|---|
| 1 | Goodra-Hisui can't learn Bite | `swapControlWorks()` — the swapper inherits `m.moves.slice()`, the move list of the body it REPLACED | yes |
| 2 | Venusaur can't learn Bite | `abilityScenario()`'s partner, carrying the AGGRESSOR's hit; the proof never goes through `restageLegal` | yes |
| 3 | Goodra-Hisui can't learn Bite (control arm) | as 1 | yes |
| 4 | Dragapult can't learn Night Slash | `critsLand()` hands `CAST.ATTACKER()` the first raised-crit-ratio move unconditionally | yes |
| 5 | Glimmora can't learn Bite | as 1, the `avoid` swapper | yes |
| 6 | Glimmora can't learn Bite (control arm) | as 1 | yes |
| 7 | Dragapult can't learn Gastro Acid | `gastroWorks()` / `controlOf`'s suppress branch click Gastro Acid off side A **slot 0** | yes |
| 8 | Victreebel-Mega transforms in-battle with Victreebelite … \| … can't have Innards Out | `builtStats()` declares a battle-only forme with an EMPTY item | yes |
| 9 | Goodra-Hisui can't learn Skill Swap | `controlOf`'s `abilityswap` branch, on the proof AND on every one of the 84 swap-controlled ability rows | **no — see §5** |

**The nine were a LOWER BOUND, and that is a property of the authority.** `validateTeam` stops at the
first refused move per Pokémon: the Venusaur in row 2 declares Bite **and U-turn** and learns neither,
and only Bite was ever printed. Measured directly —

```
checkSet Venusaur [bite, uturn, sleeptalk] -> ["Venusaur can't learn Bite."]
checkSet Venusaur [uturn]                  -> ["Venusaur can't learn U-turn."]
```

The same property is why `data/fixture-legality-baseline.json` already ratchets PAIRS as well as
sentences.

---

## 3. What changed, and why each is the minimum

All in `tests/roster.js`. No other file moved.

**a. `builtStats()` prices a mega on a legal set.** `maxRoll` prices a MEGA-tier carrier off the MEGA
FORME's base stats, so the pricer is asked for `victreebelmega` and declared it with `item: ''`. The
forme's own `requiredItem` fixes both the item complaint and the ability complaint at once — measured,
the same set carrying `Victreebelite` comes back with **zero problems**. **It changes no number**: the
species is unchanged, so `spreadFor` still reads the mega's own base stats. Read off the species, never
listed, so a forme added later is priced legally with no edit.

**b. A body lent into a slot carries the control click and nothing else** (`lentMoves()`). The swapper
and the Gastro Acid lender idle until the control arm hands them their click, so the inherited list was
pure decoration and pure illegality.

*This is where the first attempt went wrong and the wrong version is recorded rather than deleted.* The
first fix gave the lent body an ALREADY-RESOLVED substitute (`Sleep Talk`). `inertChoice` resolves the
control click once per scenario and refuses a substitute that some body already declares — so the
refusal switched on, the other five bodies kept a Focus Energy three of them cannot learn, and the run
went from **2 illegal sets to 5**. The lent body now declares `INERT` like every other body and
`withLegalInert` resolves the scenario together.

**c. The two ability-control proofs go through the judge.** `swapControlWorks()` and `gastroWorks()`
call `restageLegal(sc, 'ability', ab)` before the control arm is derived, so both arms carry the
identical repaired bodies. This is what closes rows 2 and the U-turn behind it.

**d. The Gastro Acid click comes off a body that learns it.** Seven legal species learn Gastro Acid and
**none of the three CAST bodies is one of them**; among `CANDIDATES` the learners are Snorlax,
Serperior, Eelektross, Victreebel, Arbok. `gastroLender()` derives the bulkiest and `abilityScenario`
puts it at side A slot 1 whenever it chooses this control. `controlOf` no longer writes slot 0 — it
LOCATES the slot by asking the judge, and **throws by name** if side A has no legal clicker, because a
silent slot 0 is what this was.

**e. `critsLand()` asks the judge for its thrower.** `throwerFor(CAST.ATTACKER(), [mv.id])` — the same
helper every hand-written rule uses — keeps the CAST body when it learns the click and otherwise hands
back the fastest legal learner with a non-interfering ability. **Dragapult learns none of the seven
raised-crit-ratio 100-accuracy moves in this format** (Night Slash, Shadow Claw, Aqua Cutter, Cross
Poison, Leaf Blade, Psycho Cut, Triple Arrows), so it was always going to be a refused set.

**THE `critsLand()` FIX WAS WRITTEN AS `restageLegal` FIRST AND THAT COST A RED RUN.** The #318 pass
reaches `bodyTwin`, which reads `moveBodies(arm)` — and `moveBodies` asks `moveQuietAbilities`, which
asks `critsLand()`. Called from inside `critsLand` it gets the provisional `_CL2` put in the cache on
the first line, reads `armourShared` as absent, and **memoises a bottom-arm pool with the two crit
armours missing**. Measured: `moveBodies('bottom-tie-first')` came back **0 species deep** and the moves
stage fell **496 → 391 with 105 COULD-NOT-STAGE, exit 1** — on a `critsLand()` that then went on to
answer correctly. `throwerFor` reads `CANDIDATES` and the validator and nothing else. This is the same
re-entrancy `swapControlWorks()` already documents a guard for.

**AND THE CRIT PROOF'S ANSWER IS UNCHANGED, WHICH IS THE POINT.** `--rules` on HEAD's roster and on the
fixed one print the identical sentence:

> MEASURED on release `0d7b1d9db6d1`: removing the critical hit's x1.5 from Night Slash moves 2 board
> leaf/leaves (top-tie-first: 0; bottom-tie-first: 2) … THE ARMOUR: with Shell Armor on the same body
> the plant moves 0 leaf/leaves and the two engines part on 0 … the five-species pool stays usable on
> both arms.

The knob is not unwired — the THROWER genuinely changed (the ability stage's `Dragapult can't learn
Night Slash` is gone). The conclusion was right for a reason it did not have.

---

## 4. Before and after — the roster's own stages

Release `0d7b1d9db6d1`, `--stage <s> --reds --write`, all six runs exit **0**.

| stage | verdict counts BEFORE | verdict counts AFTER | distinct sets checked | illegal BEFORE → AFTER |
|---|---|---|---|---|
| items | 148 FIRED-AND-BOARDS-MATCH / 148 in scope | **identical** | 479 | 17 → 17 |
| abilities | 196 FIRED + 3 ANNOUNCEMENT-ONLY + 1 DEFERRED-BY-OWNER / 200 | **identical** | 703 → 696 | **87 → 77** |
| moves | 496 FIRED + 1 DEFERRED-BY-OWNER / 497 | **identical** | 790 | **48 → 47** |

**No count fell, and none rose.** Every stage still reads 0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE,
0 CONTROL-NOT-QUIET, 0 COULD-NOT-STAGE.

**152 → 141 illegal sets across the three stages, and the probe's own slice 9 → 2.** The stage-level
number moves less than the probe's because the stages stage thousands of scenarios and the residue is
dominated by a DIFFERENT defect:

| refused entity, AFTER, all three stages | n |
|---|---|
| **Focus Energy** | **75** |
| Dragon Claw | 14 |
| Skill Swap | 5 |
| Bitter Blade, Drill Peck, Bite | 3 each |
| U-turn, Iron Head, Magnet Rise | 2 each |
| 17 others (Wish, Transform, Roost, Soak, Role Play, Guts-on-Rhyperior, …) | 1 each |

**The Focus Energy family is the already-registered `inertChoice` residue, not new.** `INERT` is Focus
Energy; `inertChoice` substitutes away from it only when it can find a substitute that no body already
declares and every holder can learn, and when it cannot it KEEPS Focus Energy on bodies that refuse it.
`tests/probe_roster_inert_legality.js` measures exactly this and `tests/run-all.js` carries its blocker
verbatim ("wire it with `--strict` the day the residue is closed or baselined"). **Its 58 and this 75
are not comparable** — that probe counts scenario BODIES and this receipt counts DISTINCT SETS through
`buildPair`. Untouched by this pass, on purpose.

---

## 5. The one that does not close: the Skill Swap control is not legally stageable

`swapperFor()` needs a body that (i) carries a **QUIET** ability — one registering no `on*` function,
no `condition`, and not one of the five `QUIET_EXCLUDE` — and (ii) can **click Skill Swap**, because
Skill Swap exchanges the USER's ability and the user is the swapper.

Derived over the regulation:

- **8 quiet abilities**: Ball Fetch, Battle Armor, Corrosion, Dancer, Early Bird, Honey Gather, Run
  Away, Shell Armor.
- **9 legal non-mega, non-battle-only species carry one**: Goodra-Hisui (Shell Armor), Torterra (Shell
  Armor), Torkoal (Shell Armor), Kangaskhan (Early Bird), Glimmora (Corrosion), Samurott (Shell Armor),
  Falinks (Battle Armor), Houndoom (Early Bird), Salazzle (Corrosion).
- **63 legal species learn Skill Swap. The intersection with those 9 is EMPTY.**
- And it is not a Skill Swap problem. Over every legal move whose handler names `ability` —
  Entrainment, Gastro Acid, Heal Bell, Rest, Role Play, Simple Beam, Worry Seed — **the only one any of
  the nine learns is Rest**, plus Worry Seed on Torterra.

So `Goodra-Hisui can't learn Skill Swap` (and `Glimmora can't learn Skill Swap`, the `avoid` swapper)
is a set the game refuses, and there is no substitute body.

**Two escape routes exist and both were rejected with their reason:**

1. **A mega swapper.** `Slowbro-Mega` carries Shell Armor and base Slowbro learns Skill Swap (the only
   such pair in the format; `Scolipede-Mega` also has Shell Armor and its base does not). It fails on
   the format's own rule: **one mega evolution per battle**, and the MEGA tier is precisely the tier
   whose CARRIER must mega. Shell Armor is also a crit armour and is refused on `bottom-tie-first` by
   `quietAsControl` for reasons already written down.
2. **Worry Seed instead of Skill Swap.** Torterra learns it, and Worry Seed does not require the lender
   to be quiet at all — it writes **Insomnia** onto the target. Insomnia is live (it refuses sleep and
   Yawn), so it is quiet only on a fixture that names no sleep — a condition `inertChoice` already
   knows how to test. **This is a real, legal alternative.** It is a NEW CONTROL KIND: it needs its own
   `swapControlWorks`-style proof against a known-live ability, and it re-stages the control on **84 of
   the 200 ability rows**. That is not a fixture repair and it does not belong in this pass.

**Nothing was baselined for it.** `data/fixture-legality-baseline.json` is read by the STATIC sweep's
gate, and `tests/test-fixture-legality.js` clauses 3 and 5 fail on any entry the static sweep no longer
produces. This set is built at RUN TIME and the sweep cannot see it, so an entry there would go stale on
the day it was written. Left visible as `2 illegal — 2 NOT baselined`.

---

## 6. The nine baselined fixtures `tests/staged_board.js` produces — judged

`tests/staged_board.js` (full run, release `0d7b1d9db6d1`) reports **71 distinct sets checked, 9
illegal — 0 NOT baselined**: Weavile / U-turn, Milotic / Nuzzle, Snorlax / Swords Dance ×2, Snorlax /
U-turn, Snorlax / Iron Defense, Incineroar / Iron Defense, Ditto / Protect, Palafin / U-turn.

**They do not deserve to be read as declared isolations, and the baseline file does not claim they
are.** All **15** of its entries are `kind: "PRE-EXISTING"` and **zero** are `DELIBERATE`; its own `why`
says so — *"The clause was added 2026-08-13 and every one of these predates it. Repairing forty fixtures
in the pass that ADDS the check makes both unattributable."* That is a deferral with a ratchet
(`shrank_from: 41`, `count: 15`), not a finding that the fixtures are fine.

**On the merits every one of the nine is REPAIRABLE.** Legal learners in this regulation, non-mega,
non-battle-only:

| baselined pairing | legal learners of the move | learners of the declared body's exact typing |
|---|---|---|
| Ditto can't learn Protect | 263 | 10 (Snorlax, Audino, Kangaskhan, …) |
| Incineroar can't learn Iron Defense | 82 | 0 |
| Snorlax can't learn Iron Defense | 82 | 0 |
| Snorlax can't learn Swords Dance | 71 | 2 (Lopunny, Watchog) |
| Palafin can't learn U-turn | 62 | 1 (Clawitzer) |
| Snorlax can't learn U-turn | 62 | 4 (Lopunny, Furfrou, Maushold, …) |
| Weavile can't learn U-turn | 62 | 0 |
| Milotic can't learn Nuzzle | 6 | 0 |

None is UNREACHABLE. **Exactly one entry in the 15 is** — `Milotic can't learn Spore`, **0 legal Spore
carriers in this regulation** — and that one can never be repaired and can never be `DELIBERATE`, which
clause 6 of the gate already refuses.

**And the precedent for repairing them is in the same file.** Commit `24fe4c5c` (2026-08-19) re-aimed
**eight** `staged_board.js` pairings onto moves the bodies learn and the entries were removed from the
baseline on 2026-08-26 because clauses 3 and 5 had gone red on them.

**So the judgement is: carry them, do not bless them.** A repair changes what those scenarios stage —
each of these bodies was chosen for a role, and the retyping cost has to be measured per scenario and
written down the way `24fe4c5c`'s twenty repair notes are. That is its own pass with its own before and
after, not a line in this one. What they must NOT be read as is "these fixtures are legal-by-decision":
they are nine deferred repairs with a legal body available for every one.

---

## 6b. THE SAME TWO SHAPES LIVE IN ANOTHER FILE — reported, not fixed

`tests/test-roster-arm-pin.js` builds **4 distinct sets and all 4 are illegal**, at its own line 133,
and they are the identical classes this pass closed in `tests/roster.js`:

```
Chimecho-Mega transforms in-battle with Chimechite, please fix its item. | Chimecho-Mega cant learn Kowtow Cleave.
Hydreigon cant learn Kowtow Cleave.
Delphox-Mega transforms in-battle with Delphoxite ... | Delphox-Mega cant have Levitate. | Delphox-Mega cant learn Kowtow Cleave.
Kangaskhan cant learn Kowtow Cleave.
```

A mega forme declared with an empty item (fixed here by reading `requiredItem`) and a click handed to
bodies that do not learn it. The test itself passes all its clauses. It is a different file with its
own fixtures and changing them changes what that test measures, so it is named here rather than
repaired in a pass about the roster.

## 7. Reproducing

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node tests/probe_control_self_name.js            # needs data/engine-release.json `current` to exist
SHOWDOWN_PATH=... ROSTER_DEBUG_ILLEGAL=1 \
  node tests/roster.js --stage abilities --only leafguard --json --release <id>   # names the scenario
SHOWDOWN_PATH=... node tests/roster.js --stage {items,abilities,moves} --reds --write --release <id>
SHOWDOWN_PATH=... node tests/staged_board.js --release <id>
```

The fixture receipt is on **stderr**, last line: `fixture check (buildPair, callers under tests/): N
distinct set(s) checked, M illegal`.

## 8. Owed

- `node engine/status.js --write` was **not** run — a worktree has no `data/releases/` and no store, and
  running it there has corrupted the ledger before. **Run it in the main tree at merge.**
- The verification runs used release `0d7b1d9db6d1` because the worktree has no copy of `adb08f5360f1`.
  Nothing here is a claim about engine bytes; the roster's own verdicts are unchanged either way.
- `data/roster.{items,abilities,moves}.json` were rewritten by the `--write` verification runs and then
  **reverted** — they would have replaced the main tree's newer artifacts with an older release's.
