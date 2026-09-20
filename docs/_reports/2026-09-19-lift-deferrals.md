# Lifting the DEFERRED-BY-OWNER rows — 2026-09-19

ENGINE, isolated worktree `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a059406805efe0b8f`.
LIGHT MODE: single-rule roster runs and census probes only. No full battery, no lattices, no `quarantine.js`.

**Pins.** Releases cut in this worktree: `1da61a8862d1` (first Electrify attempt), `4bc4a3325f76` (the working
release for §2) and **`5f4a1727cdac`, the FINAL bytes, on which Stall, Pickup and the whole
`move/volatile` rule were all re-read after the last edit** — `MEDI_FRISK_SILENT` was added to
`medicham2-browser.js` after `4bc4a3325f76` was cut, so the earlier verdicts are re-confirmed rather
than assumed: Stall `FIRED-AND-BOARDS-MATCH 1`, Pickup `FIRED-AND-BOARDS-MATCH 1`, `move/volatile`
`23 of 23 MATCH, 0 DIFFER, 0 DEFERRED`, plant CAUGHT. `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`.
`data/engine-release.json` restored to its pre-run pointer afterwards.

**Ruling this pass rests on.** Will, 2026-09-19: *"keep zoroark and illusion a real exclusion that we
know about and acknowledge. anything else you can model for medicham go for it"*.

---

## 1. The deferrals, read from the mechanism

Three mechanisms shelve a row in `tests/roster.js`, and the brief's list mixed all three:

| mechanism | rows it held on 6.70.0 |
|---|---|
| the named `DEFERRED` map | `copycat`, `battlebond`, `stall`, `pickup`, `anticipation`, `forewarn`, `frisk` |
| `usageShelf()` — a move under 25 clicks whose verdict is DIFFER or DID-NOT-FIRE | `axekick` (2 clicks), `electrify` (18 clicks) |
| `illusionCloset()` — keyed on the CARRIER, not the entity | `illusion` |

The usage shelf is a **rule**, not a list, and it only bites a row that is already accusing. So the
exit for a shelved move is to become CORRECT — the Flying Press precedent — not to be exempted.

---

## 2. Row by row

### Axe Kick — **FIRED-AND-BOARDS-MATCH**, no work needed
Read on `18773c22878f` (the 6.70.0 pointer release): `1 of 1 tested, 0 DIFFER, 0 DEFERRED-BY-OWNER`.
The confusion-clock fix in 6.70.0 (`dec05b65`) had already closed it, so `usageShelf` no longer applies
— the row's verdict is not DIFFER and not DID-NOT-FIRE. It left the shelf by being right.

### Electrify — **DIFFER → FIRED-AND-BOARDS-MATCH.** A real, unmodelled mechanic, now wired.

The shelf was carrying a genuine defect. `effMoveType` knew four ways a move's type can move — the
move's own unconditional rewrite, the forme-keyed rewrite, the `-ate` ability conversion, and the
weather/terrain rewrites. It knew **no way for a VOLATILE to do it**, and Electrify is the only move in
this format that writes one:

```
data/moves.ts:4571-4583   onModifyTypePriority: -2,
                          onModifyType(move) { if (move.id !== 'struggle') { ...; move.type = 'Electric'; } }
data/mods/champions/moves.ts:274-277   electrify: { inherit: true, isNonstandard: null }
```

**Three parts landed.**

1. **A derived tag, `move/volatileRetypesMoves`** (`engine/tag_dex.js`). The predicate is a SHAPE: an
   `onModifyType` whose whole body is an optional `move.id !== "<id>"` guard, optional `this.debug`,
   and exactly ONE literal `move.type = "<Type>"`. Anything else is refused and gets no row.
   **Membership printed over every legal move before it was wired: ONE row, `electrify -> electrify`,
   `{type: 'Electric', exceptMoves: ['struggle'], priority: -2}`, and zero refusals.** The four
   `onModifyType` handlers that live on the MOVE itself (Aura Wheel, Raging Bull, Terrain Pulse,
   Weather Ball) are keyed on runtime state, fail the shape test, and stay with their own tags.

2. **Two consumers, through one function.** Wiring it into `effMoveType` alone was **not enough and
   the roster proved it**: the census probe went LIVE off the immunity gate while
   `roster --only electrify` did not move a single HP — our subject arm matched the authority's own
   CONTROL to the point (`Heliolisk 1042 / 988`). `dmgRangeOneHit` re-derives the type independently
   (the WIRE 126 split, paid for once already with Aerilate). `volatileRetypeOf(att, moveId)` is now
   one function called from both, applied LAST in each because `onModifyTypePriority: -2` runs after
   every other handler.

3. **The condition's `duration: 1`.** The generic volatile writer gives a volatile with no other clock
   a bare `1` and nothing decremented it, so an electrified body stayed electrified for the rest of the
   game. Expired at the per-turn reset, scoped to the retype table and reading the duration off
   `volatileRestart` rather than a literal.

**Census row** `move/volatileRetypesMoves` — Heliolisk (the only legal learner of Electrify in this
format, derived) electrifies a slow Torkoal; Torkoal's Body Slam is Normal into a Dragon/Ground
Garchomp (damage) and Electric into the same Garchomp (**nothing**). The negative is turn 2, where the
damage must come back. Arms: control `[33,33]`, test `[0,33]`.
Knob `MEDI_ELECTRIFY_NO_RETYPE=1` → **MISSING**, arms `[33,33]` identical to control, and the run
**refused to write the census** (`MEDFAILS.electrifyNoRetypeRestored`).

Roster on `4bc4a3325f76`: `FIRED-AND-BOARDS-MATCH 1, DEFERRED-BY-OWNER 0`.
`--rule move/volatile --reds`: **23 of 23 MATCH, 0 DIFFER, plant CAUGHT** (`via disable -> FIRED-AND-BOARDS-DIFFER on vol.disable`).

### Stall — **lifted, FIRED-AND-BOARDS-MATCH**, and the shelf reason had expired

The shelf's judgement half (ZERO of 26,232 declared sheets; Will's *"why would you ever want this"*)
still stands. Its **claim** half — *"it carries no tag at all, so the rule would have to be written
first"* — was false by the time I read it: `tag_dex.js` derives
`ability/fractionalPriority {chance:1, bracket:-0.1, unconditional:true, announce:null}`, and
`medicham2`'s ordering loop already consumes it (`_abHit = _gate && (_fa.unconditional || ...)`, then
`_q = bracket < 0 ? -1 : 1`). The mechanism was wired; only the fixture was missing.

**New rule `ability/moves-last-in-its-bracket`** — the sign-flipped twin of
`ability/jumps-its-priority-bracket-by-chance`, which requires `chance < 1` and therefore could never
reach Stall. **Membership printed: `stall`, and nothing else.**

**The first fixture was wrong and the refusal is the evidence.** Mirroring Quick Draw exactly means
staging a KILL, and the rule answered on the format: *"no legal buildable body is BOTH strictly slower
than Sableye (Speed 102) AND killable outright ... with 35% of headroom"* — the one legal carrier is a
defensive body that kills nothing. Lethality is the Quick Draw rule's convenience, not this mechanic's.

The fixture that works makes the order matter **without a KO**, via a self-heal at full HP:

- the carrier is strictly faster and clicks a derived self-heal on itself; the victim hits back;
- **without** the ability the heal resolves first from full and does nothing, then the hit lands → `max - D`;
- **with** it the carrier drops to the bottom of its bracket, takes the hit first, and heals it back → `max`.

Staged: `Sableye (Speed 102) vs Ariados (Speed 92)`, Recover against X-Scissor, control = in-play Skill
Swap lending Shell Armor off Goodra-Hisui (taken by `stageAbilityQuiet`, because Sableye's only sheet
control is Prankster and that is a live ability).

Roster: `FIRED-AND-BOARDS-MATCH 1`. `--reds`: **CAUGHT — `ability/moves-last-in-its-bracket via stall -> DID-NOT-FIRE on party.hp, hp`.**

### Pickup — **lifted, FIRED-AND-BOARDS-MATCH.** The shelf reason was accurate; the ruling changed.

The shelf said observing it needs *"a SECOND body to consume an item on an earlier turn ... a
three-body two-turn setup"*. That is exactly what the new rule builds, down to the two turns. The
0.011%-usage measurement still stands and is still why this row is worth nothing to the pinned pool.

**New rule `ability/picks-up-a-spent-item`**, sitting above `ability/residual`.
**Membership printed: `pickup`, and nothing else** (predicate: an `onResidual` whose source names both
`usedItemThisTurn` and `lastItem`). The authority's condition, read at
`data/abilities.ts:3252-3266` with no Champions override, needs three things at one residual: the
carrier holds nothing, somebody adjacent spent an item **that turn**, and they still remember what it
was. **Exactly one body may qualify** — `this.sample(pickupTargets)` is a die the moment a second is
eligible — so one body on the board is given a consumable and nothing else holds one.

The berry is derived off `healsAtThreshold` (highest gate, ties broken by id → Oran Berry, `1/2`), and
`hitInBand` sizes a real delivery move that puts the holder under it and leaves it standing.

**The first band was wrong and it is written down.** Asking for `lo = 1 - berry.at` — a hit big enough
to reach the gate exactly — plus `hitInBand`'s rule of returning the SMALLEST in-band hit, put the pick
on the line. Played against the authority it landed at **53% where the predictor said 48%**, the berry
was never eaten, and the row came back `THE STAGING IS INERT ... over 1656 compared leaves`. Twelve
points of margin (the same `ability/pinch-offense` already uses) fixes it.

Staged: Oran Berry on the carrier's partner Beedrill, taken to **31%** by Dragapult's Flamethrower on
turn 1; the empty-handed Gourgeist-Super takes the wrapper at the residual. Turn 2 is the negative — the
carrier now holds something, so the handler returns on its own first line.

Roster: `FIRED-AND-BOARDS-MATCH 1`. `--reds`: **CAUGHT — `ability/picks-up-a-spent-item via pickup -> DID-NOT-FIRE on party.item, item`.**

### Copycat — **NOT lifted. Real defect found, and the shelf's stated reason was stale.**

The reason under the entry said the row fails because Showdown refuses `addVolatile` for a present
volatile with no `onRestart`, and that a failed move never becomes `lastMove`. **Both halves are now
implemented** (`volRefusesRestart` with its `duration: 1` exemption; the authority's `-fail` lines for
the second Focus Energy appear in both engines). The row still parts, and it parts elsewhere.

Rebuilt the fixture shape by hand in both engines (not inferred from the diff):

```
AUTHORITY  |move|p2a: Samurott|Copycat|p2a: Samurott
           |move|p2a: Samurott|Dragon Claw|p1a: Medicham|[from] move: Copycat
OURS       |move|p2a: samurott|copycat|p2a: samurott
           |move|p2a: samurott|dragonclaw|p1b: corviknight
```

Same move copied; **different slot**. `useMove(id, pokemon)` with no target resolves
`getRandomTarget`, which for a `normal` move in a double falls to
`pokemon.side.randomFoe()` → `this.battle.sample(this.foes())` (sim/battle.ts:2507-2518,
sim/side.ts:367-371) — a draw off the shared stream. This engine draws its own at `midTargetDraw(...)`
in the `callmove` branch and lands on the other index. The roster row carries `coin: null` and
`dice: null`, so the instrument does not know a die is live here at all.

**The owed work is a DIE-ADDRESS batch**, the same family as `tests/probe_fracpri_die_order.js`, not
the volatile-refusal batch the entry named. The closet entry is **corrected in place** rather than
deleted: Will's ruling stands, and a shelf whose reason is false is worse than a shelf.

### Anticipation, Forewarn, Frisk — **cannot be graded by a board comparison, and that is DERIVED**

These three are not a fixture problem. `tag_dex.js` derives, for all three and only these three:

```
announcesOnEntry   ... "visibleOnABoard": false
```

— read off each handler's own body, not asserted. Their entire effect is a protocol line; there is no
HP, no stat stage, no volatile and no field for `board_state.js` to compare, so **no roster verdict
could ever be anything but vacuous**. Each is instead covered by a census row that goes red under its
own knob:

| ability | census row | knob | red arm |
|---|---|---|---|
| Frisk | `ability/announcesOnEntry` — one `-item` line per HOLDING foe, none for an empty one, each naming its holder as `[of]` | `MEDI_FRISK_SILENT` **(added this pass)** | MISSING, arms `0 / 0 / 0`, census write REFUSED |
| Anticipation | `ability/announcesOnEntry` — shudders once at a super-effective or OHKO foe move, not at an immune or neutral one | `MEDI_ANTICIPATION_SILENT` | MISSING, arms `[0,0] / [0,0]` |
| Forewarn | `ability/announcesOnEntry` — names the foes' top-scoring move, silent against status-only foes | `MEDI_FOREWARN_SILENT` | MISSING, arms `[0,0] / [0,0]`, census write REFUSED |

**Two holes found while proving this, both fixed:**

- **Frisk had no knob at all.** Its `-item`-on-foe arm was wired at 6.70.0 with no way to break it, so
  the only instrument that can see Frisk was resting on a green nobody had ever seen fail.
  `MEDI_FRISK_SILENT` now exists, stamps `MEDFAILS.friskSilentRestored`, and is in `DELIBERATE_BREAK`.
- **`MEDI_ANTICIPATION_SILENT` was never in `DELIBERATE_BREAK`**, so its red demonstration **WROTE the
  census** — measured on this run, `970 live, 1 missing` was published over a clean 971 and the
  artifact had to be regenerated. Identical hole to the Sucker Punch and `announcesOnStart` knobs
  already listed there, found the same way: by reading the **last line** of the red run's output rather
  than its verdict.

**These three stay in the closet, and that is a statement I cannot unilaterally change.** Removing them
would give them verdict `COULD-NOT-STAGE`, and `engine/quarantine.js` fails the roster clause on any
IN-SCOPE `COULD-NOT-STAGE` row — the gate would close. The honest fix is a distinct, non-accusing
verdict (`ANNOUNCEMENT-ONLY`, requiring a named census row + knob as its receipt) **plus a matching
clause in `quarantine.js`**, which this division may not edit. Inventing the verdict without the clause
would be laundering: three rows would slip past all three gate clauses at once. **Proposed, not done.**

### Illusion — **kept deferred, as instructed**

Untouched. `illusionCloset()` is carrier-keyed and derives its membership from the ability, so a body
added by a later regulation is shelved without an edit. Measured population for the record (supplied in
the brief, not re-derived here): Zoroark and Zoroark-Hisui, 408 of 13,214 bo3 sheets (3.09%), 215 brought.

---

## 3. Census

`970 live / 0 missing / 970 probed` → **`971 live / 0 missing / 971 probed`**, 0 hollow.
The single new row is `move/volatileRetypesMoves`.

---

## 4. Files changed (all inside this worktree)

| file | what |
|---|---|
| `engine/tag_dex.js` | new derived tag `move/volatileRetypesMoves` |
| `engine/medicham2-browser.js` | `volRetypeTable()`, `volatileRetypeOf()`, the two consumers, the `duration: 1` expiry, counters `volatileRetyped` / `volatileRetypeExpired` / `volRetypeTableFailed*`, knobs `MEDI_ELECTRIFY_NO_RETYPE` and `MEDI_FRISK_SILENT` with their MEDFAILS stamps |
| `tests/roster.js` | new rules `ability/moves-last-in-its-bracket` and `ability/picks-up-a-spent-item`; `stall` and `pickup` off the closet (left as commented history); `copycat`'s closet reason corrected |
| `tests/test-mechanics.js` | census row `volatileRetypesMoves`; `electrifyNoRetypeRestored`, `friskSilentRestored` and the missing `anticipationSilentRestored` added to `DELIBERATE_BREAK` |
| `data/tags.json` | regenerated |
| `data/mechanics-census.json` | regenerated |

Not touched: `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `engine/quarantine.js`, `engine/board.js`,
`engine/magnemite.js`, `data/engine-data.js`. No `status.js --write`. No commit, no push.

---

## PROPOSED NOTES ROW

```
### 2026-09-19 — ENGINE: six of the nine owner-deferred roster rows lifted; Electrify's retype wired

**What changed.** `tests/roster.js`'s closet is cut from nine rows to four. Axe Kick and Electrify left
the usage shelf by becoming CORRECT rather than by being exempted; Stall and Pickup got the fixtures
their shelves said they lacked. Electrify's retype was genuinely unmodelled: `effMoveType` knew four
ways a move's type can move and none of them was a volatile, so an electrified move kept its own type
here and was Electric on the authority. Landed as a derived tag (`move/volatileRetypesMoves`, membership
printed at ONE row before wiring), one shared reader called from both `effMoveType` and `dmgRangeOneHit`,
and the condition's own `duration: 1` expiry.

**The figures.** Mechanics census `970 live / 970 probed` → **`971 live / 971 probed`, 0 missing,
0 hollow** (`data/mechanics-census.json`). Deliberate roster on release `4bc4a3325f76`:
`move/volatile` **23 of 23 FIRED-AND-BOARDS-MATCH, 0 DIFFER, 0 DEFERRED-BY-OWNER** (Electrify was
DEFERRED with an underlying DIFFER); `abilities --only stall` and `--only pickup` each
**FIRED-AND-BOARDS-MATCH 1**, each with its red plant CAUGHT (`--reds`).

**Supersedes.** The DEFERRED-BY-OWNER count of nine in `tests/roster.js`. Two shelf REASONS are
corrected rather than removed: Stall's *"it carries no tag at all"* (false since `tag_dex.js` began
deriving `fractionalPriority` for it), and Copycat's *"Showdown refuses `addVolatile` ... a failed move
never becomes `lastMove`"* (both implemented; the row now parts on the called move's random-target die
address — the authority aims the copied move at `p1a`, this engine at `p1b`).

**Still withheld.** Copycat stays shelved on a die-address defect; Illusion stays shelved on Will's
2026-08-25 ruling; Anticipation, Forewarn and Frisk stay shelved because `announcesOnEntry` derives
`visibleOnABoard: false` and no board comparator can ever see them — each is instead covered by a census
row proven red under its own knob (`MEDI_FRISK_SILENT` added this pass; `anticipationSilentRestored`
added to `DELIBERATE_BREAK`, where its absence had let a red run publish the census).

**Basis.** unchanged.

**Owed to.** `docs/ENGINE.md`.
```

---

## OWED, NOT RUN

- **The full roster stages.** Only `--only electrify`, `--only stall`, `--only pickup`,
  `--only copycat`, `--only axekick` and `--rule move/volatile` were run, per LIGHT MODE. The abilities
  and moves stages have **not** been run end to end since the two new rules were added, so the claim
  "nothing else moved" is **not made**. Two things make a regression unlikely and neither is a
  measurement: both new rules print a membership of exactly one entity, and both sit above the broad
  rules they pre-empt rather than inside them.
- **`quarantine.js`.** Not run. Whether the roster clauses still pass, and whether the gate is still
  open, is unmeasured from here.
- **The whole-game differential and the lattices.** Not run. Electrify is **18 clicks in 64,846 stored
  games** and Pickup is on **3 teams of 26,232**, so per CLAUDE.md's ranking rule the expectation stated
  **before** any such run is that the **lab moves and the pinned pool does not**. Anyone who runs it
  should say so first.
- **The `ANNOUNCEMENT-ONLY` verdict.** Proposed in §2 and deliberately not built: it needs a matching
  clause in `engine/quarantine.js`, which ENGINE may not edit. Until it exists, Anticipation, Forewarn
  and Frisk remain DEFERRED-BY-OWNER and Illusion is **not** the only excusal left.
- **Copycat's die address.** Diagnosed with the authority's own log and both source lines; not fixed.
  It is a die-address batch of the `probe_fracpri_die_order.js` family and wants its own probe.
- **`data/roster.*.json`.** Not regenerated — every roster run here was read from stdout, not written,
  so the shipped roster artifacts still describe 6.70.0.
