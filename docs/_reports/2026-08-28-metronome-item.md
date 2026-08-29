# The Metronome ITEM: implemented, probed, and off the shelf — 2026-08-28, ENGINE

Verdict: **WIRE 158 landed. `damageMultOnRepeat` has a consumer and a counter, all six rungs of the
ladder agree with the authority in a played game, the roster row went `DEFERRED-BY-OWNER` (with real
diffs) to `FIRED-AND-BOARDS-MATCH`, and the owner shelf is out at no cost to the gate.**

Census **780 -> 782 live / 782 probed / 0 missing**. Both new rows shown RED under a knob first.

**The gate is 3 of 8, and it is NOT this change.** Five clauses are WITHHELD as *"measured against a
different engine"* — their artifacts ran on release `5f3f7141227c` and the tree is now
`4e5c7b3400de`. See §7; the re-runs are owed and listed at the end.

---

## 1. Was there a reversal? No receipt exists, and that is said plainly

The brief relayed Will's instruction to take Metronome out of the closet, and then to implement it.
**I searched and found no artifact of the reversal anywhere in this repository:**

- `git log -S"metronome" --since=2026-08-20 -- tests/roster.js docs/ROADMAP.md CHANGELOG.md` returns
  three commits, none of which touches the shelf entry.
- `git log --all --grep=metronome -i --since=2026-08-01` returns nothing.
- The **newest** documents still assert the opposite. `docs/_reports/2026-08-28-closet-illusion.md:130`
  and `CHANGELOG.md:781` both say *"Will's Metronome ruling is explicitly cost-based and stands"*, and
  they are dated today.

So the receipt is the owner's word relayed through the coordinator, plus ROADMAP #312 and #327 which
both carry the item as an open engine defect. **That is a weaker record than every other line in the
`DEFERRED` map carries**, and manufacturing a citation for it would be worse than the gap. It is
written into `tests/roster.js` at the shelf site in those words.

**One correction to the brief.** #312 was read as grouping Metronome with Hustle and Sand Force under
one consumer. The row's own sentence is narrower: *"**Hustle** is diagnosed and deliberately unfixed
because it needs the SAME consumer **Sand Force** does — base-power stage plus type plus weather"*.
Metronome is a third bullet and shares neither the stage nor the condition. It was therefore landed
alone, exactly as Sand Force was on 2026-08-27, and it is attributable alone.

## 2. The authority, read rather than recalled

`data/mods/champions/items.ts` has **no `metronome` key at all** — checked against the mod file — so
mainline's handler is the format's handler unchanged. `data/items.ts:3989-4029`:

```js
onStart(pokemon) { pokemon.addVolatile('metronome'); },
condition: {
  onStart(pokemon) { this.effectState.lastMove = ''; this.effectState.numConsecutive = 0; },
  onTryMovePriority: -2,
  onTryMove(pokemon, target, move) {
    if (!pokemon.hasItem('metronome')) { pokemon.removeVolatile('metronome'); return; }
    if (move.callsMove) return;
    if (this.effectState.lastMove === move.id && pokemon.moveLastTurnResult) {
      this.effectState.numConsecutive++;
    } else if (pokemon.volatiles['twoturnmove']) {
      if (this.effectState.lastMove !== move.id) this.effectState.numConsecutive = 1;
      else this.effectState.numConsecutive++;
    } else { this.effectState.numConsecutive = 0; }
    this.effectState.lastMove = move.id;
  },
  onModifyDamage(damage, source, target, move) {
    const dmgMod = [4096, 4915, 5734, 6553, 7372, 8192];
    const numConsecutive = this.effectState.numConsecutive > 5 ? 5 : this.effectState.numConsecutive;
    return this.chainModify([dmgMod[numConsecutive], 4096]);
  },
},
```

The six semantics the brief asked to be derived rather than assumed:

| question | the authority's answer | where |
|---|---|---|
| what resets the counter | anything that is not "the same move id AND a truthy `moveLastTurnResult`", except the two-turn branch | `:4010-4020` |
| is it a volatile | **yes** — the item's `onStart` adds one, so `clearVolatile` wipes it on switch-out and re-entry re-zeroes it | `:3995` |
| "the same move" | `move.id`, and **a move that CALLS another returns before `lastMove` is touched** — the chain is neither advanced nor broken | `:4009` |
| a failed / missed / shielded move | still reaches `onTryMove` (accuracy and Protect are resolved further down), so it **advances or resets on this turn** and breaks the chain on the NEXT one through `moveLastTurnResult` | `useMoveInner` order |
| where the multiplier applies | the **final `ModifyDamage` chain**, `chainModify`, not a base-power modifier | `:4022` |
| whose damage | `runEvent('ModifyDamage', pokemon, target, ...)` with `pokemon` the **ATTACKER**, so `onModifyDamage` is the holder's own attacks | `data/mods/champions/scripts.ts:293` |

**ROADMAP #509, answered.** The brief said the row claims the `true`-vs-`null` split is *only* readable
through the Metronome item, and that #509 reads `moveThisTurnResult`. The handler at `:4010` reads
**`moveLastTurnResult`**, a TRUTHY test — where Stomping Tantrum and Temper Flare read
`moveLastTurnResult === false`. So the split is now genuinely observable: `null` (a recharge, a
refused Protect, a fresh switch-in) **resets** this counter where `true` advances it. This
implementation reads the field exactly as medicham2 already writes it (`_mvResLast`) and changes
nothing about the split — if the field is wrong anywhere, this item is now where it shows.

## 3. What was built — four sites in `engine/medicham2-browser.js`

| site | what |
|---|---|
| `MEDSEEN` | `metroCounterAdvanced`, `metroCounterReset`, `metroLadderApplied` — three counters, because the counter and the multiplier are separate wires and either can be dead alone |
| `MEDFAILS` | `metronomeLadderBlindRestored` (the knob's receipt) and `metroLadderUnreadable` (an unreadable ladder applies NOTHING and says so) |
| the turn loop, immediately **below the PP deduction** and **above the shield gate** | the counter write — that is `onTryMovePriority: -2`'s position expressed as code |
| `dmgRange`'s final `MODMUL` chain, beside Friend Guard | the multiplier, read off the tag's own `steps4096` / `denom` / `cap` |
| `switchOut`'s clear, beside `_mvRes` and `_timesAttacked` | `_metroLast = null; _metroN = 0` |

**Nothing types 4915 or "x1.2 per use."** The ladder comes out of
`TAGS.param('item', ..., 'damageMultOnRepeat')` and the index is clamped by the tag's own `cap`. The
steps are not evenly spaced, so a summary would be a second and wrong implementation of the fact.
Every step over 4096 is a dyadic rational, so `ch4096` introduces no rounding of its own.

**The membership was printed before it was wired**, both sets, and neither over-matched:

```
DERIVED — items carrying `damageMultOnRepeat`: metronome
DERIVED — moves carrying `callsAnotherMove`:   copycat, sleeptalk
```

The `callsMove` skip is matched on the tag, never on a name. The move **Metronome**, Assist, Me First,
Mirror Move and Nature Power are all `isNonstandard: 'Past'` in this format — checked against
`Dex.forFormat`, not recalled — which is also why removing the bare-id `metronome` key from the
`DEFERRED` map can only reach the ITEM today. If the move is ever un-banned, that collision is live.

## 4. The knob: `MEDI_NO_METRONOME_LADDER=1`

It switches off **both** halves — the turn loop stops advancing the counter and `dmgRange` stops
reading the ladder. Both, because half a knob leaves an engine that is neither the before-state nor
the after-state, and a red demonstration has to run against the engine that actually shipped. Any run
carrying it also carries `MEDFAILS.metronomeLadderBlindRestored = 1`.

## 5. The proofs — every rung, in two instruments, red first

### `tests/probe_metronome_ladder.js` — the consumer, rung by rung

Corviknight Aerial Ace into Aggron, `_metroN` set by hand across the whole declared table:

```
rung 0   6-7     rung 1   7-8     rung 2   8-10
rung 3  10-11    rung 4  11-13    rung 5  12-14    rung 6 (above the cap)  12-14
```

with all of: the ladder never goes down; it **moves at every one of the five rungs the tag says
moves**; it is **flat above the cap**; **rung 0 is byte-identical to a body holding no item at all**
(the identity step, which is where an off-by-one rung would show); and a body holding **Leftovers** is
untouched by `_metroN` (the over-match control). Under the knob every rung reads **7, 7, 7, 7, 7, 7,
7** — which is exactly what an unwired consumer produces, and is why the flat arm is asserted rather
than assumed.

### `tests/probe_metronome_game.js` — the counter, six turns, against Showdown

The consumer probe sets `_metroN` by hand and therefore says nothing about whether the turn loop ever
advances it — which was the actual defect. This one plays a real six-turn game in both engines,
running the **working copy's bytes over the frozen release** via `SB.harness(src)`, so it needed no
release cut.

```
boundary 0..6   394 leaves compared each   identical      (verdict IDENTICAL)
```

and with `--broken`:

```
boundary 0   identical
boundary 1   identical                                    <- rung 0 is the identity, as declared
boundary 2   aggron hp  showdown 131 / ours 132           <- rung 1
boundary 3   aggron hp  showdown 123 / ours 126           <- rung 2
boundary 4   aggron hp  showdown 113 / ours 120
boundary 5   aggron hp  showdown 100 / ours 113
boundary 6   aggron hp  showdown  88 / ours 107
```

The gap widens **1, 3, 7, 13, 19** as the ladder climbs. The fixture is chosen so that only the ladder
moves: Aerial Ace is `accuracy: true` with no secondary and no `multiHit`; Aggron is x0.25 into Flying
with 180 base Defence and survives all six hits, so the ladder is never truncated by a faint; and the
target clicks **Metal Sound**, not Protect — a Protect would break the consecutive-use chain, and it is
the one click this fixture must not make.

### The census — `tests/test-mechanics.js`, two new rows, both shown RED

```
item / damageMultOnRepeat   the Metronome item makes damage CLIMB over consecutive uses of one move
    no item [6, 6, 6, 6]   Metronome [6, 7, 8, 10]
item / damageMultOnRepeat   the Metronome counter RESETS when the holder changes move
    Aerial Ace 6 then 7, Assurance in between, then Aerial Ace back to 6
```

Both spend real turns (`directCall: false`), both are armed, and both went **MISSING** under
`MEDI_NO_METRONOME_LADDER=1` — `780 live, 2 missing, 782 probed` — before the artifact was restored by
a clean re-run at `782 live, 0 missing`. The second row is the one a ladder-that-only-climbs fails: an
engine wired to a bare turn counter passes the first probe and reads `6 > 7` on the second.

## 6. The roster row: the before and the after

| | before | after |
|---|---|---|
| verdict | `DEFERRED-BY-OWNER` | **`FIRED-AND-BOARDS-MATCH`** |
| diffs | `hp` / `party.hp` **949 against 952** on turns 2 and 3, bucket `off-by-2-or-3`, carrier Kangaskhan | none |
| stage summary | — | 1 TESTED of 1 IN SCOPE, 0 DIFFER, 0 DEFERRED-BY-OWNER, 0 COULD-NOT-STAGE |

`SHOWDOWN_PATH=... node tests/roster.js --stage items --only metronome --reds --release 4e5c7b3400de`.
Not written — the artifact on disk is still the 15:24 run.

## 7. The shelf, and what it costs — the prediction was published and then falsified

The `DEFERRED` entry was removed from `tests/roster.js` **before** the fix, on the owner's word, and a
prediction was written into the comment: that the roster/items clause would go `0 -> 1` and reopen the
gate at 6 of 8. **That prediction is now false and the comment says so rather than being deleted.**

It was not a soft prediction: `reachOf(items, metronome)` is **19 teams in 13,116 open-sheet games =
14.49 per 10k** against the reach shelf's **3.86 per 10k**, so `below('items', 19)` is **FALSE** — the
row could not have been excused that way either. With the fix in, the shelf comes out at **no cost**.

The entry is **commented out, not deleted**, exactly as `minus` above it is: a closet that silently
loses rows teaches nobody.

**Consumers of the export, all checked:**

| consumer | effect of removing one name |
|---|---|
| `engine/all_mechanics_fire.js:3250` (`require('../tests/roster.js').DEFERRED`) | none — it looks names up |
| `engine/quarantine.js` | reads the ARTIFACT's `deferred` field, not the live map |
| `tests/test-closet-scope.js` | **green**, re-run. Its assertions are one-directional (every DEFERRED name must be marked in the artifact); nothing asserts metronome's membership. `DEFERRED` still exports 6 names, all carrying `by`/`on`/`why`, and the blanket control (`totalShelved > 0`) still holds at 10 of 964 |

**THE GATE WENT 8 OF 8 TO 3 OF 8 AND THE CAUSE IS NOT A DIVERGENCE.** Five clauses — roster items,
roster abilities, roster moves, whole-game, mechanics — are all WITHHELD with the same sentence:
*"MEASURED AGAINST A DIFFERENT ENGINE — this artifact ran on release `5f3f7141227c` and the tree is
`4e5c7b3400de`."* Three clauses still pass (damage differential, coverage, no-open-defect).

Two things about that, both said plainly:

- **A release was cut over my uncommitted mid-session engine edit, by another agent.**
  `data/engine-release.json` records `4e5c7b3400de` first cut `2026-08-28T23:35:19Z`, `why: "game
  differential mode A — the comparison driver, ROADMAP #68 step two"` — nothing to do with Metronome —
  and `REL.read('engine/medicham2-browser.js')` is **byte-identical to the live file including WIRE
  158**. That is the photograph rule violated from the other side: I moved under someone else's cut.
  It is convenient here (the roster run above measured my change with no cut of my own) and it is not
  safe, and it should be reported rather than enjoyed.
- **Any engine change would have done this.** Landing a fix in a frozen source and then not re-running
  the five artifacts is what a withheld clause means. The re-runs are the price of the fix, not a
  symptom of it.

## 8. What was NOT done

- **The consumer for Hustle and Sand Force** — out of scope by #312's own words, and Sand Force is
  already closed (2026-08-27). Hustle remains open and is not blocked by this.
- **`node engine/status.js --write`** — deliberately not run. It would stamp a transient `3 of 8` into
  five ledgers while `docs/ENGINE.md`, `docs/MEASURE.md`, `docs/OPS.md`, `docs/SEARCH.md` and
  `docs/SUMMARY.md` are all uncommitted-modified by another agent. Stamp it after the re-runs below.
- **No commit, no push.**

## OWED, NOT RUN

```bash
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown

# 1. the three roster stages, on the release the tree already matches, WITH --reds (a --write
#    without it silently stamps `reds: []` — tests/roster.js says so in its own header)
for st in items abilities moves; do
  cmd /c tools\lownode.cmd tests\roster.js --stage $st --reds --write --release 4e5c7b3400de
done
#    EXPECTED: items 139 -> 140 tested with metronome as FIRED-AND-BOARDS-MATCH and
#    DEFERRED-BY-OWNER 1 -> 0; abilities and moves unmoved at 129 and 475.

# 2. the mechanics runner — this is where `items.diverged_including_shelved 1` becomes 0
cmd /c tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write --release 4e5c7b3400de
#    EXPECTED: items diverged 0 (unmoved), diverged_including_shelved 1 -> 0,
#    shelved_by_owner 1 -> 0, shelved_by_owner_diverging 1 -> 0.

# 3. the whole-game differential, pinned three ways per CLAUDE.md
cmd /c tools\lownode.cmd engine\game_differential.js --release 4e5c7b3400de \
    --team-store data/team-pool-frozen --games 961 --write
#    EXPECTED: unmoved at 6 raw / 1 of 961. The pool holds few Metronome holders and the item is
#    19 of 26,232 teams — say so BEFORE the run, per the two-scoreboards rule.

# 4. only then
node engine/status.js --write
```

Two things to check before trusting any of the four: that `node engine/engine_release.js verify
4e5c7b3400de` still says **intact** (it did at 23:52Z), and that no other agent has cut a release in
between — this session already lost the 8-of-8 reading to exactly that.
