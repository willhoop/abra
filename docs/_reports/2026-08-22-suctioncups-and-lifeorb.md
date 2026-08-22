# Suction Cups through the damaging door, and the Life Orb toll that read a stale number

ENGINE, 2026-08-22. Two batches, landed and measured strictly one at a time.

Releases: **`39631097fcc7`** (before), **`7719a4110299`** (after batch 1), **`fc266861386e`** (after
batch 2), **`59bb68aa89a9`** (final tree, adds the deliberate-revert knob and the counters only).

**Census 628 live / 0 missing -> 629 live / 0 missing.**

---

## THE SAMPLE IS PROVEN IDENTICAL, NOT ASSUMED

Two independent before/after pairs, each differing in ONE token:

| pair | flags | before | after |
|---|---|---|---|
| A (batch attribution) | `--games 961 --state --team-store data/team-pool-frozen --census <a scratchpad copy of the 628-row census>` | 95 of 777 | b1 95, b2 96 |
| B (the published gate) | `--games 961 --state --team-store data/team-pool-frozen --census data/gate-census.pin.json` | 95 of 777 | 96 of 777 |

Every run printed the same `777` games, `0` threw, and the same pinned pool
`b2b61ec40281 (1597 teams picked from a corpus of 8778 — PINNED to data/team-pool-frozen)`.
Pair A's runs also printed the same census `digest 2b841f002744  628 rows`; pair B's printed
`80e648f34d56  623 rows`.

**Pair A's before/after are byte-identical in `classes`, `first_divergences` and `coverage` across
batch 1** — asserted with a comparison, not assumed. That is the "the phaze branch did not move"
answer the brief asked for, and it is the answer for every other class too.

### THE PUBLISHED ARTIFACT CHANGED SAMPLE AND THIS IS THE CAVEAT

`data/game-differential.json` as committed at `b26c2d4` read **95 of 961** and was taken with the
**LIVE** game store. Re-running that exact invocation on the current tree gives **64 of 798** with a
pool digest of `6b5759422541` — a different sample, because OPS appends to the store. **Those two
numbers are not comparable and 64 is not an improvement.** The artifact now published is the
**pinned-store** run (`--team-store data/team-pool-frozen`, pool `b2b61ec40281`), which is
reproducible and which CLAUDE.md requires; its before-arm on the same pin is 95 and it now reads
**96 of 777**.

### ALL THREE PINNED TIE ARMS, THE SAME 777 GAMES (pair B)

| arm | before `39631097fcc7` | after `59bb68aa89a9` |
|---|---|---|
| middle (primary) | 95 | **96** |
| top-tie-first | 85 | **77** |
| bottom-tie-first | 117 | **114** |

The primary arm rose by one and the other two fell by eleven between them. The +1 is attributed
per game below; it is not a class that got worse.

---

## BATCH 1 — SUCTION CUPS HAS TWO DOORS AND ONLY ONE READ THE TAG (ROADMAP #341)

### The authority, derived

```
data/abilities.ts:4684-4694   suctioncups:
                                onDragOutPriority: 1,
                                onDragOut(pokemon) {
                                  this.add('-activate', pokemon, 'ability: Suction Cups');
                                  return null;
                                }
data/mods/champions/abilities.ts    NO `suctioncups` key — the format does not override it (checked)
sim/battle-actions.ts:1353    forceSwitch() -> runEvent('DragOut', target, source, move)
sim/battle-actions.ts:1104      `if (moveData.forceSwitch) damage = this.forceSwitch(...)`  the DAMAGING half
sim/battle-actions.ts:1260      the STATUS half, in the same function's other arm
sim/battle-actions.ts:1358-1362 `-fail` is written ONLY on `hitResult === false && move.category === 'Status'`
```

**The authority has ONE refusal site reached from two places.** This engine read
`refusesForcedSwitch` in the `phaze` branch (`medicham2-browser.js`, the `a.kind==='phaze'` arm) and
NOT in the damaging one (the `forcesSwitch` block after the damage), so Dragon Tail and Circle Throw
dragged a body the authority refuses to move.

### Membership, printed before wiring

Exactly three entities in the whole authority carry `onDragOut`:

| entity | kind | legal carriers in Reg M-B |
|---|---|---|
| `suctioncups` | ability | **1 — Malamar, ability slot 1** |
| `guarddog` | ability | **0** |
| `ingrain` | move (its condition) | not reachable through an ABILITY lookup — declared gap, not fixed |

`data/tags.json` carries `refusesForcedSwitch` on `suctioncups` and on nothing else, and
`tests/test-tag-params-derived.js` already asserts that set equal both ways. Guard Dog's absence is
the legality filter doing its job, not a gap — `docs/CARD-REVIEW-2026-08-22.md` C4 retracted that
finding and this pass did not reopen it.

### The traffic figure in the brief is too generous, and here is the derived one

The brief says Malamar is "brought 1,340 times across the two human stores". Walking both stores for
sheet entries that name a species AND declare an ability gives **191 Malamar entries, of which
Suction Cups is 2** — the other 189 are Contrary (187) and Infiltrator (2). So the mechanic's real
traffic is about **1% of Malamar**, not all of it. This is why the whole-game differential could not
move on it: `data/team-pool-frozen/games.bo3.jsonl` contains **zero** Suction Cups sheets.

### What landed

- the damaging branch now reads `refusesForcedSwitch` through `suppressedAbility` (so Mold Breaker
  still ignores it), emits the ability's own `-activate`, and **does not** drag;
- **no `-fail` and no `mvFailSilent`** — the authority's `-fail` needs `hitResult === false` AND a
  Status move, and Suction Cups returns `null` while Dragon Tail is Physical, so both clauses fail
  and the `-activate` is the whole story. The damage the move already dealt stands;
- `MEDSEEN.forcedSwitchRefusedDamaging` counts the new door apart from the total, because a non-zero
  total with a zero here is exactly the state this row was opened on;
- **the DISPLAY NAME.** `abilityLabel()` reads the artifact's `name`, so both doors now write
  `ability: Suction Cups` where they wrote `ability: suctioncups`. The differential's
  `effect-namespace` rule strips `ability:` and keeps the NAME, so that mismatch survived
  normalisation and was a real row. It is applied at **the two forced-switch refusal sites only** —
  thirteen other `'ability: '+x.ability` emissions in the file still write the id and are DECLARED
  OPEN below rather than swept in behind one probe. A record with no `name` is counted in
  `MEDFAILS.abilityLabelNoName` rather than falling back silently.

### Shown red first

- `tests/probe_drag_body.js --release 39631097fcc7`: **exit 1, one clause.**
  `dragontail  showdown |-activate|p2a: Malamar|ability: Suction Cups   medicham |drag|p2a: Snorlax|...`
  On `7719a4110299` and on the final `59bb68aa89a9`: **exit 0, every clause held**, and both doors
  now print the identical line.
- the census row `ability/refusesForcedSwitch` was **extended, not added**: a Dragon Tail arm on an
  unfaintable target (the authority guards the drag with `target.hp > 0`, so a KO would make both
  arms read "did not move" for the wrong reason). Extended first: **627 live / 1 missing**, showing
  `SUCTION CUPS "kangaskhan"` where it must read `"milotic"`, with the control reading
  `"kangaskhan"` so the door is demonstrably open. After the fix: **628 live / 0 missing**.
- `MEDI_BENCH_APPEND=1` still inverts every ROADMAP #340 clause in the same probe, so the drag
  measurement's own red is intact.

### The phaze branch did not move

Pair A's before/after artifacts are byte-identical in `classes` and `first_divergences`. The phaze
arm of the probe reads AGREE on both releases; what changed there is only that the `-activate` line
now matches character for character.

---

## BATCH 2 — THE LIFE ORB TOLL ASKED A QUESTION THE AUTHORITY DOES NOT ASK (ROADMAP #338)

### The brief's premise was half right and the useful half is not the half it named

`docs/CARD-REVIEW-2026-08-22.md` C2 says the recoil is *"stored as prose"* and that *"whatever
applies it is hardcoded elsewhere — which is why it fires in two cards and not in a third"*.

**"Stored as prose" is already fixed upstream and it never moved a board.** `data/tags.json` now
carries `cost {of:'baseMaxhp', divisor:10, fraction:0.1, rounding:'trunc', min:1, hook, onlyWhen}`,
derived `DERIVED:dex.items.get(id).onAfterMoveSecondarySelf`. Deriving the number changes nothing
observable in this regulation and that is stated rather than implied: the smallest legal maxhp at
L50 is Pikachu's **110** (Shedinja is `Past`/`Illegal`), so `min: 1` is unreachable, and nothing in
this format has a `baseMaxhp` different from its maxhp. It was still done, because a fact must live
in one place — but it is not the defect.

**"It is hardcoded" pointed at the right line for the wrong reason.** The line was

```js
if (m.item === 'lifeorb' && a.move.d.max > 0 && _reached > 0) { ... }
```

and the load-bearing error is `a.move.d.max > 0`. The authority's handler asks
`move.category !== 'Status'` past a `moveResult` gate and **says nothing about a damage number**.
`a.move.d` is the range computed when the ACTION WAS BUILT, against whoever stood in the aimed slot
at the TOP of the turn. Switches resolve before moves. So when the aimed body is replaced by a switch
on the same turn AND the body that left was type-immune, `d.max` is 0 while the move goes on to hit
the ARRIVING body for real damage — and the toll was silently skipped.

### Suspecting the instrument first was right, and then it was wrong

The first fourteen single-engine stagings and four two-engine boards ALL agreed with the authority —
ordinary hit, resisted hit, spread, multi-hit, drain, recoil, two-turn release, a KO, a mid-turn KO
with actions still queued, Magic Guard, Sheer Force, Future Sight, a Status click. Replaying the
exact team pair named in one of the differential rows also agreed. **The honest reading at that point
was "the accusation is the measurement", and it would have been wrong.**

What settled it was a SWEEP rather than another staged board: 499 real pairs from
`data/team-pool-frozen/games.bo3.jsonl`, restricted to teams that actually carry a Life Orb (2,775 of
them), comparing the two engines' toll SEQUENCES per game.

| release | games | tolls showdown | tolls medicham | sequences that differ |
|---|---|---|---|---|
| `7719a4110299` (before) | 499 | 41 | **39** | **2** |
| `59bb68aa89a9` (after) | 499 | 41 | **41** | **0** |

and the two were the same shape:

```
bo3-2653713441:p2   Whimsicott (Grass/FAIRY, immune to Dragon) is aimed at, switches out for
                    Gholdengo; Dragapult's Dragon Darts hits Gholdengo for 32 — no toll.
bo3-2654018395:p1   Krookodile (Ground/DARK, immune to Psychic) is aimed at, switches out for
                    Abomasnow; Basculegion's Psychic Fangs hits Abomasnow for 53 — no toll.
```

**Three probe errors were found and corrected before the engine was touched, and each of them read
as an engine verdict.** (1) The first version counted Showdown's `|split|` pair as two tolls, so a
one-toll turn read as two and a genuine agreement read as a mismatch. (2) The `ordinary-hit` control
had the aimed body clicking Protect, which stops the move outright — the arm staged nothing and
reported "the two engines paid the same tolls", trivially. (3) A two-turn arm passed a target on a
`lockedmove` release turn, which the authority refuses, so it read THREW.

### Membership, printed before wiring

- `statusCategory` is the **exact** complement of the authority's category clause: of the **325**
  legal damaging moves **zero** carry it, and of the **175** legal Status moves **zero** lack it.
  So it is the authority's own clause, not a proxy for it.
- `damageMultAll` **with a `cost`** has exactly **one** legal carrier in this regulation — Life Orb,
  21,257 sheets. An item that arrives carrying the tag with no cost pays nothing and says so in
  `MEDFAILS.orbCostMissing` rather than being quietly excluded.

### What landed

```js
const _loP = TAGS.param('item', m.item, 'damageMultAll');
const _loC = _loP && _loP.cost;
if (_loC && _reached > 0 && !TAGS.has('move', a.move.id, 'statusCategory')) { ... }
```

with the toll itself read off `cost.divisor` / `cost.rounding` / `cost.min`, the `[from] item:` label
read off the record's `name`, and four `MEDFAILS` counters (`orbCostMissing`, `orbCostRounding`,
`orbCostBase`, `orbLabelNoName`) so no departure from the derived param can be silent. `MEDSEEN
.orbTollPaid` is the capability receipt. Sheer Force and `refusesIndirectDamage` (Magic Guard) are
untouched.

`MEDI_ORB_STALE_RANGE=1` restores the old gate on purpose and sets
`MEDFAILS.orbStaleRangeRestored`, so the defect stays reachable after the fix.

### Shown red first

- `tests/probe_lifeorb_toll.js --release 7719a4110299`: **exit 1, one clause**, with three controls
  green beside it —
  `aimed-body-replaced-by-a-switch  showdown [p2a:165/183]  medicham [-]`, the move's own damage
  identical on both engines (`|-damage|p1a: Gholdengo|131/162`).
  Controls: `no-switch-hittable` (both pay), `status-click` (neither pays — the category control),
  `no-switch-immune` (neither pays — the connection control, which is what stops the fix becoming
  "pay on every damaging click"). On `59bb68aa89a9`: **every clause held**, sweep included.
- census: a NEW row, `item/damageMultAll — the Life Orb toll is owed by a move that CONNECTED, not
  by the range it was built with`. Under `MEDI_ORB_STALE_RANGE=1` it reads **MISSING** —
  `gholdengo takes 56 and the Orb pays 0` against the control's `56 dealt, 18 paid` — giving
  **628 live / 1 missing**. Without it, **629 live / 0 missing**.

### The whole-game differential went 95 -> 96 and this is what moved

Same pin, same pool, same 777 games, attributed per game:

| | |
|---|---|
| `pair-protect-bust  bo3-2655328005 vs bo3-2655397231` | **no longer diverges at all** (was `event missing from medicham2 :: \|-damage\|p1a\|H/H\|[from]lifeorb <> \|upkeep`) |
| `omit-protect  bo3-2658923125 vs bo3-2659004938` | the Life Orb row is **closed**; the game now runs further and parts later at `showdown stopped emitting while medicham2 continued :: \|switch\|p1a\|glimmora` |
| `pair-protect-bust  bo3-2657844786 vs bo3-2657789498` | **newly diverging** at `event missing from medicham2 :: \|switch\|p1b\|scrafty <> \|move\|p2a\|decorate`. Both sheets carry a Life Orb, so the toll now being paid is the plausible cause: a board that is closer to the authority reached a state a previously-absent 16 HP had been hiding. |
| the other 58 first-divergence rows | unchanged, cause for cause |

Class deltas: `event missing from medicham2` 34 -> 33, `ordering` 17 -> 18,
`showdown stopped emitting while medicham2 continued` 0 -> 1.

**One `[from]lifeorb` row remains and it is not a Life Orb row:**
`|-weather|sandstorm|[from]sandspit <> |-damage|p1b|H/H|[from]lifeorb` — the MISSING event is Sand
Spit's weather; the Life Orb toll on our side is correct and simply lands where the authority put
something else. That is an ordering/Sand Spit row wearing a Life Orb name, and the brief's "4 of the
95" is really **2 defects and 1 mis-attribution**.

---

## THINGS FOUND AND NOT FIXED — declared, not swept in

- **`tests/test-no-silent-failure.js` is RED and it is not from this pass.** `281 of 860 catch blocks
  silent, 81 NEW since the baseline, 31 of those MANUFACTURE a value`, across `tests/roster.js`,
  `engine/where.js`, `engine/tag_dex.js`, `engine/game_differential.js`, `engine/policy.js`,
  `engine/switchin_order.js` and eleven test files. Isolated: `medicham2-browser.js` and
  `test-mechanics.js` have **the identical catch-block count on HEAD and on this tree** (26 and 4),
  so this pass added none. Saying it is red, not filing it.
- **thirteen `'ability: '+x.ability` emission sites still write the ID, not the display name.**
  `abilityLabel()` exists and is applied at the two forced-switch refusal sites only. The other
  thirteen are at `medicham2-browser.js` lines around the Symbiosis spend, the redirect, the
  Disable-on-contact, the Magician steal, the Natural Cure line and the berry eat. Each is a real
  `ability: <id>` where the authority writes `ability: <Name>`.
- **`moveDisplayName()` falls back to the id SILENTLY** where `abilityLabel()` now counts. Same
  shape, one function away, left alone.
- **`ingrain` carries `onDragOut` and is not reachable through the ability lookup.** It is a
  VOLATILE. Zero legal species in this format learn it, so nothing can be staged today; named rather
  than guessed at.
- **the Suction Cups refusal is announced even with an EMPTY bench, in BOTH doors.** The authority
  guards `forceSwitch` with `this.battle.canSwitch(target.side)` and never runs the DragOut event at
  all when there is nobody to bring in, so no `-activate` is written. The phaze branch has had this
  since ROADMAP #139 and the new damaging branch MIRRORS it deliberately, because an asymmetry
  between the two doors is the exact bug this batch fixed. One line, both doors, still open.
- **the Life Orb toll is paid on a body the authority has already fainted.** `selfdestruct:'always'`
  (Explosion 43 / Self-Destruct 16 / Misty Explosion 6 corpus uses) faints the user at
  `sim/battle-actions.ts:499-501`, BEFORE the move resolves, so `this.damage()` at
  `AfterMoveSecondarySelf` emits nothing. This engine faints the user AFTER the toll, so it writes a
  `-damage ... [from] item: Life Orb` line the authority never writes. Same for a user killed by its
  own recoil or by Rough Skin mid-move. **Protocol only — the body faints either way** — which is
  why it was measured and left rather than folded into a board fix.
- **`MEDFAILS.traceBodyOffField = 4`** on every differential run in this pass, unchanged by either
  batch. `#224` is closed; this is a regression with no open row and it is not mine.
- **the census probe `ability/refusesForcedSwitch` stages Garchomp clicking Roar, and
  `champions_sim.canLearn('garchomp','roar')` is FALSE.** The probe is abstract (it calls
  `playerAction` directly, not the validator) so it still measures the mechanic, but the fixture
  names a click that cannot happen in this format. The Dragon Tail arm added this pass IS
  validator-legal. Not changed, because moving the phazer would perturb a green row for a
  presentation reason.
