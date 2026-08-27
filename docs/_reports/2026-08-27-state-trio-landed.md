# Three small state reads, landed — 2026-08-27, ENGINE

**board-material 5 -> 2 of 961. whole-game 7 -> 6 of 961. Gate 3 of 8 clauses failing -> 2 of 8.**

| patch | delta | proved by |
|---|---|---|
| **A** `#501` — the middle arm's range-form pin covers `sec`, not only `any` | board-material **5 -> 4**; whole-game **7 -> 7**, twelve rows byte-identical | `tests/probe_state_trio.js` `A-arm t2/t3/t4`: red at `vol.confusion medicham 2 showdown 4`, green after; `MEDI_MID_RANGE_DRAWS=1` reproduces the SAME red |
| **B** `#502` — one authority secondary row is one chance draw | board-material **4 -> 3**; whole-game **7 -> 6** | `B-arm`: `sec draws showdown 1 medicham 3` and a parted board, -> `1 / 1` and identical |
| **C** `#503` — a corpse wears its base types | board-material **3 -> 2**; whole-game **6 -> 6**, eleven rows byte-identical | `C-faint` and `C-selfko`: red at `types medicham "ice" showdown "dark/grass"`, green after; `MEDI_TYPES_SURVIVE_FAINT=1` reproduces the same red |

**DID A MOVE ANY GAME NOBODY HAD DIAGNOSED? NO.** That was the specific thing to check, because A is
the instrument. The twelve whole-game first-divergence rows came back **byte-identical** — same seeds,
same turns, same causes — and the only board-material row that left was the confusion game the
diagnosis named. Its blast radius was measured, not argued, before the predicate was widened.

---

## The pins, honoured

Arm `middle`, `--games 1200` (yields 961), `--turns 12`, `--team-store data/team-pool-frozen`,
census pin `9446a684709d`, `--state --end-state`. **One release cut per patch and passed EXPLICITLY**,
never left to the default:

```
baseline  bdac5f198274   HEAD 61f523a7, no engine change             board-material 5   whole-game 7
A         bdac5f198274   instrument-only, so the engine bytes did not move    4                   7
B         aec34bbd081b                                                        3                   6
C         e58426bcd8b0                                                        2                   6
final     29371cb9c6fe   re-run after the roadmap-id renumbering               2                   6
```

`.scratch_eng_diffrun.cmd` was **not** run — it pins release `6272fa445b73`, a different simulator.
Every run above went through a shim written this session.

**`tools/lownode.cmd` could not be reached from this shell and a substitute was built and ASSERTED.**
Every route tested (`cmd.exe /d /c tools\lownode.cmd`, an absolute path, `windowsVerbatimArguments`)
had node strip the path separator, and cmd reported `toolslownode.cmd` not found; passing `cwd` to
`spawnSync` returns ENOENT here regardless. The substitute is a `--require` preload that drops the
process to BELOWNORMAL and **exits 96 if `os.getPriority` does not confirm it**, so a silent failure
cannot look like a working wrapper. Exit codes propagate verbatim (checked with a deliberate
`process.exit(7)`). No output was piped through `tail`; every exit code was read with `echo $?` on the
unpiped command.

## A — the blast radius, measured before the widening

`game_differential.js` now tallies every two-argument `random` by `cat|move|m..n` **before** the pin
decision and publishes `mid_void.range_form_seen_by_cat`. The old pair of counters was structurally
blind to exactly this case: a `sec` range draw incremented **neither** `range_form_pinned` **nor**
`range_form_live_draws` and fell straight past both into `midDraw` — the receipt that exists to police
this pin could not see the category it was missing.

Over the 961-game pinned pool, **before** the predicate changed:

```
409 two-argument draws:   any 405    sec 4    acc 0    dmg 0
    all four `sec` draws are `hurricane|2..5` — the confusion duration, and nothing else
```

So the widened predicate newly swallows **four draws, all confusion**, and swallows nothing under
`acc` because no `acc` range draw exists in this checkout. **It also settles an item the diagnosis
left owed: there is no two-argument `random` inside `getDamage` at all on this pool**, so
`MIDW.cat !== 'dmg'` and "pin everything" are the same predicate here. `dmg` stays excluded anyway —
the line above re-labels a two-argument `dmg` random as `crit` and that mapping is a separate untested
claim; excluding a category that measured zero costs nothing.

After the widening the tally reads `sec` 5 (`hurricane|2..5` 4, plus one more once the confusion game
plays on past the turn it used to part at) and `range_form_pinned` 405 -> 410.

**A new pin claim drives `MIDW.cat` to `sec` explicitly.** The standing range-form claim runs at the
default `any` and therefore passed for the whole time the pin was missing the only category that
carries a duration — a green check that was asking nothing.

## The pin digest moved, and the argument for it

`44bd49403231` -> `48e1007ac14a`, and `DICE_MODEL` `split/v3` -> `split/v4` in the same commit.

The brief asked for this to be justified either way. **A is not an engine change — it is a change to
the dice contract inside `game_differential.js`, which is the instrument the digest identifies.** It
changes the value the authority receives AND stops those draws consuming a shared `sec` address, which
shifts the `nth` of every later draw at that address in the same turn. That changes which games
diverge, so a run before it and a run after it are two instruments, not two samples — which is the
rule this file already states in its own header.

The stronger half: **v3's own sentence already read *"the RANGE form outside the damage machinery is
pinned to m"***, and `acc` and `sec` are outside the damage machinery. The code said `cat === 'any'`.
So the digest was tracking a **sentence** rather than a behaviour — exactly the failure the v1 -> v2
note warns about, arriving from the other side — and leaving `v3` in place would have left two
DIFFERENT behaviours sharing one digest, which is worse than the reset. Same precedent as `#491`,
which moved it `f646b0163bc0` -> `44bd49403231` for the same reason.

Consequence, stated: `arms_comparable.js` will now REFUSE to table the 5-of-961 baseline against the
2-of-961 result. That is correct, and it is why every delta above was taken as its own run with its
own artifact rather than inferred.

## B — an address defect, and the population derived

`data/move-effects.js` is generated from FIELDS and an authority secondary can be a CLOSURE, so
Champions' `direclaw` — `secondary: {chance: 30, onHit(target, source) { const status =
this.sample(['psn','par','slp']); ... }}` in `data/mods/champions/moves.ts`, **not** `data/moves.ts`
which says 50 — arrives as an inert `{chance:30}`. The generic loop rolled it at `nth 0` and applied
nothing; the `proceduralStatus` block rolled the same 30% again at `nth 1` (the address the authority
spends on `this.sample`) and the pick took `nth 2`, which the authority never reaches.

The loop does not short-circuit, so the status was decided by the second draw alone and the marginal
rate stayed exactly 30%: a rate check, a census probe and a seeded harness all pass. Two independent
coins on a 30% event disagree `2 x 0.3 x 0.7 = 42%` of the time.

**The population is DERIVED by the probe and printed before the arms** — nine legal moves carry an
inert rulebook secondary row, and none carries two:

```
 20  triattack        proceduralStatus     BROKE
 30  direclaw         proceduralStatus     BROKE
100  alluringvoice / burningjealousy / ceaselessedge / stoneaxe    -
100  eeriespell       removesPP            one draw, lined up by accident
100  spiritshackle    trapsTarget          one draw, lined up by accident
100  throatchop       blocksSoundMoves     one draw, lined up by accident
```

**That the seven at 100% still line up is MEASURED, not assumed.** `B-100a` (Throat Chop), `B-100b`
(Spirit Shackle) and `B-100c` (Eerie Spell) stage the three whose tag block now reads the recorded
roll, and each takes **exactly one `sec` draw on both sides** with identical boards.
`tests/roster.js --stage moves` covers the other four at 0 FIRED-AND-BOARDS-DIFFER.
`trapsTarget` and `removesPP` were given the same guard as `proceduralStatus` so all three tag blocks
read ONE rule; at chance 100 the roll cannot fail, so nothing about them moves today.

**No fixture qualified for two reasons.** The probe DERIVES and prints the refusal-reason count for
every status each cell must be able to take — reading the type chart's `damageTaken` and the cell's
**declared** ability — and exits 2 on any cell with more than zero:

```
B-tri     {brn,par,frz} on Diggersby (Normal/Ground, Huge Power):  NONE
B-arm     {psn,par,slp} on Diggersby:                              NONE
B-100b/c  {trapped}     on Garchomp  (Dragon/Ground, Rough Skin):  NONE
```

## C — the located edit point was wrong, and the probe said so

The diagnosis put the type restore in `queueFaint`, beside the `_ttmWrap` clear that cites the same
authority line. Run there:

```
C-faint    p1.party.meowscarada.types  medicham "ice"    showdown "dark/grass"       STILL RED
C-selfko   p2.party.gallade.types      medicham "water"  showdown "fighting/psychic" STILL RED
MEDSEEN.typesRestoredOnFaint = 0     -- it never fired once, on either road
```

`queueFaint` is not the shared faint site, and this engine's own `faintHousekeeping` header already
recorded why: the transform revert was tried there and left its probe red **because Memento's self-KO
never reaches it**. It is in `noteFaint`, **after** `faintHousekeeping` so `imposterRevert` has put a
transformed body back on its own name before a row is read against it, and it reads `monRow(m.name)`
rather than a stashed base so a MEGA that faints reads its mega row and nothing changes — matching the
authority, where a mega rewrote `baseSpecies`.

`C-selfko` is the arm that separates the two homes and it is a control that can fail. No Protean
carrier in this format learns a self-KO move (derived: greninja, greninja-mega and meowscarada learn
none of explosion / finalgambit / healingwish / memento / mistyexplosion / selfdestruct), so the
conversion comes from **Soak** instead — the same `setType` through a different door.

## Five fixture faults, all caught before they were read as engine results

- `B-tri`, `B-100a` and `B-100b` first reported boards IDENTICAL **with zero draws on either side**:
  the foes were Protecting and nothing staged.
- `C-selfko` first reported IDENTICAL because Memento hit `-activate|move: Protect`, so its user never
  fainted. The same green-that-proves-nothing `C-faint` already records in its own comment.
- The refusal-reason derivation walked all three ability SLOTS and refused Garchomp for Sand Veil,
  which the fixture does not carry. It reads the DECLARED ability now.

All four battle-arm faults were visible only because the arm prints its **draw count** beside its
verdict.

## Everything that had to hold, and did

```
damage                0/6000 at all sixteen corners, before and after every patch   (seed 20260804)
roster                items 139/148, abilities 129/202, moves 475/500 — 0 FIRED-AND-BOARDS-DIFFER,
                      0 DID-NOT-FIRE on all three stages
census                765 probed / 765 live / 0 missing — unmoved by every patch
all_mechanics_fire    moves 8, abilities 3, items 1 diverging — unmoved by every patch
gate                  3 of 8 clauses failing -> 2 of 8
                      (whole-game differential; mechanics staged and compared)
```

Nothing reached the damage road, which is what the brief asked to be sure of.

## Register

- **ROADMAP #501, #502, #503 — CLOSED.**
- **ROADMAP #504 — FILED.** A corpse wears its base ABILITY. `clearVolatile` does
  `this.ability = this.baseAbility` on the same call `#503` is read from; `switchOut` handles it
  (`abRestoreOnLeave`), the faint path does not. **No failing probe, so it is a row and not a fix.**
  One ordering hazard travels with it: the authority's `Faint` event fires ABOVE the clear, so a
  Receiver inherits the ability the corpse was WEARING — `_abAtFaint` exists for that reader and a
  careless restore would silently break a mechanic that works today.
- **ROADMAP #505 — FILED.** A corpse reverts a non-permanent FORME. Carries the interaction with #503
  explicitly: a body that faints inside a temporary forme now has its types restored against **that
  forme's** row here and against its BASE species' in the authority. Strictly closer than no restore,
  and not correct.

Neither was folded into this batch. They are two more statements from the same authority line, not the
same statement.

## Living docs

`CHANGELOG.md` **5.185.0**, `docs/MEDICHAM-SPRINT-NOTES.md`, `docs/ENGINE.md` (new section + the probe
added to the Owns list and the instrument table), `docs/ROADMAP.md` (five rows),
`node engine/status.js --write`. `tests/test-docs-current.js` passes 23/23.

---

## OWED, NOT RUN

- **The confusion DURATION is still the minimum and A does not fix it.** medicham2 writes
  `CONFUSION_TURNS_MIN = 2` and never draws; the authority draws `random(2,6)`, uniform over
  {2,3,4,5}. A pins both engines to the minimum, so the pinned pool is now blind to it by
  construction. Against real dice confusion lasts 3.5 attempts and this engine gives it the floor, so
  a search UNDER-VALUES landing one. It is a counted, declared narrowing
  (`MEDSEEN.confusionMinDuration`) and it belongs to the lab — the roster and the census — not to the
  pool. **Not filed as a new row this pass**; it is the standing declared narrowing in the engine.
- **The partial trap's constant was not checked against the pin's bottom.** A makes both engines read
  `m` for every non-`dmg` range draw. That is only correct while medicham2's constant IS the minimum.
  It is for confusion (2 = `random(2,6)`'s bottom). The trap's `turns:(_tn?+_tn[0]:4)` against
  `conditions.ts:227`'s `random(5,7)` was **not** checked — carried over unexamined from the diagnosis'
  own OWED list. `any|infestation|5..6` appears twice in the tally, so the case is live in the pool.
- **The `dmg` two-argument re-label is still untested.** Measured at ZERO occurrences on this pool, so
  the exclusion costs nothing and proves nothing.
- **The two remaining board-material games are not mine and were not touched** — both are ROADMAP
  #478's address class (the authority draws its random target before `setActiveMove`, so its address
  carries no move name while ours carries move and slot). One of them,
  `p2.party.gardevoir.ability goodasgold vs innerfocus`, is a Trace CHOICE on a LIVE body and is not
  #504.
- **The four 100% inert rows with no tag** (alluringvoice, burningjealousy, ceaselessedge, stoneaxe)
  were not staged directly. They have no second drawing consumer, so the patch cannot reach them, and
  the roster's moves stage covers them at 0. That is an argument plus a coarse instrument, not a
  directed arm.
- **`tests/probe_state_trio.js` still asserts nothing and exits 0 whatever it finds.** It is read, not
  gated on. Making it a gate was not in scope and is not claimed.
- **The `--replay` path in the probe was not re-run after the fixes.** It reconstructs each pair alone
  and the driver carries state between games, so it never reproduced the driver's trajectory for A or
  C anyway.
- **Untracked files reported and left alone**, per the standing rule: `data/_pair-pilot.json`,
  `data/medicham-represented-clicks.json`, `data/_scratch-scovillain-dump.json`, `.scratch_eng/`,
  `.scratch_pk/`, and ~20 `.scratch_*` outputs including `.scratch_eng_diffrun.cmd` (which pins the
  WRONG release and should not be executed by anyone).
- **The feature-semantics stamp gate at the top of `status.js` is still red** — not mine, not new,
  and MEASURE's. `tests/staged_board.js` 1 of 25 and `engine/register_reality.js` exit 1 are likewise
  untouched.
