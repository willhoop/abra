# Burn, trapping and recoil, from the held-out 12,000-game draw — 2026-09-19, ENGINE

This is a findings record, not a living document. It is not current state and is not cited as such.
`node engine/status.js` and `node engine/quarantine.js` hold current state. Work done in the isolated
worktree `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a7bd765f18661ea5f`; nothing was
committed, nothing was pushed, and no lattice run, battery, roster or `quarantine.js` was run (LIGHT
MODE, as briefed).

---

## 0. VERDICT

| brief item | games | outcome |
|---|---|---|
| **burn** | 4 (rows 3, 6, 27, 29) | **1 fixed** (row 6, Sparkling Aria). Rows 3, 27 and 29 are NOT fixed, are not a missing capability, and are named in §4 with what was measured |
| **trapping volatiles** | 3 (rows 12, 24, 32) | **3 fixed**, by two separate rules — the hard trap's release at the FAINT (12, 32) and the partial trap's `!source.activeTurns` clause (24) |
| **recoil** | 2 (rows 2, 25) | **2 fixed**, one rule — a max-HP recoil is paid for damage dealt unless the move declares its own `onMoveFail` |

**Census 970 live / 970 probed / 0 missing → 973 / 973 / 0.** Three new rows, each shown MISSING under its
own knob, and each knob listed in `DELIBERATE_BREAK` so a knob run refuses to write the census (shown, for
all four knobs).

**Nothing was measured on a lattice.** No claim is made here about the whole-game rate. The evidence is:
the authority's source lines, three paired probes with red-first knobs, three census rows, and a replay of
each parting game on the release before and the release after.

## 1. PINS

| pin | value |
|---|---|
| before | release **`18773c22878f`** — the release the held-out draw was measured on |
| after | release **`a02123dcc85f`**, cut in this worktree from the edited tree, 27 files frozen |
| team store | `--team-store data/team-pool-frozen` (hard-linked from the main tree: `games.bo3.jsonl` 109,006,606 bytes, `games.ots.jsonl` 31,928,037 — the digests `FROZEN.md` declares) |
| replay flags | `--games 12000 --arm middle --config <as the artifact> --steering empirical --no-warmup` |
| probes | `tests/_live_release.js`, which redirects `cut`/`open` to the OS temp store; `data/engine-release.json` was saved before the one real cut and **restored afterwards** (verified: it points at `18773c22878f` again) |
| authority | `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` |
| source of the 34 | `docs/_reports/2026-09-19-final-remeasure.md` §4, plus `data/verification/game-differential.g12000.json` and `data/verification/_1877_dump_g12000.json` in the MAIN tree, read at rest (mtimes 2026-09-19 19:05, over four hours before this pass) |

## 2. RECOIL — rows 2 and 25

**The authority's rule, read at the lines.** The Champions mod keeps its own copy of the hit loop and
reaches the payment site through one gate:

```
if (move.totalDamage) this.applyRecoilDamage(move.totalDamage, move, pokemon);
                                              — data/mods/champions/scripts.ts:553-555
```

`applyRecoilDamage` is where BOTH `struggleRecoil` (sim/battle-actions.ts:1381) and `mindBlownRecoil`
(:1382) are sized, so a move that dealt nothing reaches neither. There is a SECOND site, and only one
member declares a handler for it:

```
if (!moveResult) { ... this.battle.singleEvent('MoveFail', move, null, target, pokemon, move); }
                                              — sim/battle-actions.ts:524-527
steelbeam.onMoveFail(target, source, move) { ... this.damage(Math.round(source.maxhp / 2), ...) }
                                              — data/moves.ts:17880-17883
```

Struggle declares none (`data/moves.ts:18218-18228`). So the two members of `recoil {of:'maxhp'}` behave
DIFFERENTLY on a whiff, and the tag said the same thing about both.

**What this engine did.** The max-HP recoil block was deliberately ungated on damage — its own header said
so and gave Steel Beam's `onMoveFail` as the reason. The same header claimed *"This engine's miss path exits
above this line"*, and it does not: a Struggle aimed at a body that had just gone semi-invulnerable reached
the block and paid.

**Both pool games are that.** Rows 2 and 25 are a Struggle into a Phantom Force, and in both the extra
quarter is board-material — row 25 is a KO that happened only here (`p1.party.kangaskhan.hp us=0 / sd=33`,
`fainted true/false`).

**The fix, at the shared place.** `engine/tag_dex.js` derives `paidOnFail` on the `recoil` tag from the
presence of a damaging `onMoveFail` handler. Printed over the whole format (the over-match check):

```
steelbeam   {"fraction":0.5,"of":"maxhp","paidOnFail":true}
struggle    {"fraction":0.25,"of":"maxhp","paidOnFail":false}
```

`engine/medicham2-browser.js` gates the block on `dealt > 0 || paidOnFail`. A tags artifact predating the
split cannot answer, so the pre-fix behaviour is kept AND `MEDFAILS.recoilPaidOnFailUnknown` is stamped —
a silent default here would look exactly like a working gate. New counter
`MEDSEEN.maxHPRecoilRefusedOnWhiff`.

**Knob** `MEDI_RECOIL_ON_A_WHIFF=1` (stamped at load, in `DELIBERATE_BREAK`).
**Probe** `tests/probe_recoil_on_a_whiff.js`, three arms:

| arm | authority | medicham2, fixed | under the knob |
|---|---|---|---|
| WHIFF-NOFAIL — Struggle into two semi-invulnerable foes | 0 toll lines | 0 | **1, and the board parts** |
| LANDS — the same click, foes standing still | 1 | 1 | 1, no parting |
| WHIFF-ONFAIL — Steel Beam into the same two Digs | 1 (`[from] steelbeam`) | 1 | 1, no parting |

The third arm is the specificity control: a fix that gated the whole family on damage goes red on it.

**Census row** `move/recoil` — *"a max-HP recoil is paid for damage dealt: Struggle into a semi-invulnerable
body costs nothing, Steel Beam still costs half"*. Reads `45 / 0 / 90` across the three arms; under
`MEDI_RECOIL_ON_A_WHIFF=1` it reads `45 / 45 / 90` and goes MISSING.

**Replays.** Row 2 on `18773c22878f` splits at reduced index 249, `US P1b Garchomp drops to 45/183 <from
recoil>` against `SD P1a Charizard uses Heat Wave`; row 25 splits at index 172, `US P1a Kangaskhan drops to
0 fnt <from recoil>`. On `a02123dcc85f` **both games run to the end and never split** (recoil2: 21 turns,
281/285 raw lines, both engines ended the battle; recoil25: 16 turns, 203/203).

## 3. TRAPPING — rows 12, 24 and 32, and they are TWO rules

### 3a. The hard trap outlived a trapper that was KILLED with nothing behind it (rows 12, 32)

**The authority.** `addVolatile('trapped', source, move, 'trapper')` puts `trapper` on the SOURCE carrying
`linkedPokemon: [victim]` (sim/pokemon.ts:2020-2029). `faintMessages` calls `clearVolatile(false)` on the
corpse (sim/battle.ts:2560), and `clearVolatile` frees every linked victim (sim/pokemon.ts:1532-1536,
`removeLinkedVolatiles` at :2053).

**What this engine did.** It recorded only the victim's half (`_trapHard.by`), so the only way to free
anybody was to walk every body on the field — and the release therefore lived at `bringIn`, which its own
header declared as *"one moment late"*. **`bringIn` returns above the release when `_live(bench)` is empty.**
A trapper that died as the last body of its side never passed through it at all.

Read off the replays: in row 12 a Decidueye Spirit-Shackles a Politoed on turn 7 and is KO'd on turn 8 with
no replacement; in row 32 the same shape at turns 9 and 10. Row 32's consequence is visible in the protocol
two turns later — the authority SWITCHES the freed body out and this engine cannot.

**The fix.** `_trapHeld` is the source's half of the link, written by the one new writer `holdHardTrap()`
(both existing `_trapHard` sites go through it). `noteFaint` — the state transition the authority's
`clearVolatile` sits on — calls `releaseTrapsHeldBy(m)`. The list is a HINT and never the truth: every
release re-checks `b._trapHard.by === src`, so a stale entry frees nothing. New counter
`MEDSEEN.trapReleasedOnTrapperFaint`, counted apart from the `bringIn`/switch total.

**Knob** `MEDI_TRAP_SURVIVES_DEAD_TRAPPER=1`.
**Census row** `move/trapsTarget` — *"the trap dies with a KILLED trapper, even with nothing behind it to
bring in"*. The bench on the trapper's side is EMPTY in both arms deliberately (with a replacement the
pre-fix engine passes too, and the row would be green on the bug); the varied knob is one number, the HP the
same Scald lands on. Fixed: `milotic (held true)` vs `kangaskhan (held false)`. Under the knob both arms
read `milotic (held true)` and the row goes MISSING.

**No paired probe, and the reason is the instrument, not a hedge.** In `game_differential`'s world a side
always has a bench, so a paired fixture would exercise the `bringIn` road — the one that was already right —
and prove nothing. Emptying a bench inside a scripted game costs four staged KOs; it is OWED below.

**Replays.** Row 32 on `18773c22878f` splits at index 147, `SD P1a Sneasler sends in (replacing Malamar)`
against `US P1b Simisear uses protect`. On `a02123dcc85f` it runs 14 turns, 170/170 raw lines, and **never
splits**. Row 12 never diverges in protocol at all — it is a board-only parting, and `replay_one.js`
compares no boards, so the replay can only show that the mechanism is present (it is: the log shows the
Decidueye trapping and then fainting with no replacement). The census row is what decides that one.

### 3b. The partial trap ignored the third clause of its own predicate (row 24)

**The authority.**

```
partiallytrapped.onResidual(pokemon) {
  const source = this.effectState.source;
  if (source && (!source.isActive || source.hp <= 0 || !source.activeTurns) && !gmaxEffect) {
    delete pokemon.volatiles['partiallytrapped'];
    this.add('-end', pokemon, this.effectState.sourceEffect, '[partiallytrapped]', '[silent]');
    return;
  }
  this.damage(pokemon.baseMaxhp / this.effectState.boundDivisor);
}                                       — data/conditions.ts:232-244, no Champions override
```

This engine had the first two clauses (`sourceOffField`). The third was a DECLARED REMAINDER at the site
since 2026-08-27: *"`!source.activeTurns` — a trapper that entered the field THIS turn — has no counterpart
below. It needs its own fixture."*

**Row 24 is that.** The Toxapex holding the Infestation switched OUT at the top of turn 4 and its partner's
Parting Shot put it BACK on the field in the other slot, inside the same turn. It is `isActive`, so our
clause declined and we chipped; `activeTurns` is 0 (set by the switch-in, sim/battle-actions.ts:137;
incremented in `nextTurn`, sim/battle.ts:1762), so the authority ended the trap silently.

**The fix.** `_newlySwitched` — the engine's existing reader for the identical clause on Speed Boost's
`boostsEachTurn` (WIRE 138) — is added as a second clause at the trap's own site. It is deliberately NOT
folded into `sourceOffField`, for the reason that function's header already gives: the clause is the trap's
alone and `syrupbomb.condition` has no counterpart. New counter
`MEDSEEN.trapEndedSourceArrivedThisTurn`, counted apart from `trapEndedSourceGone`.

**Knob** `MEDI_PARTIAL_TRAP_OUTLIVES_SOURCE=1`.
**Probe** `tests/probe_partial_trap_source_returns.js`. Two arms, and the returning body is ASSERTED to be
the trapper rather than assumed (which body a pivot brings in is the engine's choice):

| arm | authority | medicham2, fixed | under the knob |
|---|---|---|---|
| RETURNS — the trapper leaves and comes back in one turn | 1 chip, 1 `-end` | 1 chip, 1 `-end` | **3 chips, and 2 boards part on `vol.trapped_by_move`** |
| STAYS — the same board, the trapper stands still | 3 chips, 0 `-end` | 3 chips | unchanged, 0 partings |

**Replay.** Row 24 on `18773c22878f` splits at index 67: `SD P1a Blastoise loses Infestation
[partiallytrapped] [silent]` against `US P1a Blastoise drops to 19/154 tox [from move: infestation]`. On
`a02123dcc85f` that split is GONE and the game runs 74 reduced lines further before splitting at index 141
on a **different** mechanism — see §5.

## 4. BURN — one of four

### 4a. FIXED: Sparkling Aria never cured anything (row 6)

**The authority.** The move's 100% secondary writes a `sparklingaria` VOLATILE on everything it hits, and
that mark is a receipt. The cure is the move's own handler:

```
onAfterMove(source, target, move) {
  if (source.fainted || !move.hitTargets || move.hasSheerForce) { ...clear the marks...; return; }
  const numberTargets = move.hitTargets.length;
  for (const pokemon of move.hitTargets) {
    // bypasses Shield Dust when hitting multiple targets
    if (pokemon !== source && pokemon.isActive &&
        (pokemon.removeVolatile('sparklingaria') || numberTargets > 1) &&
        pokemon.status === 'brn') { pokemon.cureStatus(); }
  }
}                                                      — data/moves.ts:17364-17378
```

**Why it was invisible.** `engine/tag_dex.js` read dex FIELDS. `data/tags.json` therefore carried the
receipt (`statusInflict {volatile:'sparklingaria'}`, plus a `volatileAnnounce` row saying the condition
declares no `onStart`) and had NO row for the payment. The engine wrote the mark on every body it hit and
cured nobody, for as long as the move has existed here.

**The fix.** New derived tag `curesTargetStatusAfterMove`, read off `m.onAfterMove`. One member in this
format, printed:

```
sparklingaria {"status":"brn","viaVolatile":"sparklingaria","multiTargetWaivesTheMark":true,
               "skippedBySheerForce":true,"skippedIfUserFainted":true,"readFrom":"m.onAfterMove"}
```

Every clause is a param because every one of them changes the answer: a reader carrying only "cures brn"
would cure through a Shield Dust on a single target, which the authority does not. The engine consumes it at
the tail of the move, below the `AfterMoveSecondary` payments. New counters `MEDSEEN.afterMoveCurePaid`,
`afterMoveCureRefusedNoMark`, `afterMoveCureRefusedSheerForce`.

**Knob** `MEDI_AFTERMOVE_CURE_OFF=1` — it leaves the MARK in place and removes only the cure, so the red arm
is about the handler rather than about the secondary.
**Probe** `tests/probe_aftermove_cure.js`. The burned body is the user's own ALLY, because the move is
`allAdjacent` and that is how the pool game reached it:

| arm | authority | medicham2, fixed | under the knob |
|---|---|---|---|
| CURES — Sparkling Aria hits the burned ally | 1 `-curestatus` | 1 | **0, and 2 boards part on a `status` leaf** |
| CONTROL — the same board, Hyper Voice instead | 0 | 0 | unchanged, 0 partings |

**Census row** `move/curesTargetStatusAfterMove` — the burn on ALLY / FOE / USER after one click, with all
three burned first: `-/-/brn` against Hyper Voice's `brn/brn/brn`. **The USER keeps its burn in both arms**
(`pokemon !== source`), which is what stops a "cure everything on the field" reader passing.

**Replay.** Row 6 on `18773c22878f` splits at index 108 — `SD P1a Kingambit is cured of brn <msg>` against
`US — nothing further —`. On `a02123dcc85f` the same game runs 6 turns, 111/111 raw lines, both engines end
the battle, and **it never splits**.

### 4b. NOT FIXED, and none of the three is a missing capability

- **Row 3 — Spicy Spray fires HERE and not on the authority.** Scovillain-Mega's ability is
  `onDamagingHit -> source.trySetStatus('brn', target)` with no chance and no contact requirement
  (`data/abilities.ts:4456-4467`; the Champions mod only clears `isNonstandard`). In the parting game a
  Matcha Gotcha hit Scovillain AND a Primarina that fainted from the same spread, and the authority wrote no
  line at all. **Measured, not argued:** a replay of that same game on `18773c22878f` reaches three later
  Spicy Spray triggers and **both engines fire on every one of them, by line**; and a staged spread whose
  co-target faints agrees in both engines too. So "a co-target fainted" is NOT the rule, and the cause is
  not established. The remaining suspects are all board state the window does not show — a Safeguard or a
  Misty Terrain on the attacker's side would make the authority's `trySetStatus` fail SILENTLY, which is
  exactly what the stream shows.
- **Row 27 — a Matcha Gotcha secondary burn (20%) lands on the authority and not here**, on the SECOND
  target of a spread whose first target was behind a Substitute.
- **Row 29 — a Flame Body burn (30%) lands on the authority and not here**, off an Infestation.

Rows 27 and 29 are both REACTION/SECONDARY draws under mode A, where both engines draw from one constant
keyed on `(category, address, nth)`. A staged Flame Body Infestation was run in both engines and **agrees at
exact zero** — neither burns at that address — so the ability is wired and what differs in the pool game is
how many draws the address took before it. That is an address question and it is owed, not closed. Nothing
was changed for any of the three.

## 5. WHAT THE FIX EXPOSED — new, filed rather than smuggled in

Row 24's replay on `a02123dcc85f` now plays 74 reduced lines further and splits on a mechanism the old
engine never reached:

```
  0141  SD    P1a Alcremie fails
        US    P1b Tyranitar raises atk 2
```

A **Decorate whose target left the field**: the authority writes `|-fail|` (the click resolved
`<notarget>`), and this engine still applies the +2/+2 to its ally. It has no probe and is on the ENGINE
hand list.

## 6. FILES CHANGED (all inside the worktree)

- `engine/tag_dex.js` — `recoil` gains `paidOnFail`; new tag `curesTargetStatusAfterMove`.
- `engine/medicham2-browser.js` — the max-HP recoil gate; `holdHardTrap` / `releaseTrapsHeldBy` / the
  `noteFaint` release; the partial trap's `!source.activeTurns` clause; the `onAfterMove` cure; four knobs
  and six counters.
- `tests/test-mechanics.js` — three census rows; four knob names added to `DELIBERATE_BREAK`.
- `tests/probe_recoil_on_a_whiff.js`, `tests/probe_partial_trap_source_returns.js`,
  `tests/probe_aftermove_cure.js` — new.
- `data/tags.json` — regenerated (`316,656` sheet entries, the same figure the tracked artifact carries, so
  the usage weighting is unmoved; the only content diff is the two `recoil` rows and the one new tag).
- `data/mechanics-census.json` — regenerated, 973 live / 0 missing.
- `docs/ENGINE.md` — one section and its hand list. **`CHANGELOG.md`, `docs/RUNNING-NOTES.md` and
  `engine/quarantine.js` were NOT touched, and `status.js --write` was NOT run**, as briefed; the proposed
  notes row is below.
- `data/releases/a02123dcc85f/` — the one release cut here. `data/engine-release.json` was restored to
  `18773c22878f`.
- **Hard links created in the worktree so the corpus could be read** (gitignored, zero bytes on disk, the
  main tree's files are untouched): `data/games.{ladder,bo3,ots}.jsonl` and
  `data/team-pool-frozen/games.{bo3,ots}.jsonl`. Reported rather than deleted.
- No git command that writes was run.

## PROPOSED NOTES ROW

```
| 2026-09-19 | ENGINE | Four of the held-out draw's 34 board partings close: a max-HP recoil is paid for
damage dealt unless the move declares its own `onMoveFail` (`recoil {paidOnFail}`, derived — Struggle false,
Steel Beam true); the hard `trapped` volatile is freed at the trapper's FAINT and not at the replacement,
which a corpse with an empty bench never reaches; `partiallytrapped` honours the third clause of its own
predicate, `!source.activeTurns`; and Sparkling Aria's `onAfterMove` cure exists at all (new derived tag
`curesTargetStatusAfterMove`, one member). **Figure.** Census **970 → 973 live / 973 probed / 0 missing**
(`data/mechanics-census.json`, regenerated this pass). Rows 2, 6, 24, 25 and 32 of
`docs/_reports/2026-09-19-final-remeasure.md` §4 each reproduce their split line on release `18773c22878f`
and, on worktree release `a02123dcc85f`, four of the five never split and row 24 plays 74 reduced lines
further before splitting on a different mechanism (Decorate through a `<notarget>`, new, on the hand list).
Probes: `tests/probe_recoil_on_a_whiff.js`, `tests/probe_partial_trap_source_returns.js`,
`tests/probe_aftermove_cure.js`; knobs `MEDI_RECOIL_ON_A_WHIFF`, `MEDI_TRAP_SURVIVES_DEAD_TRAPPER`,
`MEDI_PARTIAL_TRAP_OUTLIVES_SOURCE`, `MEDI_AFTERMOVE_CURE_OFF`, all four in `DELIBERATE_BREAK` and all four
shown refusing to write the census. **No lattice, battery, roster or gate was run, so no whole-game rate is
claimed here.** **Supersedes.** Nothing — the 34 of `docs/_reports/2026-09-19-final-remeasure.md` was
measured on `18773c22878f` and stands as a reading of that release. **Basis.** unchanged. **Owed to:**
docs/ENGINE.md (done this pass); the whole-game figure is owed to whoever next runs the lattices. |
```

## OWED, NOT RUN

1. **NO LATTICE, NO BATTERY, NO ROSTER, NO `quarantine.js`.** LIGHT MODE. The board-material effect of these
   four fixes on the gate's three lattices and on a held-out draw is UNMEASURED. Four of the 34 are
   individually shown to stop parting on their own seeds, which is not the same claim.
2. **Burn rows 3, 27 and 29 are open**, with §4b's diagnosis. Row 3 needs the full board state of that game
   (a Safeguard or a Misty Terrain would explain it exactly); rows 27 and 29 need the draw ADDRESS compared,
   which is `probe_reaction_address.js` / `probe_spread_secondary_address.js` territory.
3. **No paired probe for the KILLED-trapper release.** The census row carries it. A paired fixture needs a
   side's bench emptied inside a scripted game (four staged KOs) and was not built.
4. **Decorate through a `<notarget>`** — new, found by the row-24 replay, no probe, not fixed.
5. **The replays do not reproduce the artifact's games exactly.** `--no-warmup` starts the driver's coverage
   counters at zero, so the click sequence diverges from the night's; `replay_one.js` prints NOT REPRODUCED
   / UNCHECKED itself. What IS shown is that each parting's SPLIT LINE appears on the old release and is
   gone on the new one. Row 12 is board-only and `replay_one.js` compares no boards, so it rests on the
   census row.
6. **`data/tags.json` was regenerated from hard-linked stores.** `sheet_entries` matches the tracked
   artifact exactly (316,656), so the usage weighting is unmoved — but the monoliths are dated 2026-09-10
   and a future regeneration in the main tree may read more. Stated so the next reader does not diff the
   `uses` fields and think this pass moved them.
7. **`fit_policy.loadCorpus` drops a missing store SILENTLY** (`if (!fs.existsSync(p)) continue;`, no `.gz`
   fallback). A first regeneration here lost 34,584 sheet entries and would have published a tags artifact
   with quietly smaller usage counts; it was caught by diffing. Not fixed — it is a one-line loud-failure
   change in a file this brief did not scope.
