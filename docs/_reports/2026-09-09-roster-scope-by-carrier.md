# The roster's scope is derived by legal carrier — 2026-09-09

ENGINE wave report. Register row #555. Findings record, not a living document; superseded by the register rows it
feeds and by `data/roster.*.json`, which is where every number below is read from.

## Verdict

- One resolver, `legalCarriers(kind, e)` in `tests/roster.js`, decides scope for all three stages BEFORE any shape
  rule runs. Zero legal carriers → `out_of_scope: 'no-legal-carrier'`, never staged, dropped from `results`, counted
  in `scope.out_of_scope` with `scope.carrier_derivation` beside it.
- Abilities out of scope 114 → **115** (Guard Dog). Moves 0 → **2** (Spore, Power Shift). Items 0 → 0.
- Tested counts UNMOVED: abilities **139**, moves **487**, items **142**. Differ 0, DID-NOT-FIRE 0 on every stage.
  The moves total held only by coincidence — two rows left (Spore, Power Shift) and two entered (Imprison, Memento).
- Imprison / Memento THREW: **both were the harness.** Both now FIRED-AND-BOARDS-MATCH.
- `tests/test-stadium-roster.js`: 3 FAILURES → **ALL PASS**, test-side entries only, nothing in `web/`.
- **Will's ruling holds for 115 abilities, and 114 of them were already out.** The "unaccounted" remainder the
  SCOPE line prints (62 for abilities) is IN THE GAME: 43 fixture gaps on legal carriers, 14 CONTROL-NOT-QUIET,
  5 DEFERRED-BY-OWNER. Scoping cannot make that number zero. Fixtures can.

## Where the 63 came from (measured before editing)

`data/roster.abilities.json:scope` at HEAD, keys printed first:
`total, out_of_scope, out_of_scope_by, in_scope, tested, matched, differ, silent, deferred, unattributable,
unattributable_ids, declared_untestable, could_not_stage_in_scope, attributed_by_second_control`.

```
total 316  out_of_scope 114 (all no-legal-carrier)  in_scope 202  tested 139
could_not_stage_in_scope 44  unattributable 14  deferred 5        44 + 14 + 5 = 63
```

The gate's "63 unaccounted" is `engine/coverage.js residual()` = `scope.in_scope − scope.tested`, printed under
the clause by `engine/status.js`. It is arithmetic over the artifact, not a list anybody typed.

The old tagging happened INSIDE `ability/no-legal-carrier`, a rule that sits behind ~30 specialised rules in
`RULES`. Any specialised rule that matched first and refused with a fixture sentence left the row IN SCOPE. The
moves and items stages had no carrier notion at all (`population(kind)` filtered on `isNonstandard` alone).

## The resolver

Derived from `Dex.forFormat('gen9championsvgc2026regmb')` at run time; nothing listed.

```
LEGAL_SPECIES = species.all().filter(exists && !isNonstandard && tier !== 'Illegal')   -> 347
  (72 mega formes, 83 battle-only formes among them; 10 formes pass isNonstandard and are tier Illegal:
   Meloetta-Pirouette, Minior-Meteor, Cramorant-Gulping/Gorging, Eiscue-Noice, the four Tera Ogerpon, Terapagos-Terastal)
ability  LEGAL_SPECIES with the ability in any slot           -> 115 of 316 legal abilities have zero
move     LEGAL_SPECIES whose learnset lists it, walked up the prevo chain and across to the base forme
         exactly as learnsMove() does; Struggle = every legal species (the authority assigns it without a
         learnset; the declaration THROWS if any learnset ever lists it)   -> 2 of 500 legal moves have zero
item     mega stone -> its base species (megaStone keys); itemUser -> those users; else any legal species
                                                                           -> 0 of 148 legal items have zero
```

Grepped before writing: `engine/where.js carrier` counts TAG carriers (tags.json), not species;
`GD.CLOSET_SPECIES` is the Illusion shelf; `engine/mod_audit.js` answers "did the mod change this", not "who carries
it". `CARRIERS` in roster.js is the closest existing map (abilities only, `isNonstandard` only, no `tier`) and is
left in place for the fixture-selection code that reads it. The two rules that decided the scope tag themselves
(`ability/no-legal-carrier`, `ability/refuses-a-forced-switch`'s trap branch) now read `legalCarriers`.

Mega and battle-only formes COUNT as carriers on purpose. Aerilate lives only on Pinsir-Mega and Pinsir-Mega is
legal here, so Aerilate is in this game; its row is a fixture gap (the forme change writes the ability, nothing can
control it), which is exactly the distinction the trap rule's own comment draws for Shadow Tag.

## Before → after, per stage

All three on release `b0f5c159c46e` (the artifacts at HEAD were on the same release), `--reds --write`, one stage at
a time through `tools\lownode.cmd`. `reds_ran: true`, 0 dead anchors, 0 bad reds on every stage.

| stage | out_of_scope | in_scope | tested | matched | could_not_stage_in_scope | unattributable | deferred | differ | silent |
|---|---|---|---|---|---|---|---|---|---|
| abilities | 114 → 115 | 202 → 201 | 139 → 139 | 139 → 139 | 44 → 43 | 14 → 14 | 5 → 5 | 0 | 0 |
| moves | 0 → 2 | 500 → 498 | 487 → 487 | 487 → 487 | 10 → 8 | 0 | 3 → 3 | 0 | 0 |
| items | 0 → 0 | 148 → 148 | 142 → 142 | 142 → 142 | 6 → 6 | 0 | 0 | 0 | 0 |

Row-level diff against `data/roster.*.prev.json`:
- abilities: COULD-NOT-STAGE lost `guarddog` (now out of scope, dropped from `results`; 202 → 201 rows written).
  MATCH, CONTROL-NOT-QUIET, DEFERRED sets identical.
- moves: MATCH lost `powershift`, `spore` (out of scope); MATCH gained `imprison`, `memento` (the THREW fix).
- items: no row moved.

`node engine/status.js` (read-only) after:

```
PASS  deliberate roster / items      clean: 142 of 148 tested
      SCOPE — roster.items.json: scope.tested 142 of in_scope 148 — 6 unaccounted; could_not_stage_in_scope 6
PASS  deliberate roster / abilities  clean: 139 of 201 tested. 14 row(s) count in NEITHER column — ...
      SCOPE — roster.abilities.json: scope.tested 139 of in_scope 201 — 62 unaccounted; ...
PASS  deliberate roster / moves      clean: 487 of 498 tested
      SCOPE — roster.moves.json: scope.tested 487 of in_scope 498 — 11 unaccounted; could_not_stage_in_scope 8;
      deferred 3; out_of_scope 2 (excluded before staging)
```

## The remaining fixture gaps, by name (in scope; every one has a legal carrier)

Abilities, 43:
- **34 — the staging is inert on its carrier** (Showdown's own board identical with and without it): Analytic
  (Starmie), Berserk (Drampa), Cheek Pouch (Diggersby), Cloud Nine (Altaria), Compound Eyes (Vivillon), Cud Chew
  (Farigiraf), Early Bird (Kangaskhan), Frisk (Gourgeist-Super), Gluttony (Snorlax), Heavy Metal (Aggron),
  Hydration (Goodra), Illuminate (Starmie), Klutz (Audino), Leaf Guard (Meganium), Light Metal (Metagross), Long
  Reach (Decidueye), Magician (Delphox), Merciless (Toxapex), Minus (Manectric), Natural Cure (Altaria), No Guard
  (Machamp), Pickpocket (Barbaracle), Plus (Ampharos), Quick Feet (Jolteon), Receiver (Passimian), Screen Cleaner
  (Mr. Rime), Skill Link (Toucannon), Sniper (Barbaracle), Steadfast (Machamp), Supreme Overlord (Kingambit),
  Symbiosis (Florges), Synchronize (Umbreon), Tangled Feet (Mr. Rime), Unaware (Skeledirge).
- **4 — mega-only forme, no control**: Aerilate, Dragonize, Filter, Mega Launcher (waiting on a mega-ask fixture in
  `stageAbility`).
- **2 — a carrier exists and the rule's own condition cannot use it**: Fur Coat (Furfrou has no second ability),
  Gale Wings (no faster foe the Flying delivery click kills outright).
- **1 each**: Cute Charm (gender gate; the driver builds every body genderless), Ripen (berry-only hook), Zero to
  Hero (entry ability on a suppress-tier carrier).

Moves, 8: Aura Wheel, Raging Bull (type keyed on the user's forme), Extreme Speed, Ice Shard, Jet Punch (bracket not
observable on this fixture; census covers `move/priority`), Focus Energy (it IS the control click), Struggle
(disabled while any move is usable), Upper Hand (inert).

Items, 6: Aspear Berry, Rawst Berry (no 100-accuracy move inflicts frz/brn outright), Focus Band, King's Rock, Quick
Claw (sub-100% chance under the pin), Scope Lens (no crit lands under the pin).

Plus 14 CONTROL-NOT-QUIET abilities (named on the clause line) and 5 DEFERRED-BY-OWNER (Anticipation, Forewarn,
Illusion, Pickup, Stall); moves DEFERRED 3 (Axe Kick, Copycat, Electrify).

## Imprison / Memento — the harness, not the simulator

Both rows read `THREW — p1 choice rejected p1 "pass, move 1": Can't pass: Your <body> must make a move`. The driver's
`scripted()` (engine/game_differential.js) resolves a script click against Showdown's OWN request and answers `pass`
when the named move is not offered; Showdown refuses a `pass` for a body that can still act.

- **Memento** — `move/boosts-target` scripts the click TWICE ("thrown at X twice") to reach −2. Memento has
  `selfdestruct: 'ifHit'`: the user fainted on turn 1, the driver mirrored Milotic in, and turn 2 named Memento for
  a body that never had it. Fix: for a move with `selfdestruct` (derived; Memento is the only legal member), click
  once and idle after — one Memento already writes the −2. Trial `--only memento`: FIRED-AND-BOARDS-MATCH.
- **Imprison** — `move/volatile`'s self-volatile branch gave the foes only the inert click, and `scaffold()` pushes
  the inert click onto EVERY body, the Imprison user included. Imprison's condition carries `onFoeDisableMove`, so
  both foes had every move sealed, the turn-2 request offered only Struggle, and `scripted()` passed. Fix: when the
  self volatile's condition has `onFoeDisableMove` (derived; Imprison is the only legal self volatile with it —
  Follow Me and Rage Powder carry `onFoeRedirectTarget`), both foes get a neutral 100-accuracy delivery click aimed
  at the user (Dragon Pulse into Goodra-Hisui) and click it on turns 2 and 3. Trial `--only imprison`:
  FIRED-AND-BOARDS-MATCH.

No simulator edit. No driver edit.

## tests/test-stadium-roster.js — ALL PASS

Applied exactly as `docs/_reports/2026-09-09-thesis-quick-items.md` §6 prescribed, all in the test file:
1. `NOT_A_CABINET['ALAKAZAM']` — unbuilt capstone placeholder heading (MODELS.md 5.244.0).
2. Six `NOT_A_MODEL` entries, each reason read off the generator's own header: `build/build_engine_data.js`,
   `engine/bench_speed.js`, `engine/joint_click_census.js`, `engine/next_regulation_ingest.js`,
   `engine/side_selection_census.js`, `engine/smogon_coverage.js`.
3. Four `NOT_A_MODEL` exceptions MODELS.md now documents deleted: `leaf_engine_contrast.js`, `nmf_rank.py`,
   `click_census.js`, `quarantine.js` (with the WEB comment block that described only it).

Result: `ALL PASS (15 cabinets, 38 ledger headings, 136 artifact generators)`. `web/` untouched.

## Proposed RUNNING-NOTES row (NOT written — coordinator's)

- **What changed.** `tests/roster.js` derives every stage's scope by LEGAL CARRIER through one resolver
  (`legalCarriers`; 347 legal species, `exists && !isNonstandard && tier !== 'Illegal'`). Abilities out of scope
  114 → 115 (Guard Dog), moves 0 → 2 (Spore, Power Shift), items 0 → 0; tested 139 / 487 / 142 unmoved, zero
  DIFFER, zero DID-NOT-FIRE (`data/roster.{abilities,moves,items}.json`, release `b0f5c159c46e`). Imprison and
  Memento THREW closed as harness faults, both FIRED-AND-BOARDS-MATCH. `tests/test-stadium-roster.js` 3 red → ALL PASS.
- **Supersedes.** "139 of 202 tested" → 139 of 201; "487 of 500" → 487 of 498; abilities could-not-stage 44 → 43;
  moves could-not-stage 10 → 8. The claim that the roster's untested abilities are not in the game: TRUE for 115,
  and the 62 the SCOPE line still prints for abilities all have legal carriers.
- **Basis.** unchanged.
- **Owes.** `node engine/status.js --write`; the fixture tail above (43 / 8 / 6), deprioritised not removed.

## Proposed CHANGELOG bullet (NOT written; MINOR — published roster figures move under an unchanged basis)

- Changed: `tests/roster.js` decides scope by legal carrier before any shape rule runs, for abilities, moves and
  items alike; the artifact carries `scope.carrier_derivation`. Guard Dog, Spore and Power Shift leave the
  denominators (#555).
- Fixed: Imprison and Memento no longer THREW on the roster — a self-KO is clicked once, and foes of a move-sealing
  self volatile carry a click the user does not know. Both were fixture faults.
- Fixed: `tests/test-stadium-roster.js` green — ALAKAZAM declared, six pipeline generators declared, four
  overtaken exceptions removed.

## OWED, NOT RUN

```
node engine/status.js --write                       # forbidden this wave; ledger GENERATED blocks are one pass behind
SHOWDOWN_PATH=... node tests/test-roster-arm-pin.js  # plays games; not re-run (does not require roster.js)
SHOWDOWN_PATH=... node tests/test-roster-identity.js # same
git add tests/roster.js tests/test-stadium-roster.js data/roster.abilities.json data/roster.abilities.prev.json \
        data/roster.moves.json data/roster.moves.prev.json data/roster.items.json data/roster.items.prev.json \
        data/roster.json docs/ENGINE.md docs/_reports/2026-09-09-roster-scope-by-carrier.md
                                                    # NOT committed: the pre-commit hook wants a RUNNING-NOTES row, which is not mine to write
```

Other agents were writing `engine/medicham2-browser.js`, `data/tags.json`, `data/abra-tags.js`,
`data/mechanics-census.json`, `tests/test-mechanics.js` and more in the same tree during this wave. None of those
files was touched here; `git status` lists them because of their work, not this one.
